// Single spring: a wall, a spring and a person holding its free end.
//
// The figure only draws and handles interaction. It never computes physics:
// the force F comes from R, through the state passed to draw().
//
//   state = { x, L0, F }   x: position of the free end [m]
//                          L0: rest length [m]
//                          F: force on the person [N] (from R)
//
//   draw(svg, state)                 draw or redraw (used for HTML and PDF)
//   interact(svg, state, onChange)   add a drag handle; onChange({...state, x})
import { d3, ensureDefs, guy, wall, springPath, arrow, pickers } from "../kit/index.js";

const SCALE = 100;        // px per metre
const FORCE_SCALE = 20;   // px per newton
const X_MIN = 0.8, X_MAX = 5.6;
export const viewBox = "-40 -80 660 150";

function layer(svg, name) {
  let g = svg.select(`g.${name}`);
  if (g.empty()) g = svg.append("g").attr("class", name);
  return g;
}

export function draw(svg, state) {
  ensureDefs();
  svg.classed("hn-figure", true).attr("viewBox", viewBox);
  const ink = layer(svg, "hn-pencil");
  const px = state.x * SCALE;

  // Wall (drawn once)
  if (ink.select(".wall").empty()) ink.append("g").attr("class", "wall").call(wall);

  // Spring from the wall to the person's hand
  let spring = ink.select("path.spring");
  if (spring.empty()) spring = ink.append("path").attr("class", "spring pen2").attr("stroke-linejoin", "round");
  spring.attr("d", springPath(0, -10, px - 20, -10, { coils: Math.max(4, Math.round(state.L0 * 5)) }));

  // Person at the free end, with the spring force acting on them
  let person = ink.select("g.person");
  if (person.empty()) {
    person = ink.append("g").attr("class", "person");
    guy(person);
    person.append("line").attr("class", "force pen3");
  }
  person.attr("transform", `translate(${px},0)`);
  if (Number.isFinite(state.F)) {
    person.select("line.force").attr("transform", "translate(0,-55)")   // above the head
      .call(arrow, state.F * FORCE_SCALE, 0);
  }

  // Labels (outside the pencil filter so text stays crisp)
  const labels = layer(svg, "labels");
  let lx = labels.select("text.x-label");
  if (lx.empty()) lx = labels.append("text").attr("class", "x-label pen0").attr("text-anchor", "middle").attr("y", 68);
  lx.attr("x", px).text(`x = ${state.x.toFixed(2)} m`);
}

export function interact(svg, state, onChange) {
  const picks = [{ x: state.x * SCALE, y: 15, axis: "x", min: X_MIN * SCALE, max: X_MAX * SCALE }];
  const handles = pickers(svg, picks, (p) => {
    state = { ...state, x: Math.round(p.x) / SCALE };   // 1 cm steps
    onChange(state);
  });
  return {
    // keep the handle in sync if the state changes from elsewhere
    set(newState) { state = newState; picks[0].x = state.x * SCALE; handles.update(); },
  };
}
