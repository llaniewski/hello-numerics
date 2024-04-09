# Springs

<svg xmlns="http://www.w3.org/2000/svg">
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
</svg>

<svg width="800" height="600" id="pic1"></svg>

<style>
    .pen1 {
        stroke: #ac2b3c;
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
</style>

<script type="module">
    // Sample data
    let nodes = [
        { id: 1, name: "Node 1", head: 20, x: 100, y: 50 },
        { id: 2, name: "Node 2", head: 15, x: 200, y: 100 },
        { id: 3, name: "Node 3", head: 25, x: 300, y: 50 },
        { id: 4, name: "Node 4", head: 18, x: 400, y: 100 }
    ];

    const links = [
        { source: 1, target: 2 },
        { source: 1, target: 3 },
        { source: 2, target: 4 },
        { source: 3, target: 4 }
    ];

    // Create SVG container
    const svg = d3.select("#pic1");

    // Define drag behavior
    const drag = d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded);

    d3.selection.prototype.appendGuy = function() {
        let g = this.append("g");
        g.classed("penfilter",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", 50)
            .classed("pen1",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 50)
            .attr("x2", -10)
            .attr("y2", 100)
            .classed("pen1",true);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 50)
            .attr("x2", 10)
            .attr("y2", 100)
            .classed("pen1",true);
        g.append("text")
            .attr("x", 0)
            .attr("y", 120)
            .attr("text-anchor", "middle");
        g.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .classed("pen1fill",true);
        return g;
    };
    function update(tran) {
        console.log("update");
        let linkFun = link => link
            .attr("x1", d => nodes.find(node => node.id === d.source).x)
            .attr("y1", d => nodes.find(node => node.id === d.source).y)
            .attr("x2", d => nodes.find(node => node.id === d.target).x)
            .attr("y2", d => nodes.find(node => node.id === d.target).y);
        let nodeFun = node => {
            node.attr("transform", d => `translate(${d.x}, ${d.y})`);
            node.select("circle").attr("r", d => d.head / 2);
            return node;
        };
        const linkGroup = svg.selectAll(".edge").data(links)
        .join(
            enter => linkFun(enter.append("line").classed("edge",true).classed("pen1",true)),
            update => linkFun(tran(update)),
            exit => exit.remove()
        );
        const nodeGroup = svg.selectAll(".node").data(nodes, function(d){return d.id})
        .join(
            enter => {
                let g = enter.appendGuy()
                    .classed("node",true)
                    .attr("transform", d => `translate(${d.x}, ${d.y})`)
                    .call(drag)
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
        d.x = event.x;
        d.y = event.y;
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
