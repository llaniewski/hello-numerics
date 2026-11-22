// A slider for one input of a live scope (see page.js).
//
//   <div class="hn-live-slider" data-input="k" data-min="0.5" data-max="5" data-step="0.1" data-color="pen2">
//     optional label text
//   </div>
export function createSlider(el, { name, value, min, max, step, color = "", onInput }) {
  const label = el.innerHTML.trim();
  el.innerHTML = "";
  const wrap = document.createElement("label");
  wrap.className = "hn-slider";
  const text = document.createElement("span");
  text.className = "hn-slider-label";
  text.innerHTML = label;
  const input = document.createElement("input");
  Object.assign(input, { type: "range", min, max, step, value: value ?? min });
  input.setAttribute("aria-label", name);
  const shown = document.createElement("code");
  shown.className = `hn-slider-value ${color}`;
  const error = document.createElement("div");
  error.className = "hn-live-status hn-live-error";

  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const show = (v) => { shown.textContent = `${name} = ${Number(v).toFixed(decimals)}`; };
  show(input.value);
  input.addEventListener("input", () => { show(input.value); onInput(Number(input.value)); });

  if (label) wrap.append(text);
  wrap.append(input, shown);
  el.append(wrap, error);
  return {
    color,
    set(v) {
      if (v === undefined || Number(input.value) === v) return;
      input.value = v;
      show(v);
    },
    error(msg) { error.textContent = msg; input.disabled = true; },
  };
}
