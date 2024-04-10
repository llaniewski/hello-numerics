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
    <marker 
      id='head' 
      orient="auto" 
      markerWidth='3' 
      markerHeight='3' 
      refX='0' 
      refY='1.5'
    >
      <path d='M0,0 V3 L3,1.5 Z' fill="context-stroke" />
    </marker>
  </defs>
</svg>

<svg width="750" height="500" id="pic1"></svg>

<style>
    .pen1 {
        color: #ac2b3c;
        stroke: #ac2b3c;
        stroke-width: 5px;
    }
    .pen2 {
        stroke: #518c94;
        stroke-width: 5px;
    }
    .pen3 {
        stroke: #d2d65c;
        stroke-width: 5px;
    }
    .pen1fill {
        stroke: #ac2b3c;
        fill: white;
        fill-opacity: 0.0;
        stroke-width: 5px;
    }
    .penfilter {
        filter: url('#pencilTexture4');
    }
    @keyframes pulse {
        0% { transform: scale(0.7); opacity: 0.5; }
        50% { transform: scale(1); opacity: 0.25; }
        100% { transform: scale(0.7); opacity: 0.5; }
    }
    .pickers > * > circle {
        animation: pulse 2s infinite;
        fill: steelblue;
    }
    .pickers:has(>*:hover) > *:not(:hover) > circle {
        animation: unset;
        transform: scale(0.7);
        opacity: 0.1;
    }
    .pickers > *:hover > circle {
        animation: unset;
        transform: scale(1);
        opacity: 0.7;
    }
</style>
<script type="module">
    // Sample data
    let nodes = [
        { id: 1, name: "Anne", head: 20, x: 0, y: 0 },
        { id: 2, name: "Bart", head: 20, x: 200, y: 0 },
        { id: 3, name: "Carl", head: 20, x: 400, y: 0 }
    ];
    let pickers = [
        { x: 0, y: 0, xslide: true, fun: d => { nodes[0].x = d.x; } },
        { x: 200, y: 0, xslide: true, fun: d => { nodes[1].x = d.x; } },
        { x: 400, y: 0, xslide: true, fun: d => { nodes[2].x = d.x; } }
    ];

    const links = [
        { source: 1, target: 2, length:150, k: 1.5 },
        { source: 2, target: 3, length:150, k: 1.5 }
    ];

    
    console.log(nodes);

    // Create SVG container
    const svg_main_g = d3.select("#pic1").append("g").attr("transform", "translate(20, 40)");
    const drawing = svg_main_g.append("g")
        .classed("penfilter",true);
    const pickers_g = svg_main_g.append("g")
        .classed("pickers",true);

    // Define drag behavior
    const drag = d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded);

    d3.selection.prototype.appendGuy = function() {
        let g = this.append("g");
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", 25)
            .classed("pen1",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 20)
            .attr("y2", 10)
            .classed("pen1",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 10)
            .attr("y2", 0)
            .attr("marker-end",'url(#head)')
            .classed("force",true)
            .classed("pen3",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", -20)
            .attr("y2", 10)
            .classed("pen1",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 25)
            .attr("x2", -10)
            .attr("y2", 55)
            .classed("pen1",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 25)
            .attr("x2", 10)
            .attr("y2", 55)
            .classed("pen1",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", -10)
            .classed("pen1",true);
        g.append("text")
            .attr("x", 15)
            .attr("y", 55)
            .attr("text-anchor", "left");
        g.append("circle")
            .attr("cx", 0)
            .attr("cy", -20)
            .attr("r", 10)
            .classed("pen1fill",true);
        return g;
    };
    function update(tran) {
        console.log("update");
        pickers.forEach(pick => {
            pick.fun(pick);
            return pick;
        });
        nodes.forEach(node => {
            node.xforce = 0;
            node.yforce = 0;
            return node;
        });
        links.forEach(link => {
            let source = nodes.find(node => node.id === link.source);
            let target = nodes.find(node => node.id === link.target);
            let dx = source.x - target.x;
            if (dx > 0) {
                link.xsource = source.x - 20;
                link.ysource = source.y + 10;
                link.xtarget = target.x + 20;
                link.ytarget = target.y + 10;
            } else {
                link.xsource = source.x + 20;
                link.ysource = source.y + 10;
                link.xtarget = target.x - 20;
                link.ytarget = target.y + 10;
            }
            let dy = source.y - target.y;
            let d = Math.sqrt(dx*dx+dy*dy);
            let force = (d-link.length)*link.k;
            //link.force = (d-link.length)*link.k;
            source.xforce -= force*dx/d;
            source.yforce -= force*dy/d;
            target.xforce += force*dx/d;
            target.yforce += force*dy/d;
            return link;
        });
        let linkFun = link => link
            .attr("x1", d => d.xsource)
            .attr("y1", d => d.ysource)
            .attr("x2", d => d.xtarget)
            .attr("y2", d => d.ytarget);
        let nodeFun = node => {
            node.attr("transform", d => `translate(${d.x}, ${d.y})`);
            node.select("text").text(d => d.name);
            node.select(".force")
                .attr("x2",d=>d.xforce)
                .attr("y2",d=>d.yforce);
            return node;
        };
        pickers_g.selectAll("g").data(pickers)
        .join(
            enter => {
                let g = enter.append("g").call(drag);
                g.append("circle").attr("r",20);
                return g;
            },
            update => update,
            exit => exit.remove()
        ).attr("transform", d => `translate(${d.x}, ${d.y})`);
        const linkGroup = drawing.selectAll(".edge").data(links)
        .join(
            enter => linkFun(enter.append("line").classed("edge",true).classed("pen2",true)),
            update => linkFun(tran(update)),
            exit => exit.remove()
        );
        const nodeGroup = drawing.selectAll(".node").data(nodes, function(d){return d.id})
        .join(
            enter => {
                let g = enter.appendGuy()
                    .classed("node",true)
                    .attr("transform", d => `translate(${d.x}, ${d.y})`)
                    .on("click", updatePositions)
                return nodeFun(g);
            },
            update => nodeFun(tran(update)),
            exit => exit.remove()
        );
    }

    update(obj => obj);

    function dragStarted(event, d) {
        d3.select(this).raise().classed("active", true);
    }

    function dragged(event, d) {
        if (d.xslide) d.x = event.x;
        if (d.yslide) d.y = event.y;
        update(obj => obj);
    }

    function dragEnded(event, d) {
        d3.select(this).classed("active", false);
    }

    let randNode = node => {
        node.x = Math.random() * 600 + 100;
        node.y = Math.random() * 400 + 100;
        node.head = Math.random() * 30 + 10;
        return node;
    };
    function updatePositions(event, d) {
        let n = nodes.length;
        nodes.push(randNode({ id: n+1, name: "New"}));
        links.push({ source: n, target: n+1 });
        update(obj => obj.transition().duration(1000));
        nodes.forEach(randNode);
        //console.log(nodes);
        
        update(obj => obj.transition().duration(1000));
    }
</script>
