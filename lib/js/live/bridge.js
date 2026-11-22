// Runs a live snippet in webR as inputs change.
//
// - The shown snippet is exactly the code that runs (livecode.js).
// - One evaluation at a time. While R is busy, only the latest requested
//   state is kept; intermediate drag positions are skipped, so R never falls
//   behind the reader's hand.
// - The code runs in its own R environment. After each run, one R call reads
//   back the figure's outputs (as numbers) and the equation slots (formatted
//   by tex_entries() from lib/R/tex.R).
import { getWebR, installPackages } from "./webr.js";
import { createLiveCode } from "./livecode.js";

const rString = (s) => JSON.stringify(s);   // JSON string escapes are valid in R

export async function createBridge({ codeEl, inputs, colors, outputs = [], slots = [], packages = [], onResult }) {
  const webR = await getWebR();
  const stats = { initMs: webR.hnInitMs, sent: 0, evaluated: 0, skipped: 0, evalMs: [] };
  if (packages.length) {
    const t0 = performance.now();
    await installPackages(webR, packages);
    stats.packagesMs = performance.now() - t0;
  }
  const env = await webR.evalR("new.env(parent = globalenv())");
  const code = await createLiveCode(webR, codeEl, { inputs, colors });

  // One R expression reading back everything the page shows
  const readBack = `list(
    outputs = list(${outputs.map((o) => `as.numeric(${o})`).join(", ")}),
    slots = list(${slots.map((s) => `.hn_slot(${rString(s.expr)}, ${s.digits ?? "NULL"}, environment())`).join(", ")})
  )`;

  let busy = false, pending = null;

  async function run(values) {
    if (busy) {
      if (pending) stats.skipped += 1;
      pending = values;
      return;
    }
    busy = true;
    const src = code.set(values);          // shown text == executed text
    const t0 = performance.now();
    const result = { error: null, code: src, outputs: {}, slots: {} };
    try {
      await webR.evalRVoid(src, { env });
      const out = await webR.evalR(readBack, { env });
      try {
        const js = await out.toJs();
        const [o, s] = js.values;
        outputs.forEach((name, i) => {
          const v = o.values[i].values;
          result.outputs[name] = v.length === 1 ? v[0] : v;
        });
        slots.forEach((slot, i) => {
          const v = s.values[i].values;
          result.slots[slot.key] = { nrow: Number(v[0]), ncol: Number(v[1]), entries: v.slice(2) };
        });
      } finally {
        await webR.destroy(out);
      }
    } catch (e) {
      result.error = e.message;
    }
    stats.evaluated += 1;
    stats.evalMs.push(performance.now() - t0);
    busy = false;
    onResult(result, stats);
    if (pending) { const next = pending; pending = null; run(next); }
  }

  return {
    run: (values) => { stats.sent += 1; return run(values); },
    values: code.values,
    stats,
    webR,
  };
}
