// Drawing primitives in the pencil style. Each function draws into a D3
// selection (usually a <g> already translated to the object's position).
import * as d3 from "./d3.js";

// Stick figure ("guy"); feet at y = 45, head centre at y = -30.
export function guy(g) {
  g.append("path")
    .attr("d", "M0,-20 L0,-10 L0,15 M-20,0 L0,-10 L20,0 M-10,45 L0,15 L10,45")
    .attr("class", "pen1");
  g.append("circle").attr("cx", 0).attr("cy", -30).attr("r", 10).attr("class", "pen1");
  return g;
}

// Wall with hatching, attachment face at x = 0, extending to the left.
export function wall(g, { height = 90 } = {}) {
  const h = height / 2;
  g.append("path")
    .attr("d", `M0,${-h} L-20,${-h} L-20,${h} L0,${h} Z`)
    .attr("class", "pen1")
    .attr("fill", "url(#hn-hatch)")
    .style("fill", "url(#hn-hatch)");
  return g;
}

// Zig-zag spring between two points; the number of coils follows the rest
// length, so a stretched spring visibly opens up.
export function springPath(x1, y1, x2, y2, { coils = 10, amplitude = 10 } = {}) {
  const path = d3.path();
  const vx = x2 - x1, vy = y2 - y1;
  const v = Math.hypot(vx, vy) || 1;
  const wx = -vy / v, wy = vx / v;
  path.moveTo(x1, y1);
  let a = amplitude;
  for (let i = 0; i < coils; i++) {
    const t = (0.5 + i) / coils;
    path.lineTo(x1 + vx * t + wx * a, y1 + vy * t + wy * a);
    a = -a;
  }
  path.lineTo(x2, y2);
  return path.toString();
}

// Force arrow from (0,0) to (dx,dy); hidden when shorter than minLength.
export function arrow(sel, dx, dy, { minLength = 5 } = {}) {
  return sel
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", dx).attr("y2", dy)
    .attr("marker-end", "url(#hn-head)")
    .classed("hn-hide", Math.hypot(dx, dy) < minLength);
}
