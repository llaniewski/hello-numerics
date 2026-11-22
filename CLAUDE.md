# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Hello Numerics" is an open-source, interactive book on numerical methods for engineering. It's a **Quarto book** (`_quarto.yml`), with in-browser R through **webR** and the **quarto-live** extension, published at https://www.hello-numerics.com/ (hosting not decided yet: Netlify or GitHub Pages).

The project is at an **early stage**: the chapters are placeholders, and the interactive-figure machinery is still being built. The old MkDocs version is on the `legacy` branch.

### Planned content (in reading order)

1. **Math background**: only the linear algebra and calculus needed later (`math/`).
2. **Numerical methods for solving problems**: mainly iterative methods (`basics/`).
3. **Finite Difference Method** (`fdm/`).
4. **Finite Element Method** (`fem/`). `fem/springs.qmd` (spring systems → stiffness matrix) will be the first real page and the showcase of the setup.
5. **Finite Volume Method** (`fvm/`).
6. **Lattice Boltzmann Method** (`lbm/`), possibly.

### Core design goal: the code shown and the code run are the same

- Figures are **interactive**: readers drag, push or draw elements (masses, springs, nodes, meshes…), and the figure updates.
- Each figure comes with a **code snippet showing what is computed**. The same snippet text is what actually computes the figure's values in the browser. It must never be a hand-maintained copy. This guarantees the snippet matches what's on screen exactly.
- Numerics run in an **established numerical language**, not hand-rolled JavaScript numerics. JavaScript (D3) only handles drawing and interaction.
- The language is currently **R, executed in the browser via webR**, because the author knows it well. Python via Pyodide is an option still under consideration. Keep the JS↔language bridge language-agnostic where practical.
- In a few small introductory examples, the values the reader changes by dragging should also update **live inside the shown R snippet and in the LaTeX equations**, so it's clear exactly which quantities change. This matters a lot to the author. It's meant for a few examples only, not every figure.
- The author builds these figures, so the authoring workflow (defining a figure plus its snippet) should stay simple and repeatable.

### Math rendering: KaTeX everywhere (decided)

