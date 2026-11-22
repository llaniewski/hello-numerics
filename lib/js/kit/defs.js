// Shared SVG definitions (pencil filter, arrow markers, hatching), inserted
// once per page into a hidden <svg>. Figures reference them by id, e.g.
// filter: url(#hn-pencil) via the .hn-pencil class.
//
// Note: filters use objectBoundingBox units, so apply .hn-pencil to a group
// with some height, never to a lone horizontal/vertical line (its bounding
// box has zero height and the line would disappear).

const DEFS = `
<filter id="hn-pencil" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox">
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="1" result="f1"/>
  <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="5" in="SourceGraphic" in2="f1" result="f4"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="10" result="f2"/>
  <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="5" in="SourceGraphic" in2="f2" result="f5"/>
  <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="100" result="f3"/>
  <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="3" in="SourceGraphic" in2="f3" result="f6"/>
  <feBlend mode="normal" in2="f4" in="f5" result="out1"/>
  <feBlend mode="normal" in="out1" in2="f6" result="out2"/>
</filter>
<marker id="hn-head" orient="auto" markerWidth="3" markerHeight="3" refX="0" refY="1.5">
  <path d="M0,0 V3 L3,1.5 Z" fill="context-stroke"/>
</marker>
<marker id="hn-head-open" orient="auto" markerWidth="3" markerHeight="3" refX="2" refY="1.5">
  <path d="M0,0 L3,1.5 L0,3" stroke="context-stroke" stroke-linejoin="round" fill="none"/>
</marker>
<pattern id="hn-hatch" width="20" height="20" patternUnits="userSpaceOnUse">
  <line x1="-10" y1="0" x2="20" y2="30" class="pen1"/>
  <line x1="0" y1="-10" x2="30" y2="20" class="pen1"/>
</pattern>`;

export function ensureDefs(doc = document) {
  if (doc.getElementById("hn-defs")) return;
  const holder = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  holder.setAttribute("id", "hn-defs");
  holder.setAttribute("aria-hidden", "true");
  holder.setAttribute("width", "0");
  holder.setAttribute("height", "0");
  holder.style.position = "absolute";
  holder.innerHTML = `<defs>${DEFS}</defs>`;
  doc.body.prepend(holder);
}
