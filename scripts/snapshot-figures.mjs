// Draws figures in headless Chromium and saves them as PNG, for the PDF.
// Called by filters/live.lua (once per page) with JSON on stdin:
//   { root: "<project dir>", items: [{ file, figure, state, opts }, ...] }
// Each item is drawn by the figure module's own draw(svg, state, opts), with
// the book's pencil.css (light colors), so the PDF shows the same drawing as
// the web page.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const { chromium } = await import(join(here, "..", "node_modules", "playwright", "index.mjs"));

const input = JSON.parse(await new Promise((resolve) => {
  let s = "";
  process.stdin.on("data", (d) => { s += d; });
  process.stdin.on("end", () => resolve(s));
}));
const root = input.root;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/css/pencil.css">
<style>
  html, body { margin: 0; background: transparent; font-family: Roboto, "Helvetica Neue", Arial, sans-serif; }
  svg.hn-figure { margin: 0; width: 700px; }
</style></head><body><div id="fig"></div></body></html>`;

const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  if (path === "/" || path === "/index.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 400 }, deviceScaleFactor: 3 });
  for (const item of input.items) {
    await page.goto(base);
    await page.evaluate(async ({ figure, state, opts }) => {
      const { d3 } = await import("/lib/js/kit/index.js");
      const module = await import(`/lib/js/figures/${figure}.js`);
      const svg = d3.select("#fig").append("svg");
      module.draw(svg, state, opts);
      await document.fonts.ready;
    }, item);
    await page.locator("#fig svg").screenshot({ path: item.file, omitBackground: true });
    console.log(item.file);
  }
} finally {
  await browser.close();
  server.close();
}