- Switch from MathJax to **KaTeX for all math**, both static and live. KaTeX renders synchronously and quickly, so equations can be redrawn on every drag. Equation numbering and cross-references come from the site generator (Quarto's `{#eq-…}`), not from the math engine. PDF output uses real LaTeX, so this choice only affects HTML.
- Keep to LaTeX that KaTeX supports. Define shared macros (e.g. `\mat`) once in the KaTeX `macros` config, not per page.

### Live equation templates: values come from R

- Equations can contain **slots** `{{expr}}`, where `expr` is evaluated **in R**, in the snippet's environment after it runs. Typically `expr` is a variable name, but it can be any R expression.
- A slot expands to the **body** of a LaTeX matrix or vector, so the template keeps the surrounding LaTeX readable:
  ```latex
  \left[\begin{matrix}{{A}}\end{matrix}\right] x = \left[\begin{matrix}{{b}}\end{matrix}\right]
  \quad\Rightarrow\quad x = \left[\begin{matrix}{{x}}\end{matrix}\right]
  ```
  A matrix becomes rows joined by `\\` and entries by `&`, **row by row**, even though R stores matrices column by column. A vector becomes a column (`0.12 \\ 0.23`), and a scalar a single number.
- **Formatting is done by an R helper** (e.g. `tex_body(x, digits)`). The same helper fills the templates in the browser (webR) and in the PDF build (native R), so both show identical numbers.
- For iterative methods, the snippet returns the iteration history, and the template shows iteration `k` (e.g. `x^{({{k}})}`) as the reader scrubs or animates. Entries that changed from the previous step can be highlighted (the helper wraps them in KaTeX `\htmlClass`, which requires KaTeX's `trust` option).

The old prototypes (D3 stick figures, webR experiments, the hand-drawn springs page) are in `sandbox/legacy-docs/` for reference; `sandbox/legacy-docs/fem/springs.md` is the reference for the pencil look and drawing helpers.

## Migration in progress

The move to Quarto + webR + quarto-live is tracked step by step in [plan.md](plan.md). Read it before starting work, and update its checkboxes and Log when finishing a step.

## Git conventions

- Work on the `rewrite` branch. The old MkDocs version is kept on `legacy`; don't commit to it.
- Commits are authored by Claude (`--author="Claude <noreply@anthropic.com>"`). The commit message ends with a line stating the work was done under the author's direction: `Done under the direction of L Laniewski-Wollk.`
- `sandbox/` holds old prototypes for local reference only. It is git-ignored; never commit it.

## Tooling (new setup)

- **Quarto 1.11.9** at `~/.local/bin/quarto`; TinyTeX for the PDF.
- **R packages** via `renv`: dependencies are listed in `DESCRIPTION`, renv uses the `explicit` snapshot type, and `renv.lock` pins the versions. To add a package: add it to `DESCRIPTION`, run `renv::install()`, then `renv::snapshot()`. Local R is 4.6.2 (from CRAN's Ubuntu repository plus r2u); webR runs R 4.6.0, the same minor version.
- **Node 26** is on `PATH` through `~/opt/node/bin`, set in the author's `~/.bashrc`. `~/opt/node` is a symlink to `~/opt/node-v26.13.1-linux-x64`; the system Node 18 is too old for Playwright. Non-interactive shells may not read `.bashrc`; if `node --version` isn't 26, run `export PATH=$HOME/opt/node/bin:$PATH` first. Playwright 1.65.1 (pinned) with headless Chromium.
- **quarto-live v0.2.0** is committed in `_extensions/r-wasm/live`; it loads webR v0.6.0, which runs R 4.6.0 in the browser. Don't edit the extension's files; update it with `quarto add r-wasm/quarto-live@<tag>`.
- Node scripts in the scratchpad must import Playwright by absolute path (`<repo>/node_modules/playwright/index.mjs`), because ES modules resolve packages relative to the script's location.

## Commands

```bash
quarto preview                 # live-reload preview on localhost
quarto render                  # build the HTML book into _book/
Rscript -e 'renv::restore()'   # install the pinned R packages
npm ci                         # install Playwright (then: npx playwright install chromium)
```

To let the author test on their phone, serve on the Tailscale interface only (computer `big-desktop`, 100.109.112.73), never on all interfaces:

```bash
quarto preview --host 100.109.112.73 --port 4321 --no-browser
# phone: http://big-desktop.tail49f720.ts.net:4321
```

Screenshots for checking layout: a Playwright script against a local server, in light and dark mode (Quarto's dark mode: set `localStorage['quarto-color-scheme'] = 'alternate'` before loading) and at phone width (390 px). Send screenshots to the author with SendUserFile; they often follow along on their phone.

## Architecture / conventions

- **Chapters** are listed in `_quarto.yml` under `book.chapters`, one folder per chapter (`math/`, `basics/`, …, each with `index.qmd`). In a Quarto *book*, **only the listed chapters are project files**: any other `.qmd`, even in the project folder, renders as a standalone document next to its source (wrong output location, no book settings, project extensions not found). So every page, including demos, must be listed in `book.chapters`. `demos/` is a temporary "Development demos" part.
- **Figures and live code** live in `lib/js/` (served as-is through `project.resources`):
  - `kit/`: shared D3 drawing kit; `kit/d3.js` is the one place where the D3 version (7.9.2) is pinned.
  - `figures/`: one module per figure, exporting `draw(svg, state)` and `interact(svg, state, onChange)`. Figures never compute physics; values come from R.
  - `live/`: webR bridge prototype (`webr.js` pins webR 0.6.0, `bridge.js`, `livecode.js`, `liveeq.js`).
  - Pages import these with relative paths (`../lib/js/...`).
- **quarto-live on a page**: in a book, a page's `format: live-html` is ignored, so pages enable it with `filters: [../filters/macros.lua, ../_extensions/r-wasm/live/live.lua]` and `ojs-engine: true`. Repeat `macros.lua`, because a page's `filters` replace the book-wide list. Use `engine: markdown` on pages without native R chunks (otherwise Quarto picks Jupyter); pages with native R chunks need quarto-live's `_knitr.qmd` include. Further pitfalls are listed in plan.md, step 2.8.
- Quarto styles the direct children of a code block as lines (`pre > code.sourceCode > span`). Code re-rendered from JavaScript must wrap its token spans in one wrapper span, or the token colors are lost.
- **Themes**: Bootswatch `cosmo` (light) and `darkly` (dark), adjusted in `assets/css/theme-{light,dark}.scss` (Roboto fonts, colors). `assets/css/paper.css` gives the kraft-paper look (`assets/img/craft.png`): the content column is a paper card on wide screens, the whole page is paper on narrow ones, and dark mode darkens the paper with `background-blend-mode: multiply`. Dark-mode CSS uses the `body.quarto-dark` selector.
- **Math**: KaTeX **0.19.1**, pinned through `html-math-method.url` (Quarto would otherwise load `katex@latest`). Shared macros live only in `assets/tex/macros.tex` (plain `\newcommand`, KaTeX-compatible). `filters/macros.lua` embeds that file into each HTML page, and `assets/js/katex-setup.html` (included after the body) wraps `katex.render`/`renderToString` so every render gets the macros and `trust` for `\htmlClass`. The PDF will include `macros.tex` in the LaTeX preamble.
- Quarto loads KaTeX only on pages that contain math. Pages with live equations but no static math will need to make sure KaTeX is loaded (Phase 2).
- **Asset paths** in CSS are relative (`../img/craft.png`). `assets/img/` is copied to the output through `project.resources`. Don't use root-absolute paths (`/assets/...`), because the site may be hosted under a subpath (`*.github.io/hello-numerics/`).
- **R packages in the browser**: webR installs packages from repo.r-wasm.org, which has the same versions of `Matrix` (1.7-6) and `RTriangle` (1.6-0.15) as `renv.lock`. The old custom package image (`vfs/`) was dropped.
- SVG filters with the default `filterUnits="objectBoundingBox"` make perfectly horizontal or vertical lines disappear (their bounding box has zero size). Apply filters to groups, or use `userSpaceOnUse`.
- "Edit this page" links point to the `master` branch, so they only work once `rewrite` is merged.
