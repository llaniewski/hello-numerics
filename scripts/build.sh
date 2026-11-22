#!/usr/bin/env bash
# Builds the whole book into _book/: the HTML site and the PDF (linked from
# the site). Extra arguments go to `quarto render` (e.g. --to pdf).
#
# Needs: Quarto, R with the renv library (renv::restore()), TinyTeX, and
# Node >= 20 with Playwright's Chromium (npm ci && npx playwright install
# chromium); the PDF build runs every live scope in native R and draws the
# figures in headless Chromium (filters/live.lua).
set -euo pipefail
cd "$(dirname "$0")/.."

node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$node_major" -lt 20 ]; then
  echo "build.sh: Node >= 20 is needed on PATH (found: $(node --version 2>/dev/null || echo none))." >&2
  echo "          On the dev machine: export PATH=\$HOME/opt/node/bin:\$PATH" >&2
  exit 1
fi

quarto render "$@"
