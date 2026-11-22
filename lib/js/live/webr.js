// One webR instance per page, shared by all live figures.
// webR 0.6.0 runs R 4.6.0 (native R for the PDF build: 4.6.x).
import { WebR } from "https://webr.r-wasm.org/v0.6.0/webr.mjs";

let instance = null;
const installed = new Map();

// Starts webR (once) and loads the shared R helpers (lib/R/tex.R) into the
// global environment.
export function getWebR() {
  if (!instance) {
    instance = (async () => {
      const t0 = performance.now();
      const webR = new WebR();
      await webR.init();
      const helpers = await fetch(new URL("../../R/tex.R", import.meta.url));
      if (!helpers.ok) throw new Error(`cannot load lib/R/tex.R (${helpers.status})`);
      await webR.evalRVoid(await helpers.text());
      webR.hnInitMs = performance.now() - t0;
      return webR;
    })();
  }
  return instance;
}

// Installs packages from repo.r-wasm.org (once per page). The snippet still
// calls library() itself, so the shown code is complete.
export function installPackages(webR, packages) {
  return Promise.all(packages.map((p) => {
    if (!installed.has(p)) installed.set(p, webR.installPackages([p], { quiet: true }));
    return installed.get(p);
  }));
}
