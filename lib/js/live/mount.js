// Mounts a live figure produced by filters/live.lua:
//
//   <div id="…" class="hn-live" data-figure="spring1" [data-inputs data-outputs data-colors data-packages]>
//     <div class="hn-live-figure"></div>
//     <div class="sourceCode"><pre><code>…R snippet…</code></pre></div>
//     <div class="hn-live-eq" data-template="…">…placeholder math…</div>   (any number)
//     <div class="hn-live-status"></div>
//   </div>
//
// The figure module (lib/js/figures/<name>.js) exports:
//   inputs   R variables the figure changes (numeric literals in the snippet)
//   outputs  R expressions the figure needs back (as numbers)
//   colors   { name: "pen1" } colors for quantities in code and equations
//   draw(svg, state), interact(svg, state, onChange)
// The figure state uses the R names: { x1, L0, F }.
//
// With ?debug in the page URL, timings are shown under each figure.
import { d3 } from "../kit/index.js";
import { createBridge } from "./bridge.js";
import { createLiveEquation } from "./liveeq.js";

const DEBUG = new URLSearchParams(location.search).has("debug");

const list = (s) => (s ?? "").split(/[\s,]+/).filter(Boolean);
const colorMap = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.startsWith("hn-q-") ? v : `hn-q-${v}`]));
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

// The input literals as written in the snippet, so the figure can be drawn
// before R has loaded (R's parser takes over once it's ready).
function literals(source, inputs) {
  const values = {};
  for (const name of inputs) {
    const m = source.match(new RegExp(`(?:^|[\\s;])${name}\\s*(?:<-|=)\\s*(-?[0-9.eE+-]+)`));
    if (m) values[name] = Number(m[1]);
  }
  return values;
}

export async function mount(root) {
  if (typeof root === "string") root = document.getElementById(root);
  const fig = await import(new URL(`../figures/${root.dataset.figure}.js`, import.meta.url));
  const inputs = root.dataset.inputs ? list(root.dataset.inputs) : (fig.inputs ?? []);
  const outputs = root.dataset.outputs ? list(root.dataset.outputs) : (fig.outputs ?? []);
  const packages = list(root.dataset.packages);
  const colors = colorMap({
    ...(fig.colors ?? {}),
    ...Object.fromEntries(list(root.dataset.colors).map((c) => c.split(":"))),
  });

  const codeEl = root.querySelector("pre code");
  const status = root.querySelector(".hn-live-status");
  const say = (html, cls = "") => { status.innerHTML = html; status.className = `hn-live-status ${cls}`; };
  say("Loading R in your browser…");

  // Figure first: it can be dragged before R is ready
  const svg = d3.select(root.querySelector(".hn-live-figure")).append("svg");
  let state = literals(codeEl.textContent, inputs);
  fig.draw(svg, state);

  const equations = [...root.querySelectorAll(".hn-live-eq")]
    .map((el) => createLiveEquation(el, el.dataset.template, { colors }));
  const slots = [...new Map(equations.flatMap((e) => e.slots).map((s) => [s.key, s])).values()];

  let bridge = null;
  const drag = fig.interact(svg, state, (s) => {
    state = { ...state, ...pick(s, inputs) };
    fig.draw(svg, state);                 // move at once, with the last known outputs
    bridge?.run(pick(state, inputs));
  });

  try {
    bridge = await createBridge({
      codeEl, inputs, colors, outputs, slots, packages,
      onResult(result, stats) {
        if (result.error) { say(`R error: ${result.error}`, "hn-live-error"); return; }
        state = { ...state, ...result.outputs };
        fig.draw(svg, state);
        for (const eq of equations) eq.render(result.slots);
        say(DEBUG ? debugText(stats) : "", DEBUG ? "hn-live-debug" : "");
        root.hnLive = { state, stats, code: result.code, slots: result.slots };
        root.dispatchEvent(new CustomEvent("hn-live-result", { detail: root.hnLive }));
      },
    });
  } catch (e) {
    say(`Could not start R: ${e.message}`, "hn-live-error");
    throw e;
  }
  // Values dragged while R was loading win over the literals in the code
  state = { ...bridge.values(), ...state };
  drag?.set?.(state);
  bridge.run(pick(state, inputs));
}

function debugText(stats) {
  const recent = stats.evalMs.slice(-30);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const ms = (v) => `${v.toFixed(0)} ms`;
  return `webR loaded in <b>${(stats.initMs / 1000).toFixed(1)} s</b>` +
    (stats.packagesMs ? `, packages in <b>${(stats.packagesMs / 1000).toFixed(1)} s</b>` : "") +
    `. Updates requested: <b>${stats.sent}</b>, run in R: <b>${stats.evaluated}</b>, ` +
    `skipped (R was busy): <b>${stats.skipped}</b>. R time per update (last 30): ` +
    `last <b>${ms(recent.at(-1))}</b>, average <b>${ms(avg)}</b>, max <b>${ms(Math.max(...recent))}</b>`;
}
