# Title

$\newcommand{\mat}[1]{\left[\begin{matrix}#1\end{matrix}\right]}\newcommand{\mat}[1]{\left[\begin{matrix}#1\end{matrix}\right]}$
Derivation of force balance in a spring under tension.

From Hook's law:
\(F = kx\)

Calculating balance on two end points:
\(\begin{cases}
    F_0 + (x_1 - x_0)k &= 0\\
    F_1 - (x_1 - x_0)k &= 0
\end{cases}\)
In matrix form:
\(\mat{k&-k\\-k&k}\mat{x_0\\x_1}=\mat{F_0\\F_1}\)

<svg width="800" height="600" class="fig1"></svg>

<script src="https://d3js.org/d3.v7.min.js"></script>

<script >
    // Sample data
    let nodes = [
        { id: 1, type: "Wall", name: "Wall", head: 20, x: 0, y: 0 },
        { id: 2, type: "Guy",  name: "Bob", head: 15, x: 100, y: 0 }
    ];
    let links = [
        { source: 1, target:2 , length: 70, k: 1 }
    ];
    let grabber = [
        { moveX: true, moveY: false, x:100, y:0 }
    ];

    links.forEach(link => {
        let source = nodes.find(node => node.id === link.source);
        let target = nodes.find(node => node.id === link.target);
        let dx = source.x - target.x;
        let dy = source.y - target.y;
        let d = Math.sqrt(dx*dx+dy*dy);
        link.force = (d-link.target)*link.k;
        return link;
    });

    // Create SVG container
    const svg = d3.select(".fig1").append("g").attr("transform", "translate(50, 50)");

    // Define drag behavior
    const drag = d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded);

    d3.selection.prototype.append_spring = function() { 
        return this
            .append("line")
            .attr("stroke", "currentColor");
    };
    d3.selection.prototype.spring_attr = function() {
        return this
            .attr("x1", d => nodes.find(node => node.id === d.source).x)
            .attr("y1", d => nodes.find(node => node.id === d.source).y)
            .attr("x2", d => nodes.find(node => node.id === d.target).x)
            .attr("y2", d => nodes.find(node => node.id === d.target).y);
    };
    d3.selection.prototype.append_guy = function() {
        let g = this.append("g")
            .attr("class","node")
            .attr("transform", d => `translate(${d.x}, ${d.y})`)
            .call(drag);
        g.append("circle").attr("class","head")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("fill", "lightblue")
            .attr("r", d => d.head / 2);
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", 50)
            .attr("stroke", "black");
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 50)
            .attr("x2", -10)
            .attr("y2", 100)
            .attr("stroke", "black");
        g.append("line")
            .attr("x1", 0)
            .attr("y1", 50)
            .attr("x2", 10)
            .attr("y2", 100)
            .attr("stroke", "black");
        g.append("text")
            .attr("x", 0)
            .attr("y", 120)
            .attr("text-anchor", "middle")
            .text(d => d.name);
        return g;
    }
    d3.selection.prototype.guy_attr = function() {
        return this.attr("transform", d => `translate(${d.x}, ${d.y})`);
    }

    svg.selectAll(".link")
        .data(links)
        .join(enter => enter.append_spring().attr("class","edge"))
        .spring_attr();

    svg.selectAll(".node")
        .data(nodes, function(d){return d.id})
        .join(enter => enter.append_guy().attr("class","node"))
        .guy_attr();

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

</script>


<p id="loading">Please wait, webR is working on producing a plot...</div>
    <p id="link-container"></p>
    <script type="module">
      import { WebR } from 'https://webr.r-wasm.org/latest/webr.mjs';
      const webR = new WebR();
      await webR.init();

      // Create a PDF file containing a plot
      await webR.evalRVoid(`
        pdf()
        hist(rnorm(10000))
        dev.off()
      `);

      // Obtain the contents of the file from the VFS
      const plotData = await webR.FS.readFile('/home/web_user/Rplots.pdf');

      // Create a link for the user to download the file contents
      const blob = new Blob([plotData], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.download = 'Rplots.pdf';
      link.href = URL.createObjectURL(blob);
      link.textContent = 'Click to download PDF';
      document.getElementById('link-container').appendChild(link);

      // Everything is ready, remove the loading message
      document.getElementById('loading').remove();
    </script>