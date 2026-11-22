// Drag handles ("pickers"): pulsing circles the reader can drag. Works with
// mouse and touch (pointer events through d3.drag).
//
// pickers(svg, picks, onDrag)
//   picks:  [{ x, y, axis: "x" | "y" | "xy", min?, max? }, ...] in figure units
//   onDrag(pick, index): called after a pick moved; pick.x / pick.y are updated
// Returns { update() } to reposition handles after the figure changed them.
import * as d3 from "./d3.js";

export function pickers(svg, picks, onDrag, { radius = 20 } = {}) {
  const g = svg.append("g").attr("class", "hn-pickers");
  const clamp = (v, lo, hi) => Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, v));

  const drag = d3.drag()
    .container(svg.node())
    .subject((event, d) => ({ x: d.x, y: d.y }))
    .on("start", function () { d3.select(this).classed("hn-active", true); })
    .on("drag", function (event, d) {
      if (d.axis !== "y") d.x = clamp(event.x, d.min, d.max);
      if (d.axis !== "x") d.y = clamp(event.y, d.minY, d.maxY);
      update();
      onDrag(d, picks.indexOf(d));
    })
    .on("end", function () { d3.select(this).classed("hn-active", false); });

  function update() {
    g.selectAll("g")
      .data(picks)
      .join(enter => enter.append("g")
        .call(drag)
        .call(s => s.append("circle").attr("r", radius)))
      .attr("transform", d => `translate(${d.x},${d.y})`);
  }
  update();
  return { update };
}
