// Live equation: a KaTeX template with {{expr}} slots, filled with strings
// formatted by R. Changed values are briefly highlighted (\htmlClass needs
// KaTeX's trust option, set globally by assets/js/katex-setup.html).
export function createLiveEquation(el, template, { colors = {} } = {}) {
  let last = {};
  return {
    slots: [...template.matchAll(/\{\{(.+?)\}\}/g)].map((m) => m[1]),
    render(values) {
      const tex = template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
        const v = values[expr] ?? "?";
        const cls = [colors[expr], last[expr] !== undefined && last[expr] !== v ? "hn-changed" : ""]
          .filter(Boolean).join(" ");
        return cls ? `\\htmlClass{${cls}}{${v}}` : `{${v}}`;
      });
      last = { ...values };
      window.katex.render(tex, el, { displayMode: true });
    },
  };
}
