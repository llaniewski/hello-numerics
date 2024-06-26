# Springs

<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
    <filter x="-2%" y="-2%" width="104%" height="104%" filterUnits="objectBoundingBox" id="PencilTexture">
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" result="noise">
      </feTurbulence>
      <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="3" in="SourceGraphic" result="newSource">
      </feDisplacementMap>
    </filter>
    <filter x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox" id="pencilTexture2">
      <feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="5" stitchTiles="stitch" result="f1">
      </feTurbulence>
      <feColorMatrix type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 -1.5 1.5" result="f2">
      </feColorMatrix>
      <feComposite operator="in" in2="f2" in="SourceGraphic" result="f3">
      </feComposite>
    </filter>
    <filter x="-2%" y="-2%" width="104%" height="104%" filterUnits="objectBoundingBox" id="pencilTexture3">
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="5" stitchTiles="stitch" result="f1">
      </feTurbulence>
      <feColorMatrix type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 -1.5 1.5" result="f2">
      </feColorMatrix>
      <feComposite operator="in" in2="f2b" in="SourceGraphic" result="f3">
      </feComposite>
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" result="noise">
      </feTurbulence>
      <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="2.5" in="f3" result="f4">
      </feDisplacementMap>
    </filter>
    <filter x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" id="pencilTexture4">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="1" result="f1">
      </feTurbulence>
      <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="5" in="SourceGraphic" in2="f1" result="f4">
      </feDisplacementMap>
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="10" result="f2">
      </feTurbulence>
      <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="5" in="SourceGraphic" in2="f2" result="f5">
      </feDisplacementMap>
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="100" result="f3">
      </feTurbulence>
      <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="3" in="SourceGraphic" in2="f3" result="f6">
      </feDisplacementMap>
      <feBlend mode="normal" in2="f4" in="f5" result="out1">
      </feBlend>
      <feBlend mode="normal" in="out1" in2="f6" result="out2">
      </feBlend>
    </filter>
    <marker id='head' orient="auto" markerWidth='3' markerHeight='3' refX='0' refY='1.5'>
      <path d='M0,0 V3 L3,1.5 Z' fill="context-stroke"/>
    </marker>
    <marker id='head2' orient="auto" markerWidth='3' markerHeight='3' refX='2' refY='1.5'>
      <path d='M0,0 L3,1.5 L0,3' stroke="context-stroke" stroke-linejoin="round" fill="none"/>
    </marker>
    <pattern id="star" width="20" height="20" patternUnits="userSpaceOnUse">
        <line x1="-10" y1="0" x2="20" y2="30" stroke="black" class="pen1"/>
        <line x1="0" y1="-10" x2="30" y2="20" stroke="black" class="pen1"/>
    </pattern>
  </defs>
</svg>

<svg style="width: min(700px,100%);" viewBox="-30 -50 670 200" id="pic1"></svg>
<svg style="width: min(700px,100%);" viewBox="-30 -50 670 200" id="pic2"></svg>
<svg style="width: min(700px,100%);" viewBox="-30 -50 670 200" id="pic3"></svg>

