// Live scopes on a page (HTML produced by filters/live.lua).
//
//   <div class="hn-live" id=… [data-figure] [data-colors]></div>   start of a scope
//     <div class="hn-live-figure"></div>                              if data-figure
//     <div class="hn-live-code [hn-live-hidden]"> …<pre><code>…R…</code></pre>… </div>
//     <div class="hn-live-eq" data-template="…">…</div>
//     <div class="hn-live-slider" data-input="k" data-min data-max data-step>label</div>
//     <div class="hn-live-status"></div>
//   <div class="hn-live-end"></div>                                   end of the scope
//
// Scopes are marked by start and end markers rather than wrapping elements,
// so headings inside a scope stay ordinary sections (table of contents,
// numbering). Scopes nest by the order of the markers in the page.
//
// Scopes: each scope's R environment has the enclosing scope's environment
// as its parent, so code inside sees the variables of the code around it. All
// R blocks of a scope run in page order, in one environment.
//
// Inputs: a figure's `inputs` and a slider's `input` name a variable that is
// assigned a numeric literal (`k <- 2`). The literal belongs to the nearest
// scope, going outwards, that assigns it (for a slider outside all scopes:
// the only scope on the page that assigns it). Changing an input reruns its
// scope and every scope inside it, parents first; nothing else runs.
//
// One evaluation at a time: while R is busy, new requests are collected and
// run together afterwards, so R never falls behind the reader's hand.
//
// Figure modules (lib/js/figures/<name>.js) export:
//   inputs   variables the figure changes      outputs  R expressions it needs (numbers)
//   colors   { name: "pen1" }                  draw(svg, state), interact(svg, state, onChange)
// The figure state uses the R names: { x1, L0, F }.
//
// With ?debug in the page URL, timings are shown under each figure.
import { d3 } from "../kit/index.js";
import { getWebR, installPackages } from "./webr.js";
import { createLiveCode } from "./livecode.js";
import { createLiveEquation } from "./liveeq.js";
import { createSlider } from "./slider.js";
import { addFullCode } from "./fullcode.js";

const DEBUG = new URLSearchParams(location.search).has("debug");

const list = (s) => (s ?? "").split(/[\s,]+/).filter(Boolean);
const colorClass = (v) => (v.startsWith("hn-q-") ? v : `hn-q-${v}`);
const colorMap = (obj) => Object.fromEntries(Object.entries(obj ?? {}).map(([k, v]) => [k, colorClass(v)]));
const parseColors = (s) => colorMap(Object.fromEntries(list(s).map((c) => c.split(":"))));
const rStr = (s) => JSON.stringify(s);   // JSON string escapes are valid in R
const rVec = (xs, conv) => (xs.length ? `c(${xs.map(conv).join(", ")})` : "character(0)");

