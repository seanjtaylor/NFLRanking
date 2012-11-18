
var matrix = function(body, json, opts) {
    var margin = opts.margin,
        height = opts.height,
        width = opts.width;

    var x = d3.scale.ordinal().rangeBands([0, width]),
    z = d3.scale.linear().domain([0, 4]).clamp(true),
    c = d3.scale.category10().domain(d3.range(2));

    var svg = d3.select(body).append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.style("margin-left", -margin.left + "px")
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.json(json, function(season) {
	var matrix = [],
	nodes = season.nodes,
	n = nodes.length;

	// Compute index per node.
	nodes.forEach(function(node, i) {
	    node.index = i;
	    node.count = 0;
	    matrix[i] = d3.range(n).map(function(j) { return {x: j, y: i, z: 0}; });
	});

	season.links.forEach(function(link) {
	    matrix[link.source][link.target].z += link.value;
	    matrix[link.source][link.source].z += link.value;
	    nodes[link.source].count += link.value;
	});

	// Precompute the orders.
	var orders = {
	    name: d3.range(n).sort(function(a, b) { return d3.ascending(nodes[a].name, nodes[b].name); }),
	    orank: d3.range(n).sort(function(a, b) { return d3.ascending(nodes[a].orank, nodes[b].orank); }),
            brank: d3.range(n).sort(function(a, b) { return d3.ascending(nodes[a].brank, nodes[b].brank); }),
	    count: d3.range(n).sort(function(a, b) { return nodes[b].count - nodes[a].count; })
	};

	var losses = {
	    name: 0,
	    orank: 0,
            brank: 0,
	    count: 0
	};
	// Compute losses.
	for (ordering in losses) {
	    season.links.forEach(function(link) {
		x.domain(orders[ordering]);
		if (x(link.source) > x(link.target)) {
		    losses[ordering] += 1;
		}
	    });
	}
	
	// The default sort order.
	x.domain(orders.name);
	d3.select('#loss').html(losses.name);

	svg.append("rect")
	    .attr("class", "background")
	    .attr("width", width)
	    .attr("height", height);

	var row = svg.selectAll(".row")
	    .data(matrix)
	    .enter().append("g")
	    .attr("class", "row")
	    .attr("transform", function(d, i) { return "translate(0," + x(i) + ")"; })
	    .each(row);

	row.append("line")
	    .attr("x2", width);

	row.append("text")
	    .attr("x", -6)
	    .attr("y", x.rangeBand() / 2)
	    .attr("dy", ".32em")
	    .attr("text-anchor", "end")
	    .text(function(d, i) { return nodes[i].name; });

	var column = svg.selectAll(".column")
	    .data(matrix)
	    .enter().append("g")
	    .attr("class", "column")
	    .attr("transform", function(d, i) { return "translate(" + x(i) + ")rotate(-90)"; });

	column.append("line")
	    .attr("x1", -width);

	column.append("text")
	    .attr("x", 6)
	    .attr("y", x.rangeBand() / 2)
	    .attr("dy", ".32em")
	    .attr("text-anchor", "start")
	    .text(function(d, i) { return nodes[i].name; });

	function row(row) {
	    var cell = d3.select(this).selectAll(".cell")
		.data(row.filter(function(d) { return d.z; }))
		.enter().append("rect")
		.attr("class", "cell")
		.attr("x", function(d) { return x(d.x); })
		.attr("width", x.rangeBand())
		.attr("height", x.rangeBand())
		.style("fill-opacity", function(d) { return z(d.z); })
		.style("fill", function(d) { return nodes[d.x].group == nodes[d.y].group ? c(nodes[d.x].group) : null; })
		.on("mouseover", mouseover)
		.on("mouseout", mouseout);
	}

	function mouseover(p) {
	    d3.selectAll(".row text").classed("active", function(d, i) { return i == p.y; });
	    d3.selectAll(".column text").classed("active", function(d, i) { return i == p.x; });
	}

	function mouseout() {
	    d3.selectAll("text").classed("active", false);
	}

	d3.select("#order").on("change", function() {
	    clearTimeout(timeout);
	    order(this.value);
	    d3.select('#loss').html(losses[this.value]);
	});

	function order(value) {
	    
	    x.domain(orders[value]);

	    var t = svg.transition().duration(500);

	    t.selectAll(".row")
		.delay(function(d, i) { return x(i) * 4; })
		.attr("transform", function(d, i) { return "translate(0," + x(i) + ")"; })
		.selectAll(".cell")
		.delay(function(d) { return x(d.x) * 4; })
		.attr("x", function(d) { return x(d.x); });

	    t.selectAll(".column")
		.delay(function(d, i) { return x(i) * 4; })
		.attr("transform", function(d, i) { return "translate(" + x(i) + ")rotate(-90)"; });
	}

	var timeout = setTimeout(function() {
	    order("group");
	    d3.select("#order").property("selectedIndex", 2).node().focus();
	}, 5000);
    });

}

var graph = function() {
    var w = 960,
    h = 720;

    var svg = d3.select("body").append("svg:svg")
	.attr("width", w)
	.attr("height", h);

    // Per-type markers, as they don't inherit styles.
    svg.append("svg:defs").selectAll("marker")
	.data(["fas", "nonfas"])
	.enter().append("svg:marker")
	.attr("id", String)
	.attr("viewBox", "0 -5 10 10")
	.attr("refX", 15)
	.attr("refY", -1.5)
	.attr("markerWidth", 6)
	.attr("markerHeight", 6)
	.attr("orient", "auto")
	.append("svg:path")
	.attr("d", "M0,-5L10,0L0,5");

    d3.json("nfl2010.json", function(graph) {

	var force = d3.layout.force()
	    .nodes(d3.values(graph.nodes))
	    .links(graph.links)
	    .size([w, h])
	    .linkDistance(300)
	    .charge(-300)
	    .on("tick", tick)
	    .start();

	var path = svg.append("svg:g").selectAll("path")
	    .data(force.links())
	    .enter().append("svg:path")
	    .attr("class", function(d) { if (d.fas) { return "link fas";} else { return "link" }})
	    .attr("marker-end", function(d) { if (d.fas) { return "url(#fas)"; } else { return "url(#nonfas)"; }});

	var circle = svg.append("svg:g").selectAll("circle")
	    .data(force.nodes())
	    .enter().append("svg:circle")
	    .attr("r", 6)
	    .call(force.drag);

	var text = svg.append("svg:g").selectAll("g")
	    .data(force.nodes())
	    .enter().append("svg:g");

	// A copy of the text with a thick white stroke for legibility.
	text.append("svg:text")
	    .attr("x", 8)
	    .attr("y", ".31em")
	    .attr("class", "shadow")
	    .text(function(d) { return d.name; });

	text.append("svg:text")
	    .attr("x", 8)
	    .attr("y", ".31em")
	    .text(function(d) { return d.name; });

	// Use elliptical arc path segments to doubly-encode directionality.
	function tick() {
	    path.attr("d", function(d) {
		var dx = d.target.x - d.source.x,
		dy = d.target.y - d.source.y,
		dr = Math.sqrt(dx * dx + dy * dy);
		return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
	    });

	    circle.attr("transform", function(d) {
		return "translate(" + d.x + "," + d.y + ")";
	    });

	    text.attr("transform", function(d) {
		return "translate(" + d.x + "," + d.y + ")";
	    });
	}
    });
}


