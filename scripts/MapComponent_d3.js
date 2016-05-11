Flox.MapComponent_d3 = function() {
	"use strict";

	var svg,
	    selectedColor = "#59A4FF",
	    defaultColor = "black",
	    active = d3.select(null),
	    path,
	    width = $(window).width(),
	    height = $(window).height(),
	   
	    mapScale = 1,
	    
	    background,
	    
	    projection_albersUsa = d3.geo.albersUsa().scale(20000).translate([width / 2, height / 2]),
	    projection_mercator = d3.geo.mercator().scale(20000).translate([width / 2, height / 2]),
	    //projection_conicEqualArea = d3.geo.conicEqualArea().scale(1).translate([width / 2, height / 2]),
	    projection = projection_albersUsa,
	    
	    // TODO the scale setting below could be set to zoom in to the bounding
	    // box of the lower 48 based on the window size. 
	    zoom = d3.behavior.zoom().translate([width / 2, height / 2]).scale(0.06).scaleExtent([0.05, 80])// change these numbers to be able to zoom in or out further.
	.on("zoom", zoomed),

	    i,
	    j,
	    my = {};

	// Create a map! Add a baselayer, initialize all the panning and zooming
	// and whatnot, add it all to the map div.
	function initMap() {

		// Make a d3 path object, which will handle translating path objects
		// onto the projection. I think. 
		path = d3.geo.path().projection(projection);
		
		// Create the svg element to hold all the map features.
		svg = d3.select("#map").append("svg").attr("width", width).attr("height", height).on("click", stopped, true);


		// MAP LAYERS ------------------------------------
		// Add a background layer for detecting pointer events
		
		
		background = svg.append("rect").attr("class", "background").attr("width", width).attr("height", height).on("click", reset);
		var mapFeaturesLayer = svg.append("g").attr("id", "mapFeaturesLayer"),
			statesLayer = mapFeaturesLayer.append("g").attr("id", "statesLayer"),
			countiesLayer = mapFeaturesLayer.append("g").attr("id", "countieslayer");
		
		mapFeaturesLayer.append("g").attr("id", "flowsLayer");
		
		
		$(window).resize(function() {
			width = this.innerWidth;
			height = this.innerHeight;
			svg.attr("width", width).attr("height", height);
			background.attr("width", width).attr("height", height);
		});

		// Create and arrange layers in the appropriate order.


		svg.call(zoom)// delete this line to disable free zooming
		.call(zoom.event);

		d3.json("data/geometry/states_census_2015.json", function(error, us) {
			if (error) {
				throw error;
			}
			//console.log(us);
			statesLayer.selectAll("path").data(topojson.feature(us, us.objects.states)
				.features).enter().append("path")
				.attr("d", path)
				.attr("id", function(d) {
					return d.properties.STUSPS;
				})
				.attr("class", "feature state")
				.attr("stroke", "white")
				.on("click", stateClicked);
			// g.append("path")
			// .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
			// .attr("class", "mesh")
			// .attr("id", "basemapMesh")
			// .attr("d", path);
			
			
			// Load the new county polygons
			d3.json("data/geometry/countyBoundaries/counties_all.json", function(error, us) {
				if (error) {
					throw error;
				}
				countiesLayer.selectAll("path")
					.data(topojson.feature(us, us.objects.counties).features)
					.enter().append("path").attr("d", path)
				//.attr("stroke", "white")
				.attr("class", function(d) {
					return "feature county hidden FIPS" + d.properties.STATEFP;
				});
				
				
			});
			
		});
		// end d3.json

		
		
		
		// end d3.json

	}// End initMap();

	// takes a flow object, builts an SVG curve out of the 3 points, translating
	// the LatLng coordinates to screen coordinates. Also handles flow clipping.
	// Accounts for necklace map nodes.
	function buildSvgFlowPath(f, drawArrows) {

		var rs,
		    re,
		    flow,
		    sPX,
		    sPY,
		    cPX,
		    cPY,
		    ePX,
		    ePY;
		    
		if (drawArrows && f.getArrow()) {
			
			// The place where this curve is clipped will depend on whether or
			// not arrows are drawn.
			flow = f.getArrow()[6];
			rs = Flox.getFlowDistanceFromStartPointPixel() > 0 ? Flox.getStartClipRadius(f.getStartPt()) : 0;
			flow = flow.getClippedFlow(rs, 1);
			// clip the start bit off the arrowed flow
		} else {
			rs = Flox.getFlowDistanceFromStartPointPixel() > 0 ? Flox.getStartClipRadius(f.getStartPt()) : 0;
			re = Flox.getFlowDistanceFromEndPointPixel() > 0 ? Flox.getEndClipRadius(f.getEndPt()) : 0;
			flow = f.getClippedFlow(rs, re);
		}

		sPX = flow.getStartPt().x;
		sPY = flow.getStartPt().y;

		cPX = flow.getCtrlPt().x;
		cPY = flow.getCtrlPt().y;

		ePX = flow.getEndPt().x;
		ePY = flow.getEndPt().y;

		return "M" + sPX + "," + sPY + " Q" + cPX + "," + cPY + " " + ePX + "," + ePY;
	}

	function buildSvgArrowPath(f) {
		var a = f.getArrow(),
		    s;

		s = "M " + a[0].x + "," + a[0].y + " L" + a[1].x + "," + a[1].y + " Q" + a[2].x + "," + a[2].y + " " + a[3].x + "," + a[3].y + " Q" + a[4].x + "," + a[4].y + " " + a[5].x + "," + a[5].y + " L" + a[0].x + "," + a[0].y;

		// s = "M " + a.basePt.x +  "," + a.basePt.y +
		// " L" + a.corner1Pt.x + "," + a.corner1Pt.y +
		// " Q" + a.corner1cPt.x + "," + a.corner1cPt.y +
		// " "  + a.tipPt.x + "," + a.tipPt.y +
		// " Q" + a.corner2cPt.x + "," + a.corner2cPt.y +
		// " "  + a.corner2Pt.x + "," + a.corner2Pt.y +
		// " L" + a.basePt.x + "," + a.basePt.y;

		return s;
	}

	// TODO add checkbox for indicating which flows are locked.
	function getFlowColor(flow) {
		if (flow.isSelected()) {
			return selectedColor;
		}
		if (flow.isLocked() && Flox.isShowLockedFlows()) {
			return lockedColor;
		}
		return defaultColor;
	}

	function drawFlows(drawArrows) {

		Flox.configureArrows();

		var maxFlowWidth = Flox.getMaxFlowWidth(),
		    maxFlowValue = Flox.getMaxFlowValue(),
		    flows = Flox.getFlows(),
		    clippedFlows = [],
		    i,
		    j,
		    f,
		    rs,
		    re,
		    clippedFlow,
		    svgFlows,
		    curves,
		    tooltip,
		    arrows;
	
		tooltip = d3.select("body").append("div")
					.attr("class", "tooltip-flow")
					.style("display", "none");

		flows.sort(function(a, b){ return a.getValue() - b.getValue(); });

		// called svgFlows because flows is already taken!
		svgFlows = d3.select("#flowsLayer").append("g").attr("id", "svgFlows")
			.selectAll("g")// a group for each flow
			.data(flows)// flow data added to GROUP
			.enter().append("g");
	
		// Draw outlines first
		if (drawArrows) {
			svgFlows.append("path")// add a new path. This is the arrowhead!
				.classed("arrowOutline", true)
				.style("cursor", "default")
				.attr("stroke", "white")
				.attr("fill", "white")
				.attr("stroke-width", 2)
				.attr("d", function(d) {
					return buildSvgArrowPath(d);
				});
		}
		svgFlows.append("path")
			.classed("curveOutline", true)
			.attr("stroke", "white")
			.style("cursor", "default")
			.attr("fill", "none")
			.attr("stroke-width", function(d) {
				return Flox.getFlowStrokeWidth(d) + 2;
			})
			.attr("d", function(d) {
				return buildSvgFlowPath(d, drawArrows);
			})
			
	
	
		// Draw arrowheads
		if (drawArrows) {
			svgFlows.append("path")// add a new path. This is the arrowhead!
				.classed("arrow", true)
				.style("cursor", "default")
				.attr("stroke", "none")
				.attr("fill", function(d) {
					return getFlowColor(d);
					//return "none";
				})
				.attr("stroke-width", 5)
				.attr("d", function(d) {
					return buildSvgArrowPath(d);
				})				
		}

		// Draw flow curves
		svgFlows.append("path")
			.classed("curve", true)
			.attr("stroke", function(d) {
				return getFlowColor(d);
			})
			.style("cursor", "default")
			.attr("fill", "none")
			.attr("stroke-width", function(d) {
				return Flox.getFlowStrokeWidth(d);
			})
			.attr("d", function(d) {
				return buildSvgFlowPath(d, drawArrows);
			});
		
		function flowMouseover(d){
			tooltip.style("display", "inline");
	    }

		function flowMousemove(d) {
			tooltip.html("Value: " + d.getValue() + "<br/>" + 
			             "From: " + d.getStartPt().id + "<br/>" + 
			             "To: " + d.getEndPt().id )
			       .style("left", (d3.event.pageX + 1) + "px")
			       .style("top", (d3.event.pageY - 34) + "px");
		}

		function flowMouseout(d) {
			tooltip.style("display", "none");
		}
         
        svgFlows.on("mouseover", function(d) {
			tooltip.style("display", "inline");
			d3.select(this).select(".curve").attr("stroke", "yellow");
			d3.select(this).select(".arrow").attr("fill", "yellow");
        })
        .on("mousemove", function(d) {
			tooltip.html("Value: " + d.getValue() + "<br/>" + 
			             "From: " + d.getStartPt().id + "<br/>" + 
			             "To: " + d.getEndPt().id )
			       .style("left", (d3.event.pageX + 4) + "px")
			       .style("top", (d3.event.pageY - 34) + "px");
        })
        .on("mouseout", function() {
			tooltip.style("display", "none");
			d3.select(this).select(".curve").attr("stroke", "black");
			d3.select(this).select(".arrow").attr("fill", "black");
        });
	}

	function drawPoints() {
		var points = Flox.getPoints(),
		    circles = d3.select("#mapFeaturesLayer").append("g").attr("id", "pointsLayer").selectAll("circle").data(points).enter().append("circle");

		// Add some attributes to the points
		circles.style("stroke", "black").style("stroke-width", function(d) {
			return Flox.getNodeStrokeWidth();
		}).style("fill", "white").style("stroke", function(d) {// adjust the color
			if (d.selected) {
				return "#59A4FF";
			}
			return "black";
		}).style("cursor", "default").attr("r", function(d) {
			return Flox.getNodeRadius(d);
		}).attr("cx", function(d) {
			return d.x;
		}).attr("cy", function(d) {
			return d.y;
		});
	}

	function drawFeatures(settings) {

		var drawArrows = settings.drawArrows;

		if (settings.drawFlows) {
			drawFlows(drawArrows);
		}

		if (settings.drawNodes) {
			drawPoints();
		}
	}

	function showCountyBordersWithinState(stateString) {
		d3.selectAll(".FIPS" + stateString).classed("hidden", false);
	}

	function hideAllCountyBorders() {
		d3.selectAll(".county").classed("hidden", true);
	}

	function drawCircles(circlesArray) {
		// Add a circles layer for drawing necklace map circles
		d3.select("#mapFeaturesLayer").append("g").attr("id", "circlesLayer");

		// Create svg circles
		var circles = d3.select("#circlesLayer").selectAll("circle").data(circlesArray).enter().append("circle");

		// Attribute the circles
		circles.style("stroke", "black").style("stroke-width", 8).style("fill", "none").attr("r", function(d) {
			return d.r;
		}).attr("cx", function(d) {
			return d.x;
		}).attr("cy", function(d) {
			return d.y;
		});
	}

	// Returns x, y, and radius of a circle containing a bounding box.
	function getCircleAroundBoundingBox(bb) {

		// Center point of bb
		var left = bb[0][0],
		    right = bb[1][0],
		    top = bb[0][1],
		    bottom = bb[1][1],

		    dx = right - left, // right - left
		    dy = bottom - top, // bottom - top
		    x = left + (dx / 2), // left + dx/2
		    y = top + (dy / 2), // top + dy/2

		// Radius of the circle? This would be the distance from the center
		// point to any corner.
		    dist = Math.sqrt((dx / 2) * (dx / 2) + (dy / 2) * (dy / 2)),
		    centerXY;

		// TODO make the r slightly larger. Perhaps 10%

		return {
			cx : x,
			cy : y,
			r : dist
		};
	}

	// This works.
	function getCirclesAtBoundingBoxCorners(bb) {
		var leftTop,
		    leftBottom,
		    rightTop,
		    rightBottom;

		leftTop = {
			cx : bb[0][0],
			cy : bb[0][1],
			r : 50
		};
		leftBottom = {
			cx : bb[0][0],
			cy : bb[1][1],
			r : 50
		};
		rightTop = {
			cx : bb[1][0],
			cy : bb[0][1],
			r : 50
		};
		rightBottom = {
			cx : bb[1][0],
			cy : bb[1][1],
			r : 50
		};

		return [leftTop, leftBottom, rightTop, rightBottom];
	}

	function removeAllCircles() {
		// Select and remove the circles layer?
		var circlesLayer = d3.select("#circlesLayer").remove();
	}

	/**
	 * Gets the center point of a d3-style bounding box, where:
	 * [[left, top][right, bottom]]
	 *
	 * Returns: object {x,y}
	 */
	function getCenterOfBoundingBox(bb) {
		// Center point of bb
		var left = bb[0][0],
		    right = bb[1][0],
		    top = bb[0][1],
		    bottom = bb[1][1],

		    dx = right - left, // right - left
		    dy = bottom - top, // bottom - top
		    x = left + (dx / 2), // left + dx/2
		    y = top + (dy / 2);
		// top + dy/2

		return {
			x : x,
			y : y
		};
	}

	/**
	 * Find the intersection on a circle between a line from the center of
	 * the circle to a point.
	 * If the point is inside the circle, return the point.
	 *
	 * @param {x, y} pt The point to be projected
	 * @param {cx, cy, r} circle The circle to find the projected point on
	 */
	function getProjectedPointOnCircle(pt, circle) {
		var d,
		    dx,
		    dy,
		    x,
		    y;

		// Get the distance between the points
		dx = pt.x - circle.cx;
		dy = pt.y - circle.cy;
		d = Math.sqrt(dx * dx + dy * dy);

		if (d === 0) {
			//console.log("pt is the center of the circle");
			return {
				x : circle.cx,
				y : circle.cy
			};
		}

		if (d <= circle.r) {
			//console.log("pt is inside the circle");
			return {
				x : pt.x,
				y : pt.y
			};
		}

		x = circle.cx + (dx * circle.r / d);
		y = circle.cy + (dy * circle.r / d);

		return {
			x : x,
			y : y
		};
	}

	/**
	 * Places circles on outerCircle that correspond to the states array.
	 *
	 * @param {cx, cy, r} outerCircle Circle around central state.
	 * @param {[states]} states Array of state abbreviations to make circles for.
	 */
	function getStateCircles(outerCircle, states) {

		var statePolygons = [],
		    stateCircles = [],
		    i,
		    j,
		    bbCenter,
		    bb,
		    pt,
		    centroid;

		// Get the state polygons in an array
		d3.selectAll("#statesLayer").selectAll(".feature.state").each(function(d) {
			if (states.indexOf(d.properties.STUSPS) > -1) {// Is this state in states?
				statePolygons.push(d);
			}
		});

		// Loop over the polygons
		for ( i = 0, j = statePolygons.length; i < j; i += 1) {

			centroid = path.centroid(statePolygons[i]);

			// Change the format of the centroid point. Annoying.
			// I should just make getProjectedPointOnCircle use the d3 array
			// the way it comes out.
			centroid = {
				x : centroid[0],
				y : centroid[1]
			};

			pt = getProjectedPointOnCircle(centroid, outerCircle);

			pt.STUSPS = statePolygons[i].properties.STUSPS;
			pt.necklaceMapNode = true;
			
			// set the radius now. How do you do this later?
			pt.r = outerCircle.r * 0.1;
			pt.strokeWidth = pt.r * 0.15;
			
			stateCircles.push(pt);
		}

		return stateCircles;
	}

	/**
	 * Zooms in to the provided json-based d3-style feature object. Needs
	 * to be compatible with the d3.geo.path().bounds(d) function. 
	 */
	function zoomToPolygon(d){
		var bounds = path.bounds(d),
			dx = bounds[1][0] - bounds[0][0],
		    dy = bounds[1][1] - bounds[0][1],
		    x = (bounds[0][0] + bounds[1][0]) / 2,
		    y = (bounds[0][1] + bounds[1][1]) / 2,
		    scale = 0.6 / Math.max(dx / width, dy / height),
		    translate = [width / 2 - scale * x, height / 2 - scale * y];
		    
		svg.transition()
		.duration(1000)
		.call(zoom.translate(translate).scale(scale).event);
	}

	/**
	 * Does all the things needed when a state is selected. Makes a necklace
	 * map, zooms in, lays out the flows, displays the flows, everything.
	 * @param {object} Object containing the geometry and properties of the 
	 * selected state. 
	 */
	function selectState(stateAbbreviation) {
		
		var statePolygon, 
			stateBoundingBox,
			outerCircle,
		    testStates,
		    stateCircles;
		
		// Clear out all flows and necklace maps.
		d3.select("#flowsLayer").selectAll("g").remove();
		d3.select("#necklaceMapLayer").remove(); 
		
		// get the statePolygon, yes?
		d3.select("#" + stateAbbreviation).each(function(d) {
			statePolygon = d; // Yes!
		});
		
		// Tell the importer which flows need loadin'
		Flox.importNetCountyFlowData(statePolygon.properties.STUSPS);
		
		//zoomToPolygon(statePolygon); // Zoom in!
		// As soon as the layout operation begins, the zoom freezes. 
		// Layout needs to occur in a webworker. 
		
		// Hide county boundaries
		hideAllCountyBorders();
		removeAllCircles();

		// Show just the county boundaries for the selected state
		showCountyBordersWithinState(statePolygon.properties.STATEFP);
		
		// Necklace map stuff all needs to happen after the flows are loaded
		// and the model has processed them. In other words, not here. 
		
		// // Get circle around the state bounding box
		// stateBoundingBox = path.bounds(statePolygon);
		// outerCircle = getCircleAroundBoundingBox(stateBoundingBox);
// 
		// console.log("State: " + statePolygon.properties.STUSPS + ", FIPS: " + statePolygon.properties.STATEFP);
// 
		// // Figure out which states besides the selected one have flows
		// // what need showin'
		// testStates = ["WA", "FL", "ME", "TX", "CA", "WV", "CO"];
// 		
		// stateCircles = getStateCircles(outerCircle, testStates);
		// //console.log(stateCircles);
		// //drawCircles([outerCircle]);
		// drawCircles(stateCircles);
// 			
		// addNecklaceMap(outerCircle, stateCircles);
		// //console.log(path.centroid(d));
		
	}


	// Selects the state. 
	function stateClicked(d) {

		// If the currently active state was clicked, reset.
		// TODO this should happen in selectState somehow.
		// "this" is the SVG path object that was clicked. I think.
		if (active.node() === this) {
			return reset();
		}
		// Remove active class from currently active state, add active class
		// to the state that was clicked.
		active.classed("active", false);
		active = d3.select(this).classed("active", true);
		// Select the state
		selectState(d.properties.STUSPS);

		
	}

	
	// Zooms out to full extent, deselects everything, hides all county
	// boundaries.
	function reset() {
		active.classed("active", false);
		active = d3.select(null);

		d3.selectAll(".county").classed("hidden", true);
		removeAllCircles();
		d3.select("#flowsLayer").selectAll("g").remove();
		
		// Also remove all necklace maps.
		d3.select("#necklaceMapLayer").remove(); 

		svg.transition().duration(750).call(zoom.translate([width / 2, height / 2]).scale(0.06).event);
	}

	function zoomed() {
		var g = svg.select("#mapFeaturesLayer");
		//flows = d3.select("#flowsLayer").selectAll(".curve"),
		//arrows = d3.select("#flowsLayer").selectAll(".arrow");

		// // Flows maintain stoke width at all zooms.
		// flows.attr("stroke-width", function(d) {
		// var width = Flox.getFlowStrokeWidth(d);
		// return width/d3.event.scale + "px";
		// });
		mapScale = d3.event.scale;

		//console.log(mapScale);
		//Flox.setMapScaleInModel(mapScale);

		g.style("stroke-width", 1 / mapScale + "px");
		g.attr("transform", "translate(" + d3.event.translate + ")scale(" + mapScale + ")");
	}

	// If the drag behavior prevents the default click,
	// also stop propagation so we don’t click-to-zoom.
	function stopped() {
		if (d3.event.defaultPrevented)
			d3.event.stopPropagation();
	}

	/**
	 * Places nodes on the outer rim of circle, using d3 force directed graph
	 * to lay out the nodes.
	 * @param {Object} nodes
	 * @param {Object} circle
	 */
	function addNecklaceMap(outerCircle, stateNodes, callback) {
		var w = 0, // width of force graph.
		    h = 0, // height of force graph. 
		    nodeRadius = stateNodes[0].r, // radius of nodes.

		// center of circle the points must stay outside of.
			cx = outerCircle.cx, // center x of circle nodes stay out of
		    cy = outerCircle.cy, // center y of circle nodes stay out of
		    r = outerCircle.r + nodeRadius,
		    necklaceMapNodes = {}; // radius of the circle the necklace
		    // nodes are arranged around. Radius of the nodes is added to keep
		    // them from overlapping outer counties. 
				
		// delete the previous necklace map
		d3.select("#necklaceMapLayer").remove(); 
	
		// Initialize the force layout settings
		// 0 gravity has great results! Otherwize nodes arrange themselves lopsided. 
		var force = d3.layout.force().gravity(0.0).charge(-r * 0.28).size([w, h]).nodes(stateNodes);

		// Add an SVG group to hold the necklace map.
		var necklaceMap = d3.select("#mapFeaturesLayer").append("g").attr("id", "necklaceMapLayer");

		// Load the data.
		var node = necklaceMap.selectAll("circle")
					  .data(stateNodes)
					  .enter().append("circle")
					  .attr("r", function(d) {
					  	return nodeRadius;
					  })
					  .style("fill", "#D6F5FF")
					  .style("stroke", "black")
					  .style("stroke-width", function(d) {
					  	return (d.strokeWidth);
					  })
					  //.call(force.drag)
					  .on("mousedown", function() {
					  	d3.event.stopPropagation();
					  });
	
		function tick () {
			node.attr("cx", function(d) {
				var dx = d.x - cx;
				var dy = d.y - cy;
				var dist = Math.sqrt(dx * dx + dy * dy);
				d.x = dx * r / dist + cx;
				return d.x;
			});
			node.attr("cy", function(d) {
				var dx = d.x - cx;
				var dy = d.y - cy;
				var dist = Math.sqrt(dx * dx + dy * dy);
				d.y = dy * r / dist + cy;
				return d.y;
			});
		}

		// On each tick of the force layout,
		force.on("tick", tick);
		
		var i; // More nodes? More ticks
		
		// Start the force layout, run 
		force.start();
		for (i = stateNodes.length * 10; i > 0; i -= 1) {
			force.tick();
		}
		force.stop();
		
		// TODO return a convenient object for getting nodes by STUSPS keys.
		//return force.nodes(); // This is not that.
		
		// For each node, add it's STUSPS and itself to an object?
		for(i = 0; i < stateNodes.length; i += 1) {
			var STUSPS = stateNodes[i].STUSPS;
			necklaceMapNodes[STUSPS] = stateNodes[i];
		}
		callback(necklaceMapNodes);
	}

	function configureNecklaceMap(targetStateAbbreviation) {
		
		// Figure out which states need necklace map nodes.
		var flows = Flox.getFlows(),
			outerStates = [],
			flow,
			targetStatePolygon,
			stateBoundingBox,
			outerCircle,
			stateCircles,
			i, j, sPt, ePt,
			necklaceMapNodes;
		
		// get the statePolygon, yes?
		d3.select("#" + targetStateAbbreviation).each(function(d) {
			targetStatePolygon = d; // Yes!
		});
		
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			
			sPt = flow.getStartPt();
			ePt = flow.getEndPt();
			
			if(sPt.STUSPS !== targetStateAbbreviation && (outerStates.indexOf(sPt.STUSPS) < 0)) {
				//console.log("found an outer state");
				outerStates.push(sPt.STUSPS);
			}
			
			if(ePt.STUSPS !== targetStateAbbreviation && (outerStates.indexOf(ePt.STUSPS) < 0)) {
				//console.log("found an outer state");
				outerStates.push(ePt.STUSPS);
			}
		}

		// get the necklace for the target state.
		stateBoundingBox = path.bounds(targetStatePolygon);
		outerCircle = getCircleAroundBoundingBox(stateBoundingBox);
		// get necklace map locations for each outerState, go ahead and add
		// them to the map using existing function
		
		stateCircles = getStateCircles(outerCircle, outerStates);
		
		addNecklaceMap(outerCircle, stateCircles, function(necklaceMapNodes) {
			// Swap out the offending node in each flow with the necklace map node.
			for(i = 0, j = flows.length; i < j; i += 1) {
				flow = flows[i];
				sPt = flow.getStartPt();
				ePt = flow.getEndPt();
				
				// if the SPUSPS in sPt/ePt isn't the target, replace it with
				// the necklaceMapNode it should be. 
				if(sPt.STUSPS !== targetStateAbbreviation) {
					flow.setStartPt(necklaceMapNodes[sPt.STUSPS]);
				}
				if(ePt.STUSPS !== targetStateAbbreviation) {
					flow.setEndPt(necklaceMapNodes[ePt.STUSPS]);
				}
			}
			// Tell Flox it can layout flows now.
			// console.log("running timeout");
			// window.setTimeout(function(){
				// console.log("continuing!");
			//Flox.runLayoutWorker();
			// }, 1000);
			
		});
	}
	
	// PUBLIC ---------------------------------------------------------------------

	// start MapComponent_d3 only-----------------------------------------------

	// Circles are an array of point objects like this:
	// { x, y, r } where r is the radius.
	my.drawCircles = function(circlesArray) {
		drawCircles(circlesArray);
	};

	my.configureNecklaceMap = function (stateAbbreviation) {
		configureNecklaceMap(stateAbbreviation);
	};

	// end MapComponent_d3 only-------------------------------------------------

	my.drawFeatures = function(settings) {
		drawFeatures(settings);
	};

	my.initMap = function() {
		initMap();
	};

	my.drawIntermediateFlowPoints = function() {

	};

	my.showHideCtrlPts = function() {

	};

	my.update = function() {

	};

	my.clearAll = function() {
		// Just clear the flows, ok?
		d3.select("#flowsLayer").selectAll("g").remove();
	};

	my.resizeFlows = function() {

	};

	my.resizePoints = function() {

	};

	my.showHideRangeboxes = function() {

	};

	my.latLngToLayerPt = function(latLng) {
		// Return the pixel coordinates of a latLng object.
		var xy = projection([latLng.lng, latLng.lat]);

		if (xy === null) {
			//console.log("latLngToLayerPt resulted in null. LatLng is possibly outside projection boundary.");
			return false;
		}

		return {
			x : xy[0],
			y : xy[1]
		};

	};

	my.layerPtToLatLng = function(layerPt) {
		var ll = projection.invert([layerPt.x, layerPt.y]);

		return {
			lng : ll[0],
			lat : ll[1]
		};
	};

	my.getMapScale = function() {
		return mapScale;
	};

	my.setView = function(latLng, zoom) {

	};

	my.rotateProjection = function(lat, lng, roll) {
		projection.rotate([lat, lng, roll]);
	};

	return my;
};

