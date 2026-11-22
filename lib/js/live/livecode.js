// Live R snippet: the shown text and the executed text are built from the
// same token list, so they cannot differ.
//
// R's own parser (getParseData) splits the snippet into tokens once. Every
// numeric literal assigned to a name (`x1 <- 3`, also `x1 = -3`) can become an
// input; the page decides which ones are (bind). On each update only those
// literal tokens change; the snippet text is rebuilt from the tokens and the
// original whitespace between them, shown with syntax highlighting, and that
// exact string is run in R.
import { changeTracker } from "./changes.js";

// Pandoc's highlighting classes, so the snippet looks like other code blocks
const TOKEN_CLASS = {
  NUM_CONST: "fl", STR_CONST: "st", COMMENT: "co", SYMBOL_FUNCTION_CALL: "fu",
  LEFT_ASSIGN: "ot", EQ_ASSIGN: "ot", RIGHT_ASSIGN: "ot", SPECIAL: "sc",
  FUNCTION: "cf", IF: "cf", ELSE: "cf", FOR: "cf", WHILE: "cf", REPEAT: "cf",
  NULL_CONST: "cn", SYMBOL_PACKAGE: "fu",
};
const PACKAGE_CALLS = ["library", "require", "requireNamespace"];

export const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// A JavaScript number as an R literal, without floating-point noise
// (3.4699999999999998 -> "3.47").
export const rLiteral = (v) => String(Number(Number(v).toPrecision(12)));

export async function createLiveCode(webR, codeEl) {
  const source = codeEl.textContent.replace(/\n$/, "");

  // 1. Tokenize with R's parser (terminal tokens only), in document order
  const parsed = await webR.evalR(`
    pd <- getParseData(parse(text = src, keep.source = TRUE))
    pd <- pd[pd$terminal, c("line1", "col1", "line2", "col2", "token", "text")]
    pd[order(pd$line1, pd$col1), ]
  `, { env: { src: source } });
  const pd = await parsed.toJs();
  await webR.destroy(parsed);
  const col = (name) => pd.values[pd.names.indexOf(name)].values;
  const [l1, c1, l2, c2, tok] = ["line1", "col1", "line2", "col2", "token"].map(col);

  // character offsets of line starts (parse data uses 1-based line/column)
  const lineStart = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStart.push(i + 1);
  const offset = (line, column) => lineStart[line - 1] + column - 1;

  // 2. Segments: [gap, token, gap, token, ..., gap]
  let tokens = [];
  let pos = 0;
  for (let i = 0; i < tok.length; i++) {
    const start = offset(l1[i], c1[i]), end = offset(l2[i], c2[i]) + 1;
    tokens.push({ gap: source.slice(pos, start), type: tok[i], text: source.slice(start, end) });
    pos = end;
  }
  const tail = source.slice(pos);

  // 3. Literal assignments: SYMBOL, an assignment, an optional minus, NUM_CONST.
  //    A minus sign is merged into the number token, so the value can change sign.
  //    A name assigned a literal more than once can't be an input (null).
  const literals = new Map();
  for (let i = 0; i + 2 < tokens.length; i++) {
    const [a, b, c, d] = tokens.slice(i, i + 4);
    if (a.type !== "SYMBOL") continue;
    if (b.type !== "LEFT_ASSIGN" && b.type !== "EQ_ASSIGN") continue;
    let lit = c;
    if (c.type === "'-'" && d?.type === "NUM_CONST") {
      d.gap = c.gap; d.text = "-" + d.text; c.removed = true; lit = d;
    }
    if (lit.type !== "NUM_CONST") continue;
    literals.set(a.text, literals.has(a.text) ? null : lit);
  }
  tokens = tokens.filter((t) => !t.removed);

  // 4. Packages used: library(x), require("x"), x::f
  const packages = new Set();
  tokens.forEach((t, i) => {
    if (t.type === "SYMBOL_PACKAGE") packages.add(t.text);
    if (t.type === "SYMBOL_FUNCTION_CALL" && PACKAGE_CALLS.includes(t.text)) {
      const arg = tokens[i + 2];
      if (arg && (arg.type === "SYMBOL" || arg.type === "STR_CONST")) packages.add(arg.text.replace(/^["']|["']$/g, ""));
    }
  });

  const text = () => tokens.map((t) => t.gap + t.text).join("") + tail;
  const changes = changeTracker();
  let colors = {};

  // Highlighted HTML of the code; with `live`, inputs are colored and
  // changed values get the fading highlight.
  function html({ live = true } = {}) {
    const now = performance.now();
    return tokens.map((t) => {
      let cls = TOKEN_CLASS[t.type] || "";
      let style = "";
      if (live && t.input) {
        cls += ` hn-input ${colors[t.input] || ""}`;
        const age = changes.mark(t.input, t.text, now);
        if (age !== null) { cls += " hn-changed"; style = ` style="--hn-age:${-age}ms"`; }
      }
      cls = cls.trim().replace(/\s+/g, " ");
      return escapeHtml(t.gap) +
        (cls ? `<span class="${cls}"${style}>${escapeHtml(t.text)}</span>` : escapeHtml(t.text));
    }).join("") + escapeHtml(tail);
  }

  // Wrapper span: Quarto styles the direct children of a code block as
  // *lines* (pre > code.sourceCode > span), which would override token colors.
  const render = () => { codeEl.innerHTML = `<span class="hn-code-lines">${html()}</span>`; };
  render();

  return {
    literals: () => [...literals.keys()],
    packages: () => [...packages],
    // Make these names inputs (their literals change with set())
    bind(names, inputColors = {}) {
      for (const name of names) {
        const lit = literals.get(name);
        if (lit === null) throw new Error(`live code: "${name}" is assigned more than once`);
        if (lit) lit.input = name;
      }
      colors = { ...colors, ...inputColors };
      render();
    },
    // The current input values, read from the literals
    values: () => Object.fromEntries([...literals].filter(([, t]) => t?.input).map(([n, t]) => [n, Number(t.text)])),
    // Set input literals; returns the exact code string to run (= shown text)
    set(values) {
      for (const [name, v] of Object.entries(values)) {
        const lit = literals.get(name);
        if (lit?.input) lit.text = rLiteral(v);
      }
      render();
      return text();
    },
    text,
    html,
  };
}
