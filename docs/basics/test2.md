# Test Image

<div id="img1"></div>
<script type="module">
    const width = 640;
    const height = 400;
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr('stroke', 'currentColor')
        .attr('fill', 'currentColor');
    const gr = svg.append("g").attr("transform", "translate(200,100)");
    gr.append("path").attr("d", d3.arc()({outerRadius: 10,startAngle: 0,endAngle: Math.PI * 2}));
    gr.append("path").attr("transform", "translate(50,0)").attr("d", d3.arc()({outerRadius: 10,startAngle: 0,endAngle: Math.PI * 2}));
    gr.append("path").attr("d", d3.line()([
        [0, 80],
        [100, 100],
        [200, 30],
        [300, 50],
        [400, 40],
        [500, 80]
    ])).attr("fill-opacity",0);
    // Append the SVG element.
    img1.append(svg.node());
</script>
