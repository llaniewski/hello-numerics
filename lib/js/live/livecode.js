// Live R snippet: the shown text and the executed text are built from the
// same token list, so they cannot differ.
//
// R's own parser (getParseData) splits the snippet into tokens once. Input
// values are the numeric literals assigned to the declared input names
// (`x1 <- 3`). On each update only those literal tokens change; the snippet
// text is rebuilt from the tokens and the original whitespace between them,
// shown with syntax highlighting, and that exact string is run in R.

// Pandoc's highlighting classes, so the snippet looks like other code blocks
const TOKEN_CLASS = {
  NUM_CONST: "fl", STR_CONST: "st", COMMENT: "co", SYMBOL_FUNCTION_CALL: "fu",
  LEFT_ASSIGN: "ot", EQ_ASSIGN: "ot", RIGHT_ASSIGN: "ot", SPECIAL: "sc",
  FUNCTION: "cf", IF: "cf", ELSE: "cf", FOR: "cf", WHILE: "cf", REPEAT: "cf",
  NULL_CONST: "cn",
};

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

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
  const [l1, c1, l2, c2, tok, txt] = ["line1", "col1", "line2", "col2", "token", "text"].map(col);

  // character offsets of line starts (parse data uses 1-based line/column)
  const lineStart = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStart.push(i + 1);
  const offset = (line, column) => lineStart[line - 1] + column - 1;

  // 2. Segments: [gap, token, gap, token, ..., gap]
  const tokens = [];
  let pos = 0;
  for (let i = 0; i < tok.length; i++) {
    const start = offset(l1[i], c1[i]), end = offset(l2[i], c2[i]) + 1;
    tokens.push({ gap: source.slice(pos, start), type: tok[i], text: source.slice(start, end) });
    pos = end;
  }
  const tail = source.slice(pos);

  // 3. Input slots: SYMBOL <name>, then an assignment, then NUM_CONST
  const slots = {};
  for (let i = 0; i + 2 < tokens.length; i++) {
    const [a, b, c] = tokens.slice(i, i + 3);
    if (a.type === "SYMBOL" && inputs.includes(a.text) &&
        (b.type === "LEFT_ASSIGN" || b.type === "EQ_ASSIGN") && c.type === "NUM_CONST") {
      slots[a.text] = c;
      c.input = a.text;
    }
  }
  for (const name of inputs) {
    if (!slots[name]) throw new Error(`live code: no numeric assignment found for input "${name}"`);
  }

  const text = () => tokens.map((t) => t.gap + t.text).join("") + tail;

  function render(changed = []) {
    const html = tokens.map((t) => {
      let cls = TOKEN_CLASS[t.type] || "";
      if (t.input) cls += ` hn-input ${colors[t.input] || ""} ${changed.includes(t.input) ? "hn-changed" : ""}`;
      return escapeHtml(t.gap) + (cls.trim() ? `<span class="${cls.trim()}">${escapeHtml(t.text)}</span>` : escapeHtml(t.text));
    }).join("") + escapeHtml(tail);
    // Wrapper span: Quarto styles the direct children of a code block as
    // *lines* (pre > code.sourceCode > span), which would override token colors.
    codeEl.innerHTML = `<span class="hn-code-lines">${html}</span>`;
  }
  render();

  return {
    // Set input literals; returns the exact code string to run (= shown text)
    set(values) {
      const changed = [];
      for (const [name, v] of Object.entries(values)) {
        const literal = String(v);
        if (slots[name].text !== literal) { slots[name].text = literal; changed.push(name); }
      }
      render(changed);
      return text();
    },
    text,
  };
}
