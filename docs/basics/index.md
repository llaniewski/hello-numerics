# Basics

<div id="trala2"></div>
<script type="module">
    const width = 640;
    const height = 400;
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height);
    svg
    .append("path")
    .attr("transform", "translate(400,200)")
    .attr("d", d3.arc()
        .innerRadius( 100 )
        .outerRadius( 150 )
        .startAngle( 3.14 )     // It's in radian, so Pi = 3.14 = bottom.
        .endAngle( 6.28 )       // 2*Pi = 6.28 = top
        )
    .attr('stroke', 'currentColor')
    .attr('fill', 'backgroundColor');
    // Append the SVG element.
    trala2.append(svg.node());
</script>

<div id="trala"></div>
<script type="module">
    // Declare the chart dimensions and margins.
    const width = 640;
    const height = 400;
    const marginTop = 20;
    const marginRight = 20;
    const marginBottom = 30;
    const marginLeft = 40;
    // Declare the x (horizontal position) scale.
    const x = d3.scaleUtc()
        .domain([new Date("2023-01-01"), new Date("2024-01-01")])
        .range([marginLeft, width - marginRight]);
    // Declare the y (vertical position) scale.
    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([height - marginBottom, marginTop]);
    // Create the SVG container.
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height);
    // Add the x-axis.
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x));
    // Add the y-axis.
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y));
    // Append the SVG element.
    trala.append(svg.node());
</script>