export async function mountPage() {
  // ---- 1. The scope tree, figures, equations, sliders (no R needed yet)
  // querySelectorAll returns elements in page order, so a stack of open
  // scopes tells which scope each element belongs to.
  const scopes = [];
  const sliderEls = [];
  const stack = [];
  for (const el of document.querySelectorAll(
    ".hn-live, .hn-live-end, .hn-live-figure, .hn-live-status, .hn-live-code pre code, .hn-live-eq, .hn-live-slider")) {
    const s = stack.at(-1) ?? null;
    const is = (c) => el.classList.contains(c);
    if (is("hn-live")) {
      const scope = {
        el, id: el.id, parent: s, children: [], blocks: [], codeEls: [], equationEls: [],
        literals: new Set(), inputs: new Set(), values: {}, colors: {}, inputColors: {},
        figure: null, figureEl: null, status: null,
      };
      s?.children.push(scope);
      scopes.push(scope);
      stack.push(scope);
    } else if (is("hn-live-end")) stack.pop();
    else if (is("hn-live-slider")) sliderEls.push([el, s]);
    else if (!s) continue;
    else if (is("hn-live-figure")) s.figureEl = el;
    else if (is("hn-live-status")) s.status = el;
    else if (is("hn-live-eq")) s.equationEls.push(el);
    else s.codeEls.push(el);
  }
  if (!scopes.length) return;
  const ancestry = (s) => { const out = []; for (; s; s = s.parent) out.unshift(s); return out; };

  const say = (s, html, cls = "") => {
    if (!s.status) return;
    s.status.innerHTML = html;
    s.status.className = `hn-live-status ${cls}`;
  };
  const fail = (s, msg) => say(s, escapeText(msg), "hn-live-error");

  // Initial values straight from the code text, so figures and sliders can
  // be shown (and dragged) before R has loaded. R's parser takes over later.
  const textLiteral = (s, name) => {
    for (const scope of ancestry(s).reverse()) {
      for (const el of scope.codeEls) {
        const m = el.textContent.match(new RegExp(`(?:^|[\\s;{])${name}\\s*(?:<-|=)\\s*(-?[0-9.]+(?:[eE][+-]?[0-9]+)?)`));
        if (m) return Number(m[1]);
      }
    }
    return undefined;
  };

  // Figures
  const early = [];   // inputs changed before R was ready: [scope, name, value]
  let runtime = null;
  await Promise.all(scopes.filter((s) => s.el.dataset.figure).map(async (s) => {
    const name = s.el.dataset.figure;
    try {
      const module = await import(new URL(`../figures/${name}.js`, import.meta.url));
      const svg = d3.select(s.figureEl).append("svg");
      const inputs = s.el.dataset.inputs ? list(s.el.dataset.inputs) : (module.inputs ?? []);
      const outputs = s.el.dataset.outputs ? list(s.el.dataset.outputs) : (module.outputs ?? []);
      const state = Object.fromEntries(inputs.map((n) => [n, textLiteral(s, n)]));
      const fig = { module, svg, inputs, outputs, state, drag: null };
      s.figure = fig;
      module.draw(svg, state);
      fig.drag = module.interact(svg, state, (next) => {
        for (const n of inputs) fig.state[n] = next[n];
        module.draw(svg, fig.state);               // move at once, with the last known outputs
        for (const n of inputs) setInput(s, n, next[n]);
      });
    } catch (e) {
      fail(s, `Figure "${name}": ${e.message}`);
    }
  }));

  // Sliders
  const sliders = sliderEls.map(([el, scope]) => {
    const name = el.dataset.input;
    const value = scope ? textLiteral(scope, name)
      : scopes.map((s) => textLiteral(s, name)).find((v) => v !== undefined);
    const slider = { el, name, scope, owner: null };
    slider.ui = createSlider(el, {
      name, value, min: Number(el.dataset.min ?? 0), max: Number(el.dataset.max ?? 10),
      step: Number(el.dataset.step ?? 0.1), color: el.dataset.color ? colorClass(el.dataset.color) : "",
      onInput: (v) => { if (slider.owner) setInput(slider.owner, name, v, true); else early.push([slider, name, v]); },
    });
    return slider;
  });

  function setInput(scope, name, value, direct = false) {
    if (!runtime) { if (!direct) early.push([scope, name, value]); return; }
    const owner = direct ? scope : scope.owners?.[name];
    if (!owner) return;
    owner.values[name] = value;
    runtime.invalidate(owner);
  }

  // ---- 2. R: tokenize the code, install packages, resolve inputs
  for (const s of scopes) if (s.figure || s.equationEls.length) say(s, "Loading R in your browser…");
  let webR;
  try {
    webR = await getWebR();
    for (const s of scopes) {
      for (const el of s.codeEls) {
        const block = await createLiveCode(webR, el);
        s.blocks.push(block);
        block.literals().forEach((n) => s.literals.add(n));
      }
    }
  } catch (e) {
    for (const s of scopes) fail(s, `Could not start R: ${e.message}`);
    throw e;
  }
  const stats = { initMs: webR.hnInitMs, packagesMs: 0, requests: 0, runs: 0, merged: 0, runMs: [] };
  const packages = [...new Set(scopes.flatMap((s) => s.blocks.flatMap((b) => b.packages())))];
  let installed = [];
  if (packages.length) {
    for (const s of scopes) if (s.figure || s.equationEls.length) say(s, `Installing R packages: ${packages.join(", ")}…`);
    const t0 = performance.now();
    installed = await installPackages(webR, packages);
    stats.packagesMs = performance.now() - t0;
  }

  const lookup = (s, name) => { for (; s; s = s.parent) if (s.literals.has(name)) return s; return null; };
  const bindInput = (from, name, color) => {
    const owner = lookup(from, name);
    if (!owner) throw new Error(`no scope around this one assigns a number to "${name}" (like ${name} <- 1)`);
    owner.inputs.add(name);
    if (color) owner.inputColors[name] ??= color;
    return owner;
  };
  for (const s of scopes) {
    if (!s.figure) continue;
    s.owners = {};
    const colors = colorMap(s.figure.module.colors);
    try { for (const n of s.figure.inputs) s.owners[n] = bindInput(s, n, colors[n]); }
    catch (e) { fail(s, e.message); s.figure = null; }
  }
  for (const sl of sliders) {
    try {
      if (sl.scope) sl.owner = bindInput(sl.scope, sl.name, sl.ui.color);
      else {
        const owners = scopes.filter((s) => s.literals.has(sl.name));
        if (owners.length !== 1) throw new Error(`${owners.length} scopes assign "${sl.name}"; put the slider inside one of them`);
        sl.owner = owners[0];
        sl.owner.inputs.add(sl.name);
        if (sl.ui.color) sl.owner.inputColors[sl.name] ??= sl.ui.color;
      }
    } catch (e) {
      sl.ui.error(e.message);
    }
  }

  // Colors: inherited from enclosing scopes, plus the scope's own and its figure's
  for (const s of scopes) {   // document order: parents before children
    s.colors = {
      ...(s.parent?.colors ?? {}), ...s.inputColors,
      ...colorMap(s.figure?.module.colors), ...parseColors(s.el.dataset.colors),
    };
  }
  for (const s of scopes) {
    for (const b of s.blocks) b.bind([...s.inputs], s.colors);
    Object.assign(s.values, ...s.blocks.map((b) => b.values()));
    s.equations = s.equationEls.map((el) => createLiveEquation(el, el.dataset.template, { colors: s.colors }));
  }
  for (const [where, name, value] of early) {
    const owner = where.ui ? where.owner : where.owners?.[name];
    if (owner) owner.values[name] = value;
  }

  // ---- 3. Full code buttons
  const fullCode = (s) => {
    const chain = ancestry(s);
    const header = ["# Full code of this example: runs as is in R."];
    if (installed.length) header.push(`# Needs: install.packages(${installed.length > 1 ? `c(${installed.map(rStr).join(", ")})` : rStr(installed[0])})`);
    return {
      text: header.join("\n") + "\n\n" + chain.flatMap((c) => c.blocks.map((b) => b.text())).filter(Boolean).join("\n\n") + "\n",
      html: header.map((h) => `<span class="co">${escapeText(h)}</span>`).join("\n") + "\n\n" +
        chain.flatMap((c) => c.blocks.map((b) => b.html({ live: false }))).filter(Boolean).join("\n\n"),
    };
  };
  const panels = [];
  for (const s of scopes) {
    s.codeEls.forEach((el) => {
      if (el.closest(".hn-live-hidden")) return;
      panels.push(addFullCode(el, () => fullCode(s)));
    });
  }

  // ---- 4. Running
  runtime = createRuntime(webR, scopes, stats, (ran, result) => {
    ran.forEach((s, i) => {
      const error = result.errors[i];
      const fig = s.figure;
      if (fig) {
        for (const n of fig.inputs) fig.state[n] = s.owners[n].values[n];
        fig.outputs.forEach((o, j) => {
          const v = result.reads[s.id]?.out[j];
          fig.state[o] = v === undefined ? NaN : v.length === 1 ? v[0] : v;
        });
        fig.module.draw(fig.svg, fig.state);
        fig.drag?.set?.(fig.state);
      }
      const slots = result.reads[s.id]?.slots ?? {};
      for (const eq of s.equations) eq.render(slots);
      const readError = result.reads[s.id]?.error;
      if (error) fail(s, `R error: ${error}`);
      else if (readError) fail(s, `R error: ${readError}`);
      else say(s, DEBUG && fig ? debugText(stats, ran.length) : "", DEBUG ? "hn-live-debug" : "");
      s.el.hnLive = { state: fig?.state, outputs: fig?.outputs ?? [], values: s.values, code: s.code, slots, error, stats, fullCode: () => fullCode(s).text };
    });
    for (const sl of sliders) if (sl.owner) sl.ui.set(sl.owner.values[sl.name]);
    for (const p of panels) p.refresh();
  });
  window.hnLive = { stats, idle: runtime.idle, scopes };
  for (const s of scopes) if (!s.parent) runtime.invalidate(s);
  stats.requests = 0;
}

