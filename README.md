# hello-numerics

An open book on numerics: an interactive, open-source textbook on numerical methods for engineering. Interactive figures are computed by R running in the browser (webR), and the R code shown next to each figure is exactly the code that computes it.

> The book is being moved from MkDocs to Quarto on the `rewrite` branch; the old version lives on the `legacy` branch. Progress is tracked in [plan.md](plan.md).

## Getting started

Everything below installs in user space (no sudo).

### Tools

| Tool | Version | Used for |
|---|---|---|
| [Quarto](https://quarto.org/docs/download/) | 1.11.9 | building the book (HTML and PDF) |
| TinyTeX | via Quarto | PDF output |
| R + [renv](https://rstudio.github.io/renv/) | R ≥ 4.3 | code chunks, snippet tests |
| [Node.js](https://nodejs.org/) | 26 LTS (see `.node-version`) | Playwright: figure snapshots for the PDF, browser tests |

```bash
# Quarto: unpack the release tarball and link it into ~/.local/bin
V=1.11.9
mkdir -p ~/opt && cd ~/opt
curl -LO https://github.com/quarto-dev/quarto-cli/releases/download/v$V/quarto-$V-linux-amd64.tar.gz
tar xzf quarto-$V-linux-amd64.tar.gz && rm quarto-$V-linux-amd64.tar.gz
ln -sf ~/opt/quarto-$V/bin/quarto ~/.local/bin/quarto
quarto check

# LaTeX for the PDF (installs into ~/.TinyTeX)
quarto install tinytex
```

Node.js: if your system Node is older than 20, unpack the official Linux tarball from https://nodejs.org/ into `~/opt` and put its `bin/` first on your `PATH`.

### Project dependencies

```bash
# R packages, pinned in renv.lock (renv activates itself through .Rprofile)
Rscript -e 'renv::restore()'

# Node packages and the headless browser
npm ci
npx playwright install chromium
```

The quarto-live extension (in-browser R via webR) is committed in `_extensions/`, so it needs no installation.

R dependencies are listed in `DESCRIPTION`. After adding one there, install it with `renv::install()` and record it with `renv::snapshot()`.