<link rel="stylesheet" href="/a/style.css"/>
<script type="module">
    function appendGuy(g) {
        g.append("text")
            .attr("x", 15)
            .attr("y", 55)
            .classed("pen0color",true)
            .attr("text-anchor", "left");
        g.append("line")
            .attr("marker-end",'url(#head)')
            .classed("force",true)
            .classed("pen3",true)
            .attr("y1",-10);
        g.append("path")
            .attr("d","M0,-20 L0,-10 L0,15 M-20,0 L0,-10 L20,0 M-10,45 L0,15 L10,45")
            .classed("pen1",true)
            .attr("fill","none");
        g.append("circle")
            .attr("cx", 0)
            .attr("cy", -30)
            .attr("r", 10)
            .classed("pen1",true)
            .classed("bgfill",true);
        return g;
    };
    function spring_path(path,x1,y1,x2,y2,length) {
        let x = x1;
        let y = y1;
        let vx = x2-x1;
        let vy = y2-y1;
        let v = Math.sqrt(vx*vx+vy*vy);
        let wx = -vy/v;
        let wy =  vx/v;
        path.moveTo(x,y);
        let n = Math.floor(length/10);
        let g = 10;
        for (let i = 0; i<n; i++) {
            path.lineTo(x+vx*(0.5+i)/n+wx*g,y+vy*(0.5+i)/n+wy*g);
            g = -g;
        }
        path.lineTo(x+vx,y+vy);
        return path;
    }
    function drag_update(update) {
        return d3.drag()
            .on("start", (event, d) => d3.select(this).raise().classed("active", true))
            .on("drag", (event, d) => {
                if (d.xslide) d.x = event.x;
                if (d.yslide) d.y = event.y;
                event.subject.update();
            })
            .on("end", (event, d) => d3.select(this).classed("active", false));
    }
    class spring_guys_plot {
        constructor(svg, nodes, links) {
            this.svg = svg;
            this.drawing = this.svg.append("g").classed("penfilter",true);
            this.nodes = nodes;
            this.links = links;
            this.update();
        }
        update() {
            this.nodes.forEach(node => {
                node.xforce = 0;
                node.yforce = 0;
                return node;
            });
            this.links.forEach(link => {
                let source = this.nodes.find(node => node.id === link.source);
                let target = this.nodes.find(node => node.id === link.target);
                let dx = source.x - target.x;
                link.ysource = source.y;
                link.ytarget = target.y;
                if (dx > 0) {
                    link.xsource = source.x - 20;
                    link.xtarget = target.x + 20;
                } else {
                    link.xsource = source.x + 20;
                    link.xtarget = target.x - 20;
                }
                let dy = source.y - target.y;
                let d = Math.sqrt(dx*dx+dy*dy);
                let force = (d-link.length)*link.k;
                source.xforce -= force*dx/d;
                source.yforce -= force*dy/d;
                target.xforce += force*dx/d;
                target.yforce += force*dy/d;
                return link;
            });
            this.drawing
                .selectAll(".edge")
                .data(this.links)
                .join(
                    enter => enter.append("path")
                        .attr("stroke-linejoin","round")
                        .attr("fill","none")
                        .classed("edge",true)
                        .classed("pen2",true)
                    )
                .attr("d", d => spring_path(d3.path(),d.xsource,d.ysource,d.xtarget,d.ytarget,d.length));
            this.drawing
                .selectAll(".node")
                .data(this.nodes, d => d.id)
                .join(
                    enter => enter.append("g")
                        .call( s => {
                            s.filter(d => d.name == "Wall").append("path")
                                //.attr("d","M-20,-45 L20,-45 L20,45 L-20,45")
                                .attr("d","M0,-45 L20,-45 L20,45 L0,45")
                                .classed("pen1",true)
                                .attr("fill","url(#star)");
                            s.filter(d => d.name != "Wall").call(appendGuy);
                            return s;
                        })
                        .classed("node",true)
                    )
                .attr("transform", d => `translate(${d.x}, ${d.y})`)
                .call( s => s.select("text").text(d => d.name) )
                .call( s => s.select(".force")
                    .attr("x2",d=>d.xforce)
                    .attr("y2",d=>d.yforce-10)
                    .classed("hide",d => d.xforce*d.xforce+d.yforce*d.yforce < 25)
                );
        }
    };
    class pickers {
        constructor(plot, picks) {
            this.plot = plot
            this.picks = picks;
            this.g = this.plot.svg.append("g")
                .classed("pickers",true);
            this.drag = drag_update().subject(this);
            this.update();
        }
        update() {
            this.picks.forEach(d => {
                d.fun(this.plot, d);
                return d;
            });
            this.g
                .selectAll("g")
                .data(this.picks)
                .join(
                    enter => enter
                        .append("g")
                        .call(this.drag)
                        .call(s => s.append("circle").attr("r",20))
                )
                .attr("transform", d => `translate(${d.x}, ${d.y})`);
            this.plot.update();
        }
    };

    let pic1 = d3.select("#pic1");
    let pic1drawing = new spring_guys_plot(pic1,
        [
            { id: 1, name: "Wall", head: 20, x: 0, y: 0 },
            { id: 2, name: "Anne", head: 20, x: 250, y: 0 }
        ],
        [
            { source: 1, target: 2, length: 200, k: 0.5 }
        ]
    );
    let pic1pickers = new pickers(pic1drawing, 
        [
            { x: 250, y: 0, xslide: true, fun: (obj, d) => { obj.nodes[1].x = d.x; } },
        ]
    );

    let pic2 = d3.select("#pic2");
    let pic2drawing = new spring_guys_plot(pic2,
        [
            { id: 1, name: "Anne", head: 20, x: 0, y: 0 },
            { id: 2, name: "Bart", head: 20, x: 200, y: 0 }
        ],
        [
            { source: 1, target: 2, length:200, k: 0.5 }
        ]
    );
    let pic2pickers = new pickers(pic2drawing, 
        [
            { x: 0, y: 0, xslide: true, fun: (obj, d) => { obj.nodes[0].x = d.x; } },
            { x: 250, y: 0, xslide: true, fun: (obj, d) => { obj.nodes[1].x = d.x; } },
        ]
    );

    let pic3 = d3.select("#pic3");
    let pic3drawing = new spring_guys_plot(pic3,
        [
            { id: 1, name: "Anne", head: 20, x: 0, y: 0 },
            { id: 2, name: "Bart", head: 20, x: 200, y: 0 },
            { id: 3, name: "Carl", head: 20, x: 400, y: 0 }
        ],
        [
            { source: 1, target: 2, length:200, k: 0.5 },
            { source: 2, target: 3, length:200, k: 0.5 }
        ]
    );
    let pic3pickers = new pickers(pic3drawing, 
        [
            { x: 0, y: 0, xslide: true, fun: (obj, d) => { obj.nodes[0].x = d.x; } },
            { x: 200, y: 0, xslide: true, fun: (obj, d) => { obj.nodes[1].x = d.x; } },
            { x: 400, y: 0, xslide: true, fun: (obj, d) => { obj.nodes[2].x = d.x; } }
        ]
    );

    

</script>
