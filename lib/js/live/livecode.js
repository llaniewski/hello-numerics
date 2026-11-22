// Live R snippet: the shown text and the executed text are built from the
// same token list, so they cannot differ.
//
// R's own parser (getParseData) splits the snippet into tokens once. Input
// values are the numeric literals assigned to the declared input names
// (`x1 <- 3`, also `x1 = -3`). On each update only those literal tokens
// change; the snippet text is rebuilt from the tokens and the original
// whitespace between them, shown with syntax highlighting, and that exact
// string is run in R.
import { changeTracker } from "./changes.js";

// Pandoc's highlighting classes, so the snippet looks like other code blocks
const TOKEN_CLASS = {
  NUM_CONST: "fl", STR_CONST: "st", COMMENT: "co", SYMBOL_FUNCTION_CALL: "fu",
  LEFT_ASSIGN: "ot", EQ_ASSIGN: "ot", RIGHT_ASSIGN: "ot", SPECIAL: "sc",
  FUNCTION: "cf", IF: "cf", ELSE: "cf", FOR: "cf", WHILE: "cf", REPEAT: "cf",
  NULL_CONST: "cn",
};

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// A JavaScript number as an R literal, without floating-point noise
// (3.4699999999999998 -> "3.47").
export const rLiteral = (v) => String(Number(Number(v).toPrecision(12)));

export async function createLiveCode(webR, codeEl, { inputs, colors = {} }) {
  const source = codeEl.textContent;

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

  // 3. Input slots: SYMBOL <name>, an assignment, an optional minus, NUM_CONST.
  //    A minus sign is merged into the number token, so the value can change sign.
  const slots = {};
  for (let i = 0; i + 2 < tokens.length; i++) {
    const [a, b, c, d] = tokens.slice(i, i + 4);
    if (a.type !== "SYMBOL" || !inputs.includes(a.text)) continue;
    if (b.type !== "LEFT_ASSIGN" && b.type !== "EQ_ASSIGN") continue;
    let lit = c;
    if (c.type === "'-'" && d?.type === "NUM_CONST") {
      d.gap = c.gap; d.text = "-" + d.text; c.removed = true; lit = d;
    }
    if (lit.type !== "NUM_CONST") continue;
    if (slots[a.text]) throw new Error(`live code: input "${a.text}" is assigned more than once`);
    slots[a.text] = lit;
    lit.input = a.text;
  }
  tokens = tokens.filter((t) => !t.removed);
  for (const name of inputs) {
    if (!slots[name]) throw new Error(`live code: no numeric assignment found for input "${name}"`);
  }

  const text = () => tokens.map((t) => t.gap + t.text).join("") + tail;
  const changes = changeTracker();

  function render() {
    const now = performance.now();
    const html = tokens.map((t) => {
      let cls = TOKEN_CLASS[t.type] || "";
      let style = "";
      if (t.input) {
        cls += ` hn-input ${colors[t.input] || ""}`;
        const age = changes.mark(t.input, t.text, now);
        if (age !== null) { cls += " hn-changed"; style = ` style="--hn-age:${-age}ms"`; }
      }
      cls = cls.trim().replace(/\s+/g, " ");
      return escapeHtml(t.gap) +
        (cls ? `<span class="${cls}"${style}>${escapeHtml(t.text)}</span>` : escapeHtml(t.text));
    }).join("") + escapeHtml(tail);
    // Wrapper span: Quarto styles the direct children of a code block as
    // *lines* (pre > code.sourceCode > span), which would override token colors.
    codeEl.innerHTML = `<span class="hn-code-lines">${html}</span>`;
  }
  render();

  return {
    // The current input values, read from the literals
    values: () => Object.fromEntries(Object.entries(slots).map(([n, t]) => [n, Number(t.text)])),
    // Set input literals; returns the exact code string to run (= shown text)
    set(values) {
      for (const [name, v] of Object.entries(values)) {
        if (slots[name]) slots[name].text = rLiteral(v);
      }
      render();
      return text();
    },
    text,
  };
}
