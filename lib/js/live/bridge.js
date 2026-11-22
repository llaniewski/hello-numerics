// Runs a live snippet in webR as inputs change.
//
// - One evaluation at a time. While R is busy, only the latest requested
//   state is kept; intermediate drag positions are skipped, so R never falls
//   behind the reader's hand.
// - The code runs in its own R environment; results are read back from it.
// - Equation slots {{expr}} are evaluated and formatted in R.
import { getWebR } from "./webr.js";
import { createLiveCode } from "./livecode.js";

export async function createBridge({ codeEl, inputs, colors, slots = [], onResult }) {
  const webR = await getWebR();
  const env = await new webR.REnvironment({});
  const code = await createLiveCode(webR, codeEl, { inputs, colors });
  const stats = { initMs: webR.hnInitMs, sent: 0, evaluated: 0, skipped: 0, evalMs: [] };

  // R expression for formatting the slots: a named character vector
  const slotExpr = slots.length
    ? `vapply(c(${slots.map((s) => JSON.stringify(s)).join(", ")}), function(e) {
         v <- eval(parse(text = e))
         if (is.numeric(v)) format(signif(v, 4)) else as.character(v)
       }, "")`
    : null;

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
    let result = { error: null, slots: {} };
    try {
      await webR.evalRVoid(src, { env });
      if (slotExpr) {
        const out = await webR.evalR(slotExpr, { env });
        const js = await out.toJs();
        await webR.destroy(out);
        js.names.forEach((n, i) => { result.slots[n] = js.values[i]; });
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

  return { run: (values) => { stats.sent += 1; run(values); }, stats, code, webR };
}
