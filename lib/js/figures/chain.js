// A chain of springs: a wall, free knots, and a person holding the far end.
// The reader drags the person; R finds where the knots settle.
//
// The figure only draws and handles interaction. It never computes physics:
// the knot positions and forces come from R.
//
//   inputs   xe  position of the person (the end of the chain) [m]
//   outputs  x   positions of all nodes [m]: wall, knots, person
//            f   force applied at each node [N] (the wall's reaction, the
//                person's pull; zero at the free knots)
//            X   rest positions of all nodes [m] (the rest lengths are diff(X))
//            ks  (optional) spring constants: stiffer springs are drawn thicker
//
// Settings (div attributes): length (metres shown, default 8),
// force-scale (px per N, default 20).
import { ensureDefs, guy, wall, knot, springPath, arrow, pickers } from "../kit/index.js";

export const inputs = ["xe"];
export const outputs = ["x", "f", "X"];
export const colors = { xe: "pen1", f: "pen3" };

const WIDTH = 600;   // px for the shown length
export const viewBox = "-50 -85 700 160";

function layer(svg, name) {
  let g = svg.select(`g.${name}`);
  if (g.empty()) g = svg.append("g").attr("class", name);
  return g;
}
const scaleOf = (opts) => WIDTH / Number(opts.data?.length ?? 8);

export function draw(svg, state, opts = {}) {
  ensureDefs();
  svg.classed("hn-figure", true).attr("viewBox", viewBox);
  const scale = scaleOf(opts);
  const forceScale = Number(opts.data?.forceScale ?? 20);
  const end = (opts.inputs ?? inputs)[0];
  const ink = layer(svg, "hn-pencil");
  if (ink.select(".wall").empty()) ink.append("g").attr("class", "wall").attr("transform", "translate(0,-10)").call(wall);

  // Node positions from R; before R has run, only the person is known
  let x = [state.x].flat().filter(Number.isFinite).map((v) => v * scale);
  if (x.length < 2) x = [0, state[end] * scale];
  x[x.length - 1] = state[end] * scale;            // the person follows the hand at once
  const n = x.length;
  const knotR = Math.max(2.5, Math.min(6, (x[n - 1] - x[0]) / n / 4));

  // Springs
  const X = [state.X].flat(), ks = [state.ks].flat().filter(Number.isFinite);
  const kMax = ks.length ? Math.max(...ks) : 1;
  const springs = x.slice(1).map((x2, i) => {
    const rest = (X[i + 1] - X[i]) * scale;      // rest length [px]
    return {
      x1: x[i], x2: i === n - 2 ? x2 - 20 : x2,
      coils: Number.isFinite(rest) ? Math.max(1, Math.min(10, Math.round(rest / 14))) : 10,
      amplitude: Number.isFinite(rest) ? Math.max(3, Math.min(10, rest / 4)) : 10,
      width: ks.length === n - 1 ? 2 + 4 * ks[i] / kMax : 5,
    };
  });
  ink.selectAll("path.spring").data(springs).join((e) => e.append("path").attr("class", "spring pen2").attr("stroke-linejoin", "round"))
    .attr("d", (d) => springPath(d.x1, -10, d.x2, -10, { coils: d.coils, amplitude: d.amplitude }))
    .style("stroke-width", (d) => `${d.width}px`);

  // Knots between springs
  ink.selectAll("g.knot").data(x.slice(1, -1)).join((e) => e.append("g").attr("class", "knot"))
    .attr("transform", (v) => `translate(${v},-10)`)
    .each(function () { const g = svg.select(() => this); g.selectAll("*").remove(); knot(g, { radius: knotR }); });

  // The person at the end
  let person = ink.select("g.person");
  if (person.empty()) { person = ink.append("g").attr("class", "person"); guy(person); }
  person.attr("transform", `translate(${x[n - 1]},0)`);

  // Forces at the nodes (wall reaction and the person's pull)
  const f = [state.f].flat();
  const forceY = (i) => (i === n - 1 ? -55 : -70);   // above the head / above the wall
  ink.selectAll("line.force").data(x).join((e) => e.append("line").attr("class", "force pen3"))
    .attr("transform", (v, i) => `translate(${v},${forceY(i)})`)
    .each(function (_, i) {
      const line = svg.select(() => this);
      if (Number.isFinite(f[i])) line.classed("hn-hide", false).call(arrow, f[i] * forceScale, 0);
      else line.classed("hn-hide", true);
    });

  // Label
  const labels = layer(svg, "labels");
  let lx = labels.select("text.x-label");
  if (lx.empty()) lx = labels.append("text").attr("class", "x-label pen0").attr("text-anchor", "middle").attr("y", 70);
  lx.attr("x", x[n - 1]).text(`${end} = ${(x[n - 1] / scale).toFixed(2)} m`);
}

export function interact(svg, state, onChange, opts = {}) {
  const scale = scaleOf(opts);
  const end = (opts.inputs ?? inputs)[0];
  const max = Number(opts.data?.length ?? 8) - 0.3;
  const picks = [{ x: state[end] * scale, y: 15, axis: "x", min: 0.5 * scale, max: max * scale }];
  const handles = pickers(svg, picks, (p) => {
    state = { ...state, [end]: Math.round(p.x / scale * 100) / 100 };   // 1 cm steps
    onChange(state);
  });
  return {
    set(newState) { state = newState; picks[0].x = state[end] * scale; handles.update(); },
  };
}
