// "Full code" button on a live snippet: shows (and copies) the complete,
// runnable code of the example: the code of all enclosing scopes (also the
// hidden parts, like library() calls) followed by the snippet's own scope,
// with the current values. It is the code that produced what is on screen.
export function addFullCode(codeEl, build) {
  const wrapper = codeEl.closest(".hn-live-code") ?? codeEl.closest(".code-copy-outer-scaffold") ?? codeEl.parentElement;
  const tools = document.createElement("div");
  tools.className = "hn-code-tools";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hn-fullcode-button";
  button.textContent = "Full code";
  button.title = "Show the complete, runnable code of this example";
  button.setAttribute("aria-expanded", "false");
  tools.append(button);

  const panel = document.createElement("div");
  panel.className = "hn-fullcode";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="hn-fullcode-bar">
      <span>Full code of this example, with the values shown above. Paste it into R to run it.</span>
      <button type="button" class="hn-fullcode-copy">Copy</button>
    </div>
    <div class="sourceCode"><pre class="sourceCode r"><code class="sourceCode r"></code></pre></div>`;
  wrapper.after(tools, panel);
  const code = panel.querySelector("code");
  const copy = panel.querySelector(".hn-fullcode-copy");

  const refresh = () => {
    if (panel.hidden) return;
    code.innerHTML = `<span class="hn-code-lines">${build().html}</span>`;
  };
  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.classList.toggle("hn-active", !panel.hidden);
    button.setAttribute("aria-expanded", String(!panel.hidden));
    refresh();
  });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(build().text);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Copy failed";
    }
    setTimeout(() => { copy.textContent = "Copy"; }, 1500);
  });

  return { refresh, text: () => build().text, open: () => { if (panel.hidden) button.click(); } };
}
