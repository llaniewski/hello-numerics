# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Hello Numerics" is an open-source, interactive book on numerical methods for engineering. It's currently built as a static site with **MkDocs + Material theme** (`mkdocs.yml`, content in `docs/`) and published at https://www.hello-numerics.com/. There is no application code, test suite, or linter; the "code" is interactive JavaScript embedded in Markdown pages.

The project is at an **early, exploratory stage**. Most pages are placeholders or prototypes, and the toolchain (MkDocs, R vs Python) isn't settled yet.

### Planned content (in reading order)

1. **Math background**: only the linear algebra and calculus needed later (`docs/math/`).
2. **Numerical methods for solving problems**: mainly iterative methods (`docs/basics/`).
3. **Finite Difference Method** (`docs/fdm/`).
4. **Finite Element Method** (`docs/fem/`). `fem/springs.md` (spring systems → stiffness matrix) is the first real page.
5. **Finite Volume Method** (`docs/fvm/`).
6. **Lattice Boltzmann Method** (`docs/lbm/`), possibly.

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
- The pages in `docs/` still use MathJax 2.7 (see below) until the migration.

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

Early prototypes of the webR part: `basics/test.md` (runs R and exports a plot), `basics/rpdf.html` (mounts a custom R package library), and `basics/drag.html` (webR init next to a draggable SVG). None of them connects the dragging to R computation yet.

## Migration in progress

The move to Quarto + webR + quarto-live is tracked step by step in [plan.md](plan.md). Read it before starting work, and update its checkboxes and Log when finishing a step.

## Git conventions

- Work on the `rewrite` branch. The old MkDocs version is kept on `legacy`; don't commit to it.
- Commits are authored by Claude (`--author="Claude <noreply@anthropic.com>"`). The commit message ends with a line stating the work was done under the author's direction: `Done under the direction of L Laniewski-Wollk.`
- `sandbox/` holds old prototypes for local reference only. It is git-ignored; never commit it.

## Commands

```bash
pip install mkdocs-material   # pulls in mkdocs and pymdown-extensions
mkdocs serve                  # live-reload preview at http://127.0.0.1:8000
mkdocs build                  # render to site/
```

## Architecture / conventions

- **Navigation is explicit**: only pages listed under `nav:` in `mkdocs.yml` appear in the menu. Many files in `docs/` (e.g. `fem/springs.md`, `basics/test2.md`, `basics/lit.md`, the `basics/*.html` files) are experiments/drafts not in `nav` but still built and reachable by URL.
- **Math (current, to be replaced by KaTeX)**: MathJax 2.7 via `pymdownx.arithmatex` (generic mode). Use `\( … \)` / `\[ … \]` or `$ … $`. Pages define LaTeX macros inline at the top, e.g. `$\newcommand{\mat}[1]{\left[\begin{matrix}#1\end{matrix}\right]}$`.
- **Interactive figures**: D3 v7 is loaded globally for every page through `extra_javascript` in `mkdocs.yml`, so `<script type="module">` blocks inside Markdown (enabled by `md_in_html`) can use `d3` directly. Standalone `docs/basics/*.html` prototypes load D3 themselves.
- **Hand-drawn look**: `docs/fem/springs.md` is the most developed page and the reference pattern — inline `<svg><defs>` with pencil-texture SVG filters and arrow markers, plus reusable drawing helpers (`appendGuy`, `spring_path`, draggable nodes, a `spring_guys_plot` class that recomputes spring forces on drag). Styling uses classes (`pen0color`, `pen1`…, `bgfill`, `penfilter`) from `docs/a/style.css`, which pages pull in with `<link rel="stylesheet" href="/a/style.css"/>`. That stylesheet also sets the paper background (`docs/craft.png`). Pen colors should use Material CSS variables (e.g. `--md-default-fg-color`) so they work in both light and dark (`slate`) schemes.
- **Absolute asset paths** (`/a/style.css`, `/craft.png`, `/vfs/...`) assume the site is served from the domain root.
- **In-browser R (webR)**: some prototypes (`docs/basics/test.md`, `docs/basics/rpdf.html`, `docs/basics/drag.html`) import webR from `https://webr.r-wasm.org/latest/webr.mjs`. `rpdf.html` mounts `docs/vfs/library.data` + `library.js.metadata` (a prebuilt WORKERFS image of R packages such as Matrix and RTriangle) at `/library` and adds it to `.libPaths()`. These vfs files are generated binaries — don't edit them by hand.
- **Multi-language code samples** use `pymdownx.tabbed` (`=== "Python"`, `=== "C++"`, `=== "R"`, `=== "Math"`), see `docs/index.md`.
- Lit web components are being trialled (`docs/basics/lit.md`, loaded from the jsDelivr CDN).
