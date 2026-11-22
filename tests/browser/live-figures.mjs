// Browser check of the live figures in the built book (_book/).
//
//   quarto render && node tests/browser/live-figures.mjs [page ...]
//
// For every live figure on the given pages (default: demos/live-spring.html):
//  - waits for the first result from R,
//  - drags the figure's first handle in small steps, like a hand would,
//  - checks that the code shown is exactly the code R ran, that the equation
//    shows the values R formatted, and that changed values are highlighted,
//  - prints timings (webR load, R time per update, skipped updates).
// Screenshots go to $SHOTS (default: no screenshots).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("../../_book/", import.meta.url).pathname;
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

let failures = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures += 1; };

const browser = await chromium.launch();
try {
  for (const page of pages) {
    console.log(page);
    const tab = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    tab.on("pageerror", (e) => errors.push(e.message));
    tab.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await tab.goto(base + page + "?debug");

    const ids = await tab.$$eval(".hn-live", (els) => els.map((e) => e.id));
    check(ids.length > 0, `${ids.length} live figure(s)`);
    for (const id of ids) {
      const fig = tab.locator(`#${id}`);
      await tab.waitForFunction((id) => document.getElementById(id).hnLive, id, { timeout: 60000 });
      const first = await fig.evaluate((el) => el.hnLive.stats.initMs);
      console.log(` #${id}: webR + helpers loaded in ${(first / 1000).toFixed(1)} s`);

      // drag the first handle 2 m to the left in 120 small steps
      await fig.scrollIntoViewIfNeeded();
      const handle = fig.locator(".hn-pickers circle").first();
      const box = await handle.boundingBox();
      const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
      const before = await fig.evaluate((el) => el.hnLive.stats.sent);
      await tab.mouse.move(x0, y0);
      await tab.mouse.down();
      for (let i = 1; i <= 120; i++) {
        await tab.mouse.move(x0 - i, y0);
        await tab.waitForTimeout(16);
      }
      await tab.mouse.up();
      await tab.waitForFunction(({ id, before }) => {
        const live = document.getElementById(id).hnLive;
        return live.stats.sent > before && live.stats.sent === live.stats.evaluated + live.stats.skipped;
      }, { id, before }, { timeout: 10000 });
      await tab.waitForTimeout(100);

      const r = await fig.evaluate((el) => ({
        live: el.hnLive,
        shown: el.querySelector("pre code").textContent,
        eqText: [...el.querySelectorAll(".hn-live-eq .katex-mathml annotation")].map((a) => a.textContent),
        changed: el.querySelectorAll(".hn-changed").length,
        status: el.querySelector(".hn-live-status").textContent,
      }));
      check(r.shown === r.live.code, "shown code == code R ran");
      const x1 = r.live.state.x1;
      check(r.live.code.includes(`x1 <- ${x1}`), `code shows the dragged value x1 = ${x1}`);
      check(Math.abs(r.live.state.F - (-2 * (x1 - 2))) < 1e-9, `figure got F = ${r.live.state.F} from R`);
      const entries = Object.values(r.live.slots).flatMap((s) => s.entries);
      check(entries.every((e) => r.eqText.some((t) => t.includes(e))), `equation shows R's values (${entries.join(", ")})`);
      check(r.changed > 0, `${r.changed} changed value(s) highlighted`);
      const s = r.live.stats;
      const ms = s.evalMs.slice(-30);
      console.log(`  updates: ${s.sent} requested, ${s.evaluated} run, ${s.skipped} skipped; ` +
        `R time avg ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)} ms, max ${Math.max(...ms).toFixed(1)} ms`);
    }
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
