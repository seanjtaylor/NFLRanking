
var winMatrix = function() {
    var opts = {
        width: 600,
        height: 600,
        margin_left: 30,
        margin_right: 0,
        margin_top: 30,
        margin_bottom: 0,
    };
    var svg = d3.select('#win-matrix');
    var square = svg
        .attr("width", opts.width + opts.margin_left + opts.margin_right)
        .attr("height", opts.height + opts.margin_top + opts.margin_bottom)
        .append("g")
        .attr("transform", "translate(" + opts.margin_left + "," + opts.margin_top + ")");
    square.append("rect")
	    .attr("class", "background")
	    .attr("width", opts.width)
	    .attr("height", opts.height)
        .attr("style", "fill: #EEE;");

	var x = d3.scale.ordinal().rangeBands([opts.margin_top, opts.width+opts.margin_top]);
    
    d3.csv('../all.games.csv', function(games) {
	games.forEach(function(g) {
	    g.WEEK = parseInt(g.WEEK);
	    g.SEAS = parseInt(g.SEAS);
            g.PTSH = parseInt(g.PTSH);
            g.PTSV = parseInt(g.PTSV);
	});
        var teams = {};
        games.forEach(function(x) {
            teams[x.H] = 1;
        });
        teams = d3.keys(teams).sort();
		x.domain(teams);

        var labels = square.selectAll("text")
            .data(teams)
            .enter();

        labels.append("text")
            .attr("x", -opts.margin_left)
            .attr("y", function(d) { return x(d) - 15;})
            .attr("class", "team-name")
            .text(function(d, i) { return d; });

        labels.append("text")
            .attr("x", 0)
            .attr("y", function(d) {return x(d) - 15;})
            .attr("class", "team-name")
			.attr("transform", function(d, i) { return "rotate(-90)"; })
            .text(function(d, i) { return d; });

	console.log(teams.map(x));
	var diag = svg.selectAll("rect")
	    .data(teams)
	    .enter().append("rect")
	    .attr("class", "diag-cell")
            .attr("y", x)
	    .attr("x", x)
            .attr("width", x.rangeBand())
	    .attr("height", x.rangeBand());

        var drawMatrix = function(e) {
	    var season = parseInt(d3.select('#win-matrix-season').property("value"));
	    var week = parseInt(d3.select('#win-matrix-week').property("value"));
	    svg.selectAll(".win-cell").remove();

			
	    var g = games.filter(function(d) { return (d.SEAS == season) && (d.WEEK <= week)});
	    var cells = svg.selectAll("rect")
		.data(g)
		.enter().append("rect")
		.attr("class", "win-cell")
		.attr("y", function(d) { return (d.PTSH > d.PTSV) ? x(d.H) : x(d.V); })
		.attr("x", function(d) { return (d.PTSH > d.PTSV) ? x(d.V) : x(d.H); })
	        .attr("style", function(d) { return 'fill: ' + ((((x(d.H) < x(d.V)) && (d.PTSH > d.PTSV)) || ((x(d.V) < x(d.H)) && (d.PTSV > d.PTSH))) ? '#1f77b4' : '#ff7f0e');})
		.attr("width", x.rangeBand())
		.attr("height", x.rangeBand());
            d3.select("#selected-season").text(season.toString());
	    d3.select("#selected-week").text(week.toString());
        };
        drawMatrix();
        d3.select('#win-matrix-season').on('change', drawMatrix);
	d3.select('#win-matrix-week').on('change', drawMatrix);
    });
}

var gameGraph = function() {
d3.csv('../all.games.csv', function(games) {

    games.forEach(function(g) {
	g.WEEK = parseInt(g.WEEK);
	g.SEAS = parseInt(g.SEAS);
        g.PTSH = parseInt(g.PTSH);
        g.PTSV = parseInt(g.PTSV);
    });

    var w = 600,
        h = 600;

    var svg = d3.select("#game-graph")
	.attr("width", w)
	.attr("height", h);

    // Per-type markers, as they don't inherit styles.
    svg.append("svg:defs").append("svg:marker")
	.attr("id", "marker")
	.attr("viewBox", "0 -5 10 10")
	.attr("refX", 15)
	.attr("refY", -1.5)
	.attr("markerWidth", 10)
	.attr("markerHeight", 10)
	.attr("orient", "auto")
	.append("svg:path")
	.attr("d", "M0,-5L10,0L0,5");

var drawGraph = function() {

    var season = parseInt(d3.select('#game-graph-season').property("value"));
    var week = parseInt(d3.select('#game-graph-week').property("value"));

    var nodes = {};
    var links = [];
    var byRecord = {};

    var source, target;

    games.forEach(function(game) {
	if (game.SEAS != season || game.WEEK > week) {
	    return;
	}
	if (game.PTSH > game.PTSV) {
            source = game.H;
            target = game.V;
	} else {
            source = game.V;
            target = game.H;
	}
	links[links.length] = {
            source: source,
            target: target,
	};
    })

    console.log(links.length)

    // Compute the distinct nodes from the links.
    links.forEach(function(link) {
	link.source = nodes[link.source] || (nodes[link.source] = {name: link.source, wins: 0, losses: 0});
	link.target = nodes[link.target] || (nodes[link.target] = {name: link.target, wins: 0, losses: 0});
	link.source.wins += 1;
	link.target.losses += 1;
    });

    for (var i=0; i <= 16; i++) {
	byRecord[i] = 0;
    }

    d3.values(nodes).forEach(function(node) {
	node.xposition = byRecord[node.wins];
	byRecord[node.wins] += 1;
    });

    var height = d3.scale.linear()
	.domain(d3.extent(d3.values(nodes), function(n) {return n.wins}))
	.range([h-40, 0+40]);

    var width = function(x, wins) {
	var prop = (x + 1) / (byRecord[wins] + 1);
	return prop * (w - 80) + 40;
    };

    var main = d3.select("#game-graph");
    main.select('#graph-stuff').remove();

    var svg = main.append('svg:g').attr('id', 'graph-stuff');


    var path = svg.append("svg:g").selectAll("path")
	.data(links)
	.enter().append("svg:line")
	.attr('x1', function(d){ return width(d.source.xposition, d.source.wins); })
	.attr('x2', function(d){ return width(d.target.xposition, d.target.wins); })
	.attr('y1', function(d){ return height(d.source.wins); })
	.attr('y2', function(d){ return height(d.target.wins); })
	.attr("stroke", "black")
	.attr("opacity", .5)
        .attr("marker-end", function(d) { return "url(#marker)"; });

    var logos = svg.append("svg:g").selectAll("image")
	.data(d3.values(nodes))
	.enter().append("svg:g");

    logos.append("svg:image")
	.attr("width", 50)
	.attr("height", 25)
	.attr("xlink:href", function(d) { return "../logos/" + d.name + ".png"});

    logos.attr("transform", function(d) {
	return "translate(" + width(d.xposition, d.wins) + "," + height(d.wins) + ")";
    });


    d3.select("#gg-selected-season").text(season.toString());
    d3.select("#gg-selected-week").text(week.toString());

}
    drawGraph();
    d3.select('#game-graph-season').on('change', drawGraph);
    d3.select('#game-graph-week').on('change', drawGraph);

});
}
