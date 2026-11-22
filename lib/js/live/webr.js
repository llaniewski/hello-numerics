// One webR instance per page, shared by all live figures.
// webR 0.6.0 runs R 4.6.0 (native R for the PDF build: 4.6.x).
import { WebR } from "https://webr.r-wasm.org/v0.6.0/webr.mjs";

let instance = null;
const installed = new Map();

// Starts webR (once) and loads the R side of the runtime (lib/R/tex.R and
// lib/R/live.R) into the global environment.
export function getWebR() {
  if (!instance) {
    instance = (async () => {
      const t0 = performance.now();
      const webR = new WebR();
      await webR.init();
      for (const file of ["tex.R", "live.R"]) {
        const res = await fetch(new URL(`../../R/${file}`, import.meta.url));
        if (!res.ok) throw new Error(`cannot load lib/R/${file} (${res.status})`);
        await webR.evalRVoid(await res.text());
      }
      webR.hnInitMs = performance.now() - t0;
      return webR;
    })();
  }
  return instance;
}

// Installs the packages that aren't available yet from repo.r-wasm.org
// (once per page). Returns the names that had to be installed: these are the
// ones a reader may need to install too.
export async function installPackages(webR, packages) {
  const todo = packages.filter((p) => !installed.has(p));
  if (todo.length) {
    const missing = await (await webR.evalR(".hn_missing_packages(pkgs)", { env: { pkgs: todo } })).toJs();
    const names = missing.values ?? [];
    const job = names.length ? webR.installPackages(names, { quiet: true }) : Promise.resolve();
    for (const p of todo) installed.set(p, job.then(() => names.includes(p)));
  }
  const flags = await Promise.all(packages.map((p) => installed.get(p)));
  return packages.filter((_, i) => flags[i]);
}
