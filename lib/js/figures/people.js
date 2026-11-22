// People in a row, each pair joined by a spring; every person can be dragged.
//
// The figure only draws and handles interaction. It never computes physics:
// the forces come from R.
//
//   inputs   positions of the people [m], one name each (default x1, x2;
//            set e.g. inputs="x1 x2 x3" on the div for three people)
//   outputs  L0  rest length of the springs [m] (scalar or one per spring)
//            f   force each person applies to the springs [N] (vector)
//
// Settings (div attributes): force-scale (px per N, default 20).
import { ensureDefs, guy, springPath, arrow, pickers } from "../kit/index.js";

export const inputs = ["x1", "x2"];
export const outputs = ["L0", "f"];
export const colors = { x1: "pen1", x2: "pen1", x3: "pen1", x4: "pen1", f: "pen3" };

const SCALE = 100;                 // px per metre
const X_MIN = -0.3, X_MAX = 5.9;   // where people can go [m]
export const viewBox = "-60 -85 680 160";
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (name) => name.replace(/\d/g, (d) => SUB[d]);

function layer(svg, name) {
  let g = svg.select(`g.${name}`);
  if (g.empty()) g = svg.append("g").attr("class", name);
  return g;
}

export function draw(svg, state, opts = {}) {
  ensureDefs();
  svg.classed("hn-figure", true).attr("viewBox", viewBox);
  const names = opts.inputs ?? inputs;
  const forceScale = Number(opts.data?.forceScale ?? 20);
  const xs = names.map((n) => state[n] * SCALE);
  const ink = layer(svg, "hn-pencil");

  // Springs between neighbours, from hand to hand
  const L0 = [state.L0].flat();
  const springs = xs.slice(1).map((x2, i) => {
    const x1 = xs[i], dir = Math.sign(x2 - x1) || 1;
    const rest = Number.isFinite(L0[i] ?? L0[0]) ? (L0[i] ?? L0[0]) : 2;
    return { x1: x1 + 20 * dir, x2: x2 - 20 * dir, coils: Math.max(4, Math.round(rest * 5)) };
  });
  ink.selectAll("path.spring").data(springs).join((e) => e.append("path").attr("class", "spring pen2").attr("stroke-linejoin", "round"))
    .attr("d", (d) => springPath(d.x1, -10, d.x2, -10, { coils: d.coils }));

  // People, each with the force they apply
  const f = [state.f].flat();
  const people = ink.selectAll("g.person").data(xs).join((e) => e.append("g").attr("class", "person")
    .call((g) => { guy(g); g.append("line").attr("class", "force pen3").attr("transform", "translate(0,-55)"); }))
    .attr("transform", (x) => `translate(${x},0)`);
  people.select("line.force").each(function (_, i) {
    const line = svg.select(() => this);
    if (Number.isFinite(f[i])) line.classed("hn-hide", false).call(arrow, f[i] * forceScale, 0);
    else line.classed("hn-hide", true);
  });

  // Labels (outside the pencil filter so text stays crisp)
  layer(svg, "labels").selectAll("text").data(xs).join((e) => e.append("text").attr("class", "pen0").attr("text-anchor", "middle").attr("y", 70))
    .attr("x", (x) => x)
    .text((x, i) => `${subscript(names[i])} = ${(x / SCALE).toFixed(2)} m`);
}

export function interact(svg, state, onChange, opts = {}) {
  const names = opts.inputs ?? inputs;
  const picks = names.map((n) => ({ name: n, x: state[n] * SCALE, y: 15, axis: "x", min: X_MIN * SCALE, max: X_MAX * SCALE }));
  const handles = pickers(svg, picks, (p) => {
    state = { ...state, [p.name]: Math.round(p.x) / SCALE };   // 1 cm steps
    onChange(state);
  });
  return {
    set(newState) {
      state = newState;
      for (const p of picks) p.x = state[p.name] * SCALE;
      handles.update();
    },
  };
}
