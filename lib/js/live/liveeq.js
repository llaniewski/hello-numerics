// Live equation: a LaTeX template with {{expr}} or {{expr|digits}} slots.
//
// Each slot expands to the *body* of a matrix or vector (see lib/R/tex.R):
//   \mat{ {{A}} } x = \mat{ {{b}} }
// The entries are evaluated and formatted in R (tex_entries); here they are
// only joined (rows by \\, entries by &), colored, and given the fading
// highlight when they change. Rendering uses KaTeX; \htmlClass and \htmlStyle
// need KaTeX's trust option, set globally by assets/js/katex-setup.html.
import { changeTracker } from "./changes.js";

const SLOT = /\{\{(.+?)\}\}/g;

// "expr|digits" -> { key, expr, digits }
export function parseSlot(slot) {
  const m = slot.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
  const expr = (m ? m[1] : slot).trim();
  return { key: slot.trim(), expr, digits: m ? Number(m[2]) : null };
}

export function createLiveEquation(el, template, { colors = {} } = {}) {
  const slots = [...template.matchAll(SLOT)].map((m) => parseSlot(m[1]));
  const changes = changeTracker();

  return {
    slots,
    // values: { [slot key]: { nrow, ncol, entries (row by row) } }
    render(values) {
      const now = performance.now();
      const tex = template.replace(SLOT, (_, raw) => {
        const slot = parseSlot(raw);
        const v = values[slot.key];
        if (!v) return "?";
        const color = colors[slot.expr] || "";
        const cell = (entry, i) => {
          const age = changes.mark(`${slot.key}#${i}`, entry, now);
          if (age === null) return color ? `\\htmlClass{${color}}{${entry}}` : `{${entry}}`;
          return `\\htmlStyle{--hn-age:${-age}ms}{\\htmlClass{${color} hn-changed}{${entry}}}`;
        };
        const rows = [];
        for (let r = 0; r < v.nrow; r++) {
          rows.push(v.entries.slice(r * v.ncol, (r + 1) * v.ncol)
            .map((e, j) => cell(e, r * v.ncol + j)).join(" & "));
        }
        return rows.join(" \\\\ ");
      });
      window.katex.render(tex, el, { displayMode: true });
    },
  };
}
