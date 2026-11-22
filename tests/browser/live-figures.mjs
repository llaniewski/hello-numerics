// Browser check of the live scopes in the built book (_book/).
//
//   quarto render && node tests/browser/live-figures.mjs [page ...]
//
// For the given pages (default: demos/live-spring.html):
//  - waits until R has run every scope,
//  - drags each figure's first handle in small steps, like a hand would,
//    then moves every slider,
//  - checks after each change that every scope shows exactly the code R ran,
//    that equations show the values R formatted, and that changed values are
//    highlighted,
//  - runs each figure's "Full code" in native R (Rscript) and checks that it
//    gives the same outputs and equation values as the browser,
//  - prints timings.
// Screenshots go to $SHOTS (default: no screenshots).
import http from "node:http";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const REPO = new URL("../../", import.meta.url).pathname;
const ROOT = join(REPO, "_book");
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ["demos/live-spring.html"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".R": "text/plain", ".ico": "image/x-icon",
  ".woff2": "font/woff2" };

// Minimal static server for _book/
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const body = await readFile(join(ROOT, path.endsWith("/") ? path + "index.html" : path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const work = await mkdtemp(join(tmpdir(), "hn-live-"));

let failures = 0;
const check = (ok, msg) => { console.log(`    ${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures += 1; };

// Everything a scope shows, read from the page
const snapshot = (tab) => tab.evaluate(() => window.hnLive.scopes.map((s) => ({
  id: s.id,
  live: s.el.hnLive && { ...s.el.hnLive, fullCode: s.el.hnLive.fullCode(), stats: undefined },
  shown: s.codeEls.map((c) => c.textContent).join("\n"),
  eqText: s.equationEls.flatMap((e) => [...e.querySelectorAll(".katex-mathml annotation")].map((a) => a.textContent)),
  changed: [...s.codeEls, ...s.equationEls].reduce((n, e) => n + e.querySelectorAll(".hn-changed").length, 0),
  error: s.status?.classList.contains("hn-live-error") ? s.status.textContent : "",
})));

// Run the full code in native R; return outputs and slot entries as R computes them
async function native(scope) {
  const outs = scope.live.outputs ?? [];
  const slots = Object.keys(scope.live.slots ?? {});
  const file = join(work, `${scope.id}.R`);
  await writeFile(file, [
    scope.live.fullCode,
    `source(${JSON.stringify(join(REPO, "lib/R/tex.R"))})`,
    ...outs.map((o) => `cat("out", format(as.numeric(${o}), digits = 15), sep = "\\t"); cat("\\n")`),
    ...slots.map((k) => {
      const m = k.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
      const [expr, digits] = m ? [m[1], m[2]] : [k, "4"];
      return `cat("slot", t(tex_entries(${expr}, ${digits})), sep = "\\t"); cat("\\n")`;
    }),
  ].join("\n"));
  const lines = execFileSync("Rscript", ["--vanilla", file], { encoding: "utf8" }).trim().split("\n");
  const rows = lines.map((l) => l.split("\t"));
  return {
    outs: rows.filter((r) => r[0] === "out").map((r) => r.slice(1).map(Number)),
    slots: rows.filter((r) => r[0] === "slot").map((r) => r.slice(1)),
  };
}

async function verify(tab, label, { expectChanged = [] } = {}) {
  console.log(`  after ${label}:`);
  for (const s of await snapshot(tab)) {
    if (!s.live) { check(false, `#${s.id} has a result`); continue; }
    check(!s.error, `#${s.id} no errors${s.error ? ": " + s.error : ""}`);
    check(s.shown === s.live.code, `#${s.id} shown code == code R ran`);
    const entries = Object.values(s.live.slots).flatMap((v) => v.entries);
    check(entries.every((e) => s.eqText.some((t) => t.includes(e))), `#${s.id} equations show R's values (${entries.join(", ")})`);
    if (expectChanged.includes(s.id)) check(s.changed > 0, `#${s.id} ${s.changed} changed value(s) highlighted`);
    if (s.live.outputs.length || entries.length) {
      const r = await native(s);
      const outsOk = s.live.outputs.every((o, i) => {
        const b = [s.live.state[o]].flat(), n = r.outs[i];
        return n && b.length === n.length && b.every((v, j) => Math.abs(v - n[j]) < 1e-9 * (1 + Math.abs(v)));
      });
      const slotsOk = Object.values(s.live.slots).every((v, i) => JSON.stringify(v.entries) === JSON.stringify(r.slots[i]));
      check(outsOk && slotsOk, `#${s.id} full code run in native R gives the same values`);
    }
  }
}

const browser = await chromium.launch();
try {
  for (const page of pages) {
    console.log(page);
    const tab = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    tab.on("pageerror", (e) => errors.push(e.message));
    tab.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await tab.goto(base + page + "?debug");
    await tab.waitForFunction(() => window.hnLive, null, { timeout: 60000 });
    await tab.evaluate(() => window.hnLive.idle());
    const stats = () => tab.evaluate(() => ({ ...window.hnLive.stats }));
    console.log(`  webR + R helpers loaded in ${((await stats()).initMs / 1000).toFixed(1)} s`);
    await verify(tab, "loading");

    // Drag each figure
    const figures = await tab.$$eval(".hn-live[data-figure]", (els) => els.map((e) => e.id));
    for (const id of figures) {
      const fig = tab.locator(`#${id}-figure`);
      await fig.scrollIntoViewIfNeeded();
      const before = await stats();
      const box = await fig.locator(".hn-pickers circle").first().boundingBox();
      const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
      await tab.mouse.move(x0, y0);
      await tab.mouse.down();
      for (let i = 1; i <= 120; i++) { await tab.mouse.move(x0 - i, y0); await tab.waitForTimeout(16); }
      await tab.mouse.up();
      await tab.evaluate(() => window.hnLive.idle());
      const after = await stats();
      const ms = after.runMs.slice(before.runMs.length);
      console.log(`  drag #${id}: ${after.requests - before.requests} changes, ${after.runs - before.runs} R runs; ` +
        `R time avg ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)} ms, max ${Math.max(...ms).toFixed(1)} ms`);
      await verify(tab, `dragging #${id}`, { expectChanged: [id] });
    }

    // Move each slider in steps, and check that every scope inside its owner reran
    const sliders = await tab.$$eval(".hn-live-slider input", (els) => els.length);
    for (let i = 0; i < sliders; i++) {
      const input = tab.locator(".hn-live-slider input").nth(i);
      await input.scrollIntoViewIfNeeded();
      const before = await stats();
      for (const v of [2.5, 3, 3.5, 4]) {
        await input.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
        await tab.waitForTimeout(16);
      }
      await tab.evaluate(() => window.hnLive.idle());
      const after = await stats();
      console.log(`  slider ${i + 1}: ${after.requests - before.requests} changes, ${after.runs - before.runs} R runs ` +
        `(last one ran ${after.lastScopes} scopes)`);
      const inside = await input.evaluate((el) => {
        const name = el.closest(".hn-live-slider").dataset.input;
        const owner = window.hnLive.scopes.find((s) => s.inputs.has(name) && s.blocks.some((b) => b.values()[name] !== undefined));
        const inside = (s) => { for (let p = s.parent; p; p = p.parent) if (p === owner) return true; return false; };
        return window.hnLive.scopes.filter((s) => inside(s) && s.figure).map((s) => s.id);
      });
      check(after.lastScopes >= 1 + inside.length, `slider reran its scope and the ${inside.length} figure scope(s) inside`);
      await verify(tab, `slider ${i + 1}`, { expectChanged: inside });
    }

    // Full code panel opens and shows the full code
    const firstButton = tab.locator(".hn-fullcode-button").last();
    await firstButton.scrollIntoViewIfNeeded();
    await firstButton.click();
    const panel = await tab.locator(".hn-fullcode:not([hidden]) code").first().textContent();
    check(panel.includes("spring_matrix <- function") || panel.length > 0, "full code panel opens");

    check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
    if (process.env.SHOTS) {
      const file = join(process.env.SHOTS, page.replace(/[/.]/g, "_") + ".png");
      await tab.screenshot({ path: file, fullPage: true });
      console.log(`  screenshot: ${file}`);
    }
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `${failures} check(s) failed` : "all checks passed");
process.exit(failures ? 1 : 0);