function createRuntime(webR, scopes, stats, onResult) {
  let busy = false;
  const dirty = new Set();
  let waiters = [];

  async function pump() {
    if (busy || !dirty.size) return;
    busy = true;
    // Rerun every dirty scope with all scopes inside it, parents first
    const isInside = (s) => { for (let p = s.parent; p; p = p.parent) if (dirty.has(p)) return true; return false; };
    const roots = new Set([...dirty].filter((s) => !isInside(s)));
    dirty.clear();
    const ran = scopes.filter((s) => { for (let p = s; p; p = p.parent) if (roots.has(p)) return true; return false; });

    const reads = [];
    for (const s of ran) {
      s.code = s.blocks.map((b) => b.set(s.values)).join("\n");   // shown text == executed text
      for (const o of s.figure?.outputs ?? []) reads.push({ s, kind: "out", expr: o, digits: -1 });
      const seen = new Set();
      for (const slot of (s.equations ?? []).flatMap((e) => e.slots)) {
        if (seen.has(slot.key)) continue;
        seen.add(slot.key);
        reads.push({ s, kind: "slot", expr: slot.expr, digits: slot.digits ?? -1, key: slot.key });
      }
    }
    const call = `.hn_run(${rVec(ran, (s) => rStr(s.id))}, ${rVec(ran, (s) => rStr(s.parent?.id ?? ""))}, ` +
      `${rVec(ran, (s) => rStr(s.code))}, ${rVec(reads, (r) => rStr(r.s.id))}, ${rVec(reads, (r) => rStr(r.kind))}, ` +
      `${rVec(reads, (r) => rStr(r.expr))}, ${reads.length ? `c(${reads.map((r) => r.digits).join(", ")})` : "numeric(0)"})`;

    const t0 = performance.now();
    const result = { errors: [], reads: {} };
    try {
      const out = await webR.evalR(call);
      try {
        const js = await out.toJs();
        const [errors, values, readErrors] = js.values;
        result.errors = errors.values;
        reads.forEach((r, i) => {
          const into = (result.reads[r.s.id] ??= { out: [], slots: {}, error: "" });
          const v = values.values[i].values;
          if (readErrors.values[i]) into.error ||= readErrors.values[i];
          if (r.kind === "out") into.out.push(v.map(Number));
          else if (v.length) into.slots[r.key] = { nrow: Number(v[0]), ncol: Number(v[1]), entries: v.slice(2) };
        });
      } finally {
        await webR.destroy(out);
      }
    } catch (e) {
      result.errors = ran.map(() => e.message);
    }
    stats.runs += 1;
    stats.runMs.push(performance.now() - t0);
    stats.lastScopes = ran.length;
    busy = false;
    onResult(ran, result);
    if (dirty.size) pump();
    else { const w = waiters; waiters = []; w.forEach((f) => f()); }
  }

  return {
    invalidate(scope) {
      stats.requests += 1;
      if (busy && dirty.has(scope)) stats.merged += 1;
      dirty.add(scope);
      pump();
    },
    // resolves when R has caught up with all requests
    idle: () => (busy || dirty.size ? new Promise((r) => waiters.push(r)) : Promise.resolve()),
  };
}

function escapeText(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function debugText(stats, scopes) {
  const recent = stats.runMs.slice(-30);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const ms = (v) => `${v.toFixed(0)} ms`;
  return `webR loaded in <b>${(stats.initMs / 1000).toFixed(1)} s</b>` +
    (stats.packagesMs ? `, packages in <b>${(stats.packagesMs / 1000).toFixed(1)} s</b>` : "") +
    `. Changes: <b>${stats.requests}</b>, R runs: <b>${stats.runs}</b> (last one: ${scopes} scope${scopes > 1 ? "s" : ""}), ` +
    `merged while R was busy: <b>${stats.merged}</b>. R time per run (last 30): ` +
    `last <b>${ms(recent.at(-1))}</b>, average <b>${ms(avg)}</b>, max <b>${ms(Math.max(...recent))}</b>`;
}
