# Migration plan: Quarto + webR

This file lists the steps for moving the book to the new setup and tracks progress. The goals and design decisions behind it are in [CLAUDE.md](CLAUDE.md).

Status: `[ ]` to do · `[~]` in progress · `[x]` done · `[-]` dropped (with a reason).
Record finished steps in the **Log** at the bottom, with date and commit.

---

## Phase 0: Installation and tooling

Already on the dev machine: R 4.3.3, Node 18.19.1 (system), Python 3.
Everything is installed **in user space, without sudo**. The only possible exception is a missing system library for Playwright's Chromium (see 0.4).

- [x] **0.1 Install the Quarto CLI** from the release tarball (`quarto-<ver>-linux-amd64.tar.gz`, https://quarto.org/docs/download/). Unpack it to `~/opt/quarto-<ver>` and symlink `bin/quarto` into `~/.local/bin`. Check with `quarto check`. Record the version used, and pin the same version in CI.
  - Done: Quarto **1.11.9** in `~/opt/quarto-1.11.9`, linked as `~/.local/bin/quarto`. `quarto check` passes (R and knitr found; Quarto also found the system Chromium).
- [x] **0.2 Install a LaTeX engine for the PDF build**: `quarto install tinytex`, which installs into `~/.TinyTeX`. Missing LaTeX packages are installed automatically on the first PDF render.
  - Done: TinyTeX v2026.11.
- [x] **0.3 Pin R packages with `renv`** (decided). Run `renv::init()`, then install `knitr`, `rmarkdown`, `jsonlite`, `glue` and `testthat`, plus `Matrix` and `RTriangle` for later chapters. Use the Posit Package Manager repository, which provides precompiled Ubuntu binaries, so packages install quickly without needing system development libraries. Commit `renv.lock` so CI installs the same versions.
  - Done: dependencies are listed in `DESCRIPTION` (`Type: project`), and renv uses the `explicit` snapshot type, so `renv.lock` pins exactly those packages and their dependencies (61 packages, R 4.3.3).
  - `testthat` is under `Imports`, not `Suggests`, because renv skips `Suggests`.
  - `Matrix` was first pinned to 1.6-5 for R 4.3.3; unpinned after the R 4.6.2 upgrade.
- [x] **0.4 Set up Node tooling for PDF figure snapshots**: a `package.json` with `playwright` as a dev dependency, then `npx playwright install chromium`, which downloads into `~/.cache/ms-playwright`. If Chromium reports missing system libraries, `npx playwright install-deps` needs sudo; ask the author to run it. Node 18 works, but use Node 20 LTS in CI.
  - Done, with a change: Playwright 1.65 requires Node ≥ 20, so **Node 26.13.1 LTS** is installed in `~/opt/node-v26.13.1-linux-x64`. It is **not on `PATH`**, so the system Node 18 stays the default; for now use `export PATH=~/opt/node-v26.13.1-linux-x64/bin:$PATH`. `.node-version` says `26`, and CI uses the same version.
  - `playwright@1.65.1` is pinned exactly in `package.json`. Headless Chromium 159 is installed with no extra system libraries needed (no sudo).
  - Checked: headless Chromium renders the pencil `feTurbulence`/`feDisplacementMap` filter correctly at 3× scale.
- [x] **0.5 Add the quarto-live extension**: `quarto add r-wasm/quarto-live`. This commits it into `_extensions/`. Record the extension version and the webR version it loads.
  - Done: quarto-live **v0.2.0** (released 2026-05-22; its `_extension.yml` still says `0.1.3-dev`). It loads **webR v0.6.0**, which runs **R 4.6.0** in the browser. webR v0.6.1 (2026-11-10) exists and can be selected with the `engine-url` option, but keep the version quarto-live was released with unless there's a reason to change.
  - Later **removed** (2.8): the book uses plain webR 0.6.0 directly.
- [x] **0.6 Write a short "Getting started" section in `README.md`** with the commands above and how to preview (`quarto preview`) and build.
- [x] **0.7 Update `CLAUDE.md`**: replace the MkDocs commands and conventions with the Quarto ones (repeat whenever the conventions change). Done in Phase 1.
- [x] **0.8 `.gitignore`**: `sandbox/`, Quarto output (`_book/`, `.quarto/`), PDF intermediates (`_figstate/`, `_figs/`), `node_modules/`.

## Phase 1: Move the project to Quarto

Planned layout (adjust in this step if needed):

```
_quarto.yml            book config (HTML + PDF), KaTeX, theme
index.qmd              preface
math/ basics/ fdm/ fem/ fvm/ lbm/   chapters (.qmd)
assets/                css, images, svg defs, favicon
lib/js/                figure kit + webR bridge (ES modules)
lib/R/                 R helpers (tex_body, …)
filters/               Lua filters (KaTeX macros, live figures)
scripts/               PDF snapshot and build scripts
tests/                 R helper tests (testthat), browser checks (Playwright)
sandbox/               old prototypes, not rendered, git-ignored
```

The old MkDocs version is kept on the `legacy` branch (pushed to origin). This work happens on the `rewrite` branch.

- [x] **1.1 Create `_quarto.yml`** with `project: type: book`: title, author, `site-url` (https://www.hello-numerics.com/), repo link, an "edit this page" link, chapters in the order from CLAUDE.md, and the output directory `_book/`.
  - Done. Only `.qmd` files are rendered (`sandbox/`, `renv/`, `node_modules/` excluded). Chapters: Preface, Mathematical background, Solving problems numerically, FDM, FEM, FVM, LBM. "Edit this page" points to `master`, so it only works after merging.
- [x] **1.2 HTML format**: `html-math-method: katex`, a light/dark theme pair, code copy buttons, the favicon, and the paper background (`craft.png`) through a custom SCSS/CSS file.
  - Done. Bootswatch `cosmo`/`darkly` plus `assets/css/theme-{light,dark}.scss` (Roboto fonts, teal links). `assets/css/paper.css`: the content column is a kraft-paper card on wide screens and the whole page is paper on narrow ones; dark mode darkens the paper with `background-blend-mode: multiply`. Checked with screenshots: light/dark × desktop/phone, no console errors.
- [x] **1.3 KaTeX macros**: define `\mat` and other shared macros once, in a KaTeX config include for HTML and a LaTeX preamble include for PDF, so both formats understand the same macros. Remove the per-page `\newcommand`s.
  - Done for HTML: KaTeX pinned to **0.19.1** (Quarto would load `katex@latest`). Macros live only in `assets/tex/macros.tex`. `filters/macros.lua` embeds the file in each page, and `assets/js/katex-setup.html` wraps `katex.render` so every render (including Quarto's later typesetting) gets the macros and `trust` for `\htmlClass`. Checked: `\mat` renders. The PDF part is in Phase 4.
- [x] **1.4 Convert pages from `.md` to `.qmd`**: `index`, `math`, `basics`, `fdm`, `fem`, `fvm`, `lbm` (mostly placeholders). Convert the tabbed code samples in `index.md` to Quarto `::: {.panel-tabset}`.
  - Done: `index.qmd` (with `panel-tabset`) and placeholder chapters with a short note on what each will cover. The old springs page isn't converted here; it is rebuilt in Phase 3.
- [x] **1.5 Move the prototypes** (`basics/*.html`, `test.md`, `test2.md`, `lit.md`, `rpdf.html`, `test.R`) to `sandbox/` for local reference. Add `sandbox/` to `.gitignore` and exclude it from rendering. In git they are deleted on `rewrite`; the originals stay on `legacy`.
  - Done: the whole old `docs/` tree and `mkdocs.yml` are in `sandbox/legacy-docs/`, and `test.R` is in `sandbox/`.
- [x] **1.6 Webr package image**: decide whether the custom `vfs/` library image is still needed. quarto-live can install packages from repo.r-wasm.org. If it is needed, move it to `assets/vfs/` and document how it is rebuilt.
  - Done, **dropped**: repo.r-wasm.org has `Matrix` 1.7-6 and `RTriangle` 1.6-0.15, the same versions as `renv.lock`, so webR installs them directly and browser and native R use identical package versions.
- [x] **1.7 Check that `quarto render` (HTML) works locally** and the site looks right in light and dark mode.
  - Done: renders without warnings.
- [x] **1.8 Remove `mkdocs.yml` and the old `docs/` tree** once nothing still needs them. Keep the `CNAME` for the custom domain, if one is used.
  - Done: `docs/` and `mkdocs.yml` removed; `craft.png` and `favicon.ico` moved to `assets/img/`. `CNAME` waits for the hosting decision.

## Phase 2: Shared libraries and assets

- [x] **2.1 Color palette**: `assets/css/pencil.css` defines the pen colors as CSS variables (`--hn-pen0` …) with light and dark variants. Dark mode is tied to Quarto's dark theme (the `.quarto-dark` body class), not Material variables. The same colors are used to highlight quantities in code and equations.
  - Done: `assets/css/pencil.css`. Roles: pen0 ink, pen1 bodies (walls, people), pen2 springs/elements, pen3 forces. The light colors are darker than the old ones for contrast on kraft paper (the old yellow pen3 became blue). `.hn-q-pen*` classes color quantities in code and equations; `.hn-changed` flashes a changed value. The colors are placeholders for the author to tune.
- [x] **2.2 SVG defs**: move the pencil-texture filters and arrow markers from `springs.md` into `assets/svg/defs.svg`. A JS helper `ensureDefs()` puts them on the page once, and figures reference them by id.
  - Watch out: with the default `filterUnits="objectBoundingBox"`, a filter applied to a perfectly horizontal or vertical line has a zero-size region, and **the line disappears**. Apply filters to groups, or use `filterUnits="userSpaceOnUse"` (found while testing in 0.4).
  - Done, as a JS module rather than an `.svg` file: `lib/js/kit/defs.js` (a synchronous insert, which also works in the headless PDF snapshot). Ids: `hn-pencil` (old pencilTexture4), `hn-head`, `hn-head-open`, `hn-hatch`.
- [x] **2.3 Figure kit** `lib/js/kit/`: drawing primitives as ES modules (stick figure "guy", spring, wall, node, force arrow, dimension line) and drag helpers (dragging along x/y only, snapping). Each figure exports `draw(svg, state)` and `interact(svg, state, onChange)`.
  - Done: `lib/js/kit/` (`d3.js` pins **D3 7.9.2** in one place; `shapes.js`: guy, wall, springPath, arrow; `drag.js`: pickers via d3.drag, mouse and touch). First figure: `lib/js/figures/spring1.js` (`draw(svg, state)` + `interact(svg, state, onChange)`; never computes physics).
- [x] **2.4 webR bridge** `lib/js/live/bridge.js`:
  - Run a snippet with the given inputs, return the named list as JavaScript data via `toJs()`.
  - Throttle while dragging: one evaluation at a time, and only the latest pending state runs next.
  - A debug overlay, turned on with `?debug` in the URL, showing webR load time, the R evaluation time per update (last/average/max), and how many intermediate drag states were skipped.
  - Done: plain webR 0.6.0 (`webr.js`: one instance per page, loads `lib/R/tex.R` into R's global environment, installs packages once). Each figure runs in its own environment; outputs and equation slots come back in one R call. `?debug` shows the timings under each figure. Measured (headless, desktop): webR ready in 1.4 s, R ~15 ms per update, 0 of 121 drag states skipped.
- [x] **2.5 Live code**: rewrite the input literals in the shown snippet (`x1 <- 1.35`), finding them with R's `getParseData()`, and run exactly the displayed text. Color the inputs and highlight values that just changed.
  - Done: `livecode.js`. Negative literals (`x1 <- -3`) are handled. Changed values get a highlight that fades over 1 s (`changes.js` + `.hn-changed` in `pencil.css`; it stays lit while dragging and continues smoothly across re-renders). Colors and duration are CSS variables (`--hn-changed-bg`, `--hn-changed-fade`).
- [x] **2.6 Live equations** `lib/js/live/liveeq.js` + `lib/R/tex.R`: fill `{{expr}}` slots (with an optional digits setting such as `{{x|3}}`) using `tex_body()` evaluated in R, and render with KaTeX (with `trust` on, for `\htmlClass`). Use the same `tex_body()` in native R for the PDF.
  - Done: `tex.R` has `tex_number`, `tex_entries`, `tex_body`, `tex_fill` (for the PDF) and the slot parser; tested in `tests/testthat/test-tex.R`. In the browser, R formats every entry and JavaScript only joins them, so each matrix entry is highlighted separately when it changes. KaTeX loading: the live equation starts as placeholder math, which makes Quarto load KaTeX.
- [x] **2.7 Authoring interface**: one Quarto shortcode or filter (e.g. `{{< live-figure springs >}}`) that ties together the figure module, the snippet chunk and the equation templates, and outputs the right content for HTML or PDF.
  - Done: a div `::: {.live-figure figure="spring1"}` around an ```` ```r ```` snippet and `$$…{{expr}}…$$` equations (`filters/live.lua` → `lib/js/live/mount.js`). The figure module declares `inputs`, `outputs` and `colors`. Non-HTML output gets the snippet and the equations with `?` for now (Phase 4). (Superseded by 2.9: `.live` scopes and `page.js`.)
  - Automated check: `tests/browser/live-figures.mjs` (serves `_book/`, drags every live figure, checks shown code = run code, figure and equation values = R's, highlight present, no page errors).
  - Known limitation: numbered live equations (`$$ … $$ {#eq-…}`) are not supported yet.
- [x] **2.9 Nested live scopes, sliders, full code** (asked by the author after 2.7):
  - `::: {.live}` scopes nest; an inner scope's R environment has the outer one's as parent. Changing an input reruns its scope and everything inside it (fresh environments, parents first, one R call); changing an inner input reruns only that scope.
  - `::: {.live-slider input="k" …}` anywhere on the page (e.g. at the end of a section: "now change the spring everywhere").
  - Hidden blocks (`{.r .hidden}`) and a **Full code** button on every shown block, giving runnable code for plain R (enclosing scopes + own, current values, `install.packages` hint for packages webR had to install). Packages come from `library()` calls (the `packages` attribute is gone).
  - Replaces `bridge.js`/`mount.js` with `page.js`, `slider.js`, `fullcode.js`; R side in `lib/R/live.R`.
  - Tested: `tests/browser/live-figures.mjs` drags each figure and moves each slider; checks shown = run code, equation values, highlights, and that each figure's full code run in native R gives the browser's values. Headless desktop: ~10 ms per R run.
- [x] **2.8 First evaluate quarto-live's own reactivity** (OJS `input`/`define` options on webR cells) on a small example. **Author decides after this step.** Prepare:
  - a demo page in `sandbox/` with a draggable point feeding a quarto-live webR cell, showing what it can and can't do (live literals in code? redrawing equations? latency?);
  - a short written comparison: quarto-live's reactivity vs. our own bridge on plain webR.

  Record the decision here; steps 2.4–2.5 build on it.

  **Demos built** (book part "Development demos"; same figure and snippet in both):
  - `demos/quarto-live.qmd`: **A**, quarto-live only (OJS view → `{webr}` cell with `input`/`define` → OJS redraw + KaTeX; an interpolated block shows the code with the value).
  - `demos/own-bridge.qmd`: **B**, own bridge on plain webR 0.6.0 (`lib/js/live/`: `webr.js`, `bridge.js`, `livecode.js`, `liveeq.js`).

  **Measured** (headless Chromium on the desktop, 120 drag events at ~60/s, 2 runs each):

  | | A: quarto-live | B: own bridge |
  |---|---|---|
  | first R result after page load | 5.8–6.4 s (webR + knitr and its dependencies) | 1.9 s |
  | updates during the drag | 104 of 120 results; every event queued | all 121 evaluated, none needed skipping |
  | lag behind the hand | avg 130–140 ms, max ~360 ms | R time 5–6 ms avg, max 9 ms |
  | shown code = executed code | no: the interpolated block is a second copy | yes, by construction (same token list) |
  | values in the equation | formatted in JavaScript | formatted by R (`{{expr}}` slots) |

  **quarto-live pitfalls found:**
  1. `define` works only with `edit: false` (editable cells never pass values back).
  2. Values arrive as arrays (`[-2]`).
  3. It needs `knitr` in webR, an extra download.
  4. Interpolation skips one-letter names (`${x}`), because its pattern requires two or more characters.
  5. Without placeholders, OJS cells show "is not defined" errors until R has loaded.
  6. In a book, `format: live-html` on a page is ignored; enable it with `filters: [.../live.lua]` + `ojs-engine: true`, and repeat the book-wide filters, since a page's `filters` replace them.
  7. No throttling: every drag position is queued in R.

  quarto-live's strengths: editable exercise cells (readers change code and rerun it), grading, Pyodide support, and it is maintained by the webR author.

  **Decision (author): B, own bridge; quarto-live removed completely.** Reasons: speed, and more control over the R environment. No editable snippets are planned for now; if they are wanted later, decide then between a custom implementation and quarto-live. Demo A and `_extensions/r-wasm/live` were removed; demo B became `demos/live-spring.qmd`.

## Phase 3: Springs showcase (`fem/springs.qmd`)

- [ ] **3.1 Text**: Hooke's law, force balance at both ends, the 2×2 stiffness matrix, then assembly for a chain of springs. Math rendered with KaTeX.
- [ ] **3.2 Single-spring figure with live values**: dragging the end node updates the R snippet (live literals), the equation `K u = F` (slots `{{K}}`, `{{u}}`, `{{F}}`) and the force arrows. Colors match across figure, code and equation.
- [ ] **3.3 Chain of springs figure**: R assembles `K` and solves it; the figure shows displacements and reaction forces. Plain "snippet + figure" (no live literals).
- [ ] **3.4 PDF version**: two or three fixed states shown side by side, plus a link to the live page.
- [ ] **3.5 Automated checks (Claude)**: Playwright script against `quarto preview` that loads the page, waits for webR, simulates drags, and checks that the code, equation and figure all show the same values as R. It records timings: webR load, evaluation time per drag, skipped states. Also screenshots in light/dark mode and at phone width.
- [ ] **3.6 Manual check (author)**: Claude runs `quarto preview` in the background (live reload at `http://localhost:<port>`); the author drags with a real mouse (and a touchscreen, if available), with `?debug` on for timings. The author's feedback goes to the Log below and turns into fixes. Repeat until dragging feels right.

## Phase 4: PDF build

- [ ] **4.1 PDF format** in `_quarto.yml`: book class, the shared macro preamble, code highlighting, and `downloads: [pdf]` so the website links to the PDF.
- [ ] **4.2 Figure states**: R chunks write each figure's chosen state(s) to `_figstate/<figure>.json` during the render.
- [ ] **4.3 `scripts/snapshot-figures.mjs`**: Playwright opens a minimal page, calls the figure's `draw(svg, state)` for each state, and saves the result as PDF/SVG to `_figs/`. Use a headless browser so the SVG filters render correctly.
- [ ] **4.4 `scripts/build-pdf.sh`**: run the R state export, then the snapshots, then `quarto render --to pdf`. Make it idempotent and runnable locally.
- [ ] **4.5 Choose the content per format** with `content-visible when-format=…`, wrapped in the shortcode from 2.7.
- [ ] **4.6 Check** that the PDF renders, figures look right (including the pencil effect), and code, equations and figures show the same numbers.

## Phase 5: GitHub Actions

- [ ] **5.1 Snippet tests**: `tests/` uses testthat to extract every R snippet from the `.qmd` files and run it in native R, with checks on the results where useful (e.g. `K %*% u ≈ F`). Runnable locally with `Rscript tests/run.R`.
- [ ] **5.2 Workflow `.github/workflows/book.yml`** running on push and pull requests:
  1. Check out the repo; set up R (`r-lib/actions/setup-r` + `setup-renv`), Quarto (`quarto-dev/quarto-actions/setup`, pinned version), TinyTeX and Node + Playwright Chromium, with caching.
  2. Run the snippet tests (5.1).
  3. Build the PDF (`scripts/build-pdf.sh`).
  4. Render the HTML site, with the PDF linked through `downloads`.
  5. Upload `_book/` as a build artifact (and the PDF separately for easy download).
- [ ] **5.3 Deployment**: undecided between Netlify (with the custom domain) and GitHub Pages (`*.github.io`). Write the GitHub Pages job (`actions/upload-pages-artifact` + `actions/deploy-pages`) **commented out**, with a note on the Netlify alternative. Netlify can set the cross-origin isolation headers itself through `_headers`, while GitHub Pages would need `coi-serviceworker`. Keep the build output host-neutral (no hard-coded domain beyond `site-url`).
- [ ] **5.4 Optional smoke test**: Playwright opens the rendered springs page and checks that webR loads and a drag updates the equation.

## Phase 6: Later (not part of this migration)

- [ ] Write the content chapters (math → iterative methods → FDM → FEM → FVM → LBM).
- [ ] Iterative-method figures with iteration history and highlighting of changed entries.
- [ ] Enable deployment, and decide on `coi-serviceworker` for cross-origin isolation.

---

## Decisions

- [x] **R package pinning**: use `renv`.
- [x] **Old prototypes**: move to `sandbox/` for local reference, git-ignored and never committed; the originals stay on the `legacy` branch.
- [x] **Git**: commit to the `rewrite` branch. Commits are authored by Claude, and the message states the work was done under L Laniewski-Wollk's direction.
- [x] **quarto-live reactivity vs. own bridge**: own bridge on plain webR; quarto-live removed (2.8).
- [x] **R version**: native R upgraded to **4.6.2** by the author (CRAN repository plus r2u). `Matrix` is unpinned (now 1.7-6), `renv.lock` records R 4.6.2, and `quarto check` passes.
- [x] **Node on `PATH`**: use Node 26 globally (decided). The symlink `~/opt/node` → `~/opt/node-v26.13.1-linux-x64` is in place (for a future upgrade, only the symlink changes). The author added `export PATH="$HOME/opt/node/bin:$PATH"` to `~/.bashrc`.
- [ ] **Hosting**: Netlify with the custom domain vs. GitHub Pages on `github.io`. The author decides later; this also settles `CNAME` and the cross-origin isolation headers.

## Log

| Date | Step | Notes / commit |
|---|---|---|
| 2026-11-22 | — | Plan written; decisions on renv, sandbox, git and testing recorded |
| 2026-11-22 | Phase 0 | Tools installed (Quarto 1.11.9, TinyTeX, renv, Node 26 + Playwright 1.65.1, quarto-live v0.2.0 / webR 0.6.0). Open: native R 4.3.3 vs. webR's R 4.6.0. Matrix pinned to 1.6-5 because of the old R. |
| 2026-11-22 | Phase 0 follow-up | R 4.6.2 installed by the author; renv.lock refreshed (Matrix 1.7-6). Node 26 on `PATH` globally. |
| 2026-11-22 | Phase 1 | Quarto book in place: config, themes, kraft paper, KaTeX 0.19.1 with shared macros, placeholder chapters. MkDocs tree removed (copy in `sandbox/`). Custom webR package image dropped. Remote preview over Tailscale tested with the author's phone. |
| 2026-11-22 | Phase 2 (2.1–2.3, 2.8) | Palette, SVG defs, D3 kit and first figure done. Demos A (quarto-live) and B (own bridge) built and measured; decision pending. Found: only book chapters belong to a Quarto book project, so demos are a temporary book part. |
| 2026-11-22 | Phase 2 (2.4–2.8) | Author chose the own bridge; quarto-live removed. Bridge, live code with fading highlight, `tex.R` + live equations, `.live-figure` filter, R tests and browser check done. Fixed stale renv sandbox links left by the R upgrade. |
| 2026-11-22 | 2.9 | Nested live scopes, sliders, hidden blocks and "Full code" (checked against native R). Highlight fade shortened to 1 s. |
