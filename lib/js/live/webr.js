// One webR instance per page, shared by all live figures. Pinned to the same
// webR version quarto-live uses, so both routes run the same R.
import { WebR } from "https://webr.r-wasm.org/v0.6.0/webr.mjs";

let instance = null;

export function getWebR() {
  if (!instance) {
    instance = (async () => {
      const t0 = performance.now();
      const webR = new WebR();
      await webR.init();
      webR.hnInitMs = performance.now() - t0;
      return webR;
    })();
  }
  return instance;
}
