Flox.MapComponent_d3 = function() {
	"use strict";

	var svg,
	    selectedColor = "#59A4FF",
	    defaultColor = "black",
	    active = d3.select(null),
	    path,
	    width = $(window).width(),
	    height = $(window).height(),
	    background,
	    mapScale = 1,
	    projection_albersUsa = d3.geo.albersUsa().scale(20000).translate([width / 2, height / 2]),
	    projection_mercator = d3.geo.mercator().translate([width / 2, height / 2]),
	    projection = projection_albersUsa,
	    zoom = d3.behavior.zoom().translate([width / 2, height / 2]).scale(0.06).scaleExtent([0.05, 80])// change these numbers to be able to zoom in or out further.
	.on("zoom", zoomed),

	    i,
	    j,
	    my = {};

	// Create a map! Add a baselayer, initialize all the panning and zooming
	// and whatnot, add it all to the map div.
	function initMap() {

		path = d3.geo.path().projection(projection);

		svg = d3.select("#map").append("svg").attr("width", width).attr("height", height).on("click", stopped, true);

		// Add a background layer for detecting pointer events
		background = svg.append("rect").attr("class", "background").attr("width", width).attr("height", height).on("click", reset);

		$(window).resize(function() {
			width = this.innerWidth;
			height = this.innerHeight;
			svg.attr("width", width).attr("height", height);
			background.attr("width", width).attr("height", height);
		});

		var mapFeaturesLayer = svg.append("g").attr("id", "mapFeaturesLayer");

		svg.call(zoom)// delete this line to disable free zooming
		.call(zoom.event);

		d3.json("data/geometry/states_census_2015.json", function(error, us) {
			if (error) {
				throw error;
			}
			//console.log(us);
			mapFeaturesLayer.append("g").attr("id", "statesLayer").selectAll("path").data(topojson.feature(us, us.objects.states).features).enter().append("path").attr("d", path).attr("class", "feature state").attr("stroke", "white").on("click", stateClicked);
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
				//console.log(us);
				mapFeaturesLayer.append("g").attr("id", "countieslayer").selectAll("path").data(topojson.feature(us, us.objects.counties).features).enter().append("path").attr("d", path)
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
	// the LatLng coordinates to screen coordinates.
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
		// The place where this thing is clipped will depend on whether or
		// not arrows are drawn.
		if (drawArrows && f.getArrow()) {
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
		    arrows;

		svgFlows = d3.select("#mapFeaturesLayer").append("g")// a group to hold all the flows
		.attr("id", "flowsLayer").selectAll("g")// a group for each flow
		.data(flows)// flow data added to GROUP
		.enter().append("g");
		// add the g to the flowsLayer

		svgFlows.append("path")// Add a new path. This is the flow curve!
		.classed("curve", true).attr("stroke", function(d) {
			return getFlowColor(d);
		}).style("cursor", "default").attr("fill", "none").attr("stroke-width", function(d) {
			return Flox.getFlowStrokeWidth(d);
		}).attr("d", function(d) {
			return buildSvgFlowPath(d, drawArrows);
		});

		if (drawArrows) {
			svgFlows.append("path")// add a new path. This is the arrowhead!
			.classed("arrow", true).style("cursor", "default").attr("stroke", function(d) {
				return "blue";
				//getFlowColor(d);
			}).attr("fill", function(d) {
				return getFlowColor(d);
				//return "none";
			}).attr("stroke-width", 0).attr("d", function(d) {
				return buildSvgArrowPath(d);
			});
		}
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
			console.log("pt is the center of the circle");
			return {
				x : circle.cx,
				y : circle.cy
			};
		}

		if (d <= circle.r) {
			console.log("pt is inside the circle");
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

	function getPointOnCircleFromAngle(angle, circle) {

	}

	/**
	 * Places circles on outerCircle that correspond to the states array.
	 *
	 * @param {cx, cy, r} outerCircle Circle around central state.
	 * @param {[states]} states Array of state abbreviations to make cicles for.
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
		d3.selectAll("#statesLayer").selectAll(".state").each(function(d) {
			if (states.indexOf(d.properties.STUSPS) > -1) {// Is this state in states?
				//console.log(d);
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

			stateCircles.push({
				x : pt.x,
				y : pt.y,
				r : 150
			});
		}

		return stateCircles;
	}

	// Zooms in to the state, makes county boundaries in the state visible.
	function stateClicked(d) {
		if (active.node() === this) {
			return reset();
		}

		// Remove active class from currently active state, add active class
		// to the state that was clicked.
		active.classed("active", false);
		active = d3.select(this).classed("active", true);

		// Hide county boundaries
		hideAllCountyBorders();
		removeAllCircles();

		// Show just the county boundaries for the clicked state
		showCountyBordersWithinState(d.properties.STATEFP);

		var bounds = path.bounds(d),
		    outerCircle = getCircleAroundBoundingBox(bounds),
		    dx = bounds[1][0] - bounds[0][0],
		    dy = bounds[1][1] - bounds[0][1],
		    x = (bounds[0][0] + bounds[1][0]) / 2,
		    y = (bounds[0][1] + bounds[1][1]) / 2,
		    scale = 0.6 / Math.max(dx / width, dy / height),
		    translate = [width / 2 - scale * x, height / 2 - scale * y],
		    testStates,
		    allCircles = [],
		    stateCircles;

		//console.log(bounds);
		console.log("State: " + d.properties.STUSPS + ", FIPS: " + d.properties.STATEFP);
		//cornerCircles = getCirclesAtBoundingBoxCorners(bounds);

		//drawCircles(cornerCircles);

		testStates = ["WA", "FL", "ME", "TX", "CA", "WV", "CO"];
		stateCircles = getStateCircles(outerCircle, testStates);
		//console.log(stateCircles);
		//drawCircles([outerCircle]);
		drawCircles(stateCircles);
			
		addNecklaceMap(outerCircle, stateCircles);
		console.log(path.centroid(d));
		svg.transition()
		.duration(1000)
		.call(zoom.translate(translate).scale(scale).event);
	}

	// Zooms out to full extent, deselects everything, hides all county
	// boundaries.
	function reset() {
		active.classed("active", false);
		active = d3.select(null);

		d3.selectAll(".county").classed("hidden", true);
		removeAllCircles();

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
	function addNecklaceMap(outerCircle, stateNodes) {
		var w = 0, // width of force graph.
		    h = 0, // height of force graph. 
		    radius = 100; // radius of nodes.

		// center of circle the points must stay outside of.
		var cx = outerCircle.cx, // center x of circle nodes stay out of
		    cy = outerCircle.cy, // center y of circle nodes stay out of
		    r = outerCircle.r + stateNodes[0].r; // radius of the circle nodes stay out of

		// delete the previous necklace map
		d3.select("#necklaceMapLayer").remove(); 
	
		// Initialize the force layout settings
		var force = d3.layout.force().gravity(0.0).charge(-500).size([w, h]);

		// Add an SVG group to hold the necklace map.
		var necklaceMap = d3.select("#mapFeaturesLayer").append("g").attr("id", "necklaceMapLayer");//.attr("width", w).attr("height", h);

		// Move the necklace map layer to the location of cx and cy
		// This sets the center of gravity to the center of the circle, so the
		// points don't arrange all lop-sided.
		//necklaceMap.attr("transform", "translate( " + cx + ", " + cy + ")");

		// Load the data.
		d3.json("data/graph.json", function(error, graph) {
			if (error) {throw error;}
				
			var node = necklaceMap.selectAll("circle")
						  .data(stateNodes)
						  .enter().append("circle")
						  .attr("r", function(d) {
						  	return d.r;
						  })
						  .style("fill", "#D6F5FF")
						  .style("stroke", "black")
						  .style("stroke-width", 20)
						  .call(force.drag)
						  .on("mousedown", function() {
						  	d3.event.stopPropagation();
						  });

			force.nodes(stateNodes).links(graph.links).on("tick", function(e) {
				
				// Grab the current alpha, which is sortof a weight factor that 
				//determines how far the nodes move during this tick. 
				// I don't know how 0.1 is determined. Might be one of the
				// force layout settings? Friction maybe?
				// k is needed to move the center of gravity. 
				var k = 0.1 * e.alpha;

				// relocate the node to a location on the outer rim of the 
				// circle.
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
				
				// This effectively moves the center of gravity of the layout
				// to the center of the circle. Prevents lop-sided arrangement
				// of nodes around the circle. 
				graph.nodes.forEach(function(o, i) {
				    o.y += ((cy * 2) - o.y) * k;
				    o.x += ((cx * 2) - o.x) * k;
				});
			}).start();
		});
	}

	
	
	// PUBLIC ---------------------------------------------------------------------

	// start MapComponent_d3 only-----------------------------------------------

	my.goToState = function(stateString) {
		goToState(stateString);
	};

	// Circles are an array of point objects like this:
	// { x, y, r } where r is the radius.
	my.drawCircles = function(circlesArray) {
		drawCircles(circlesArray);
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
		d3.select("#flowsLayer").remove();
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
			console.log("latLngToLayerPt resulted in null. LatLng is possibly outside projection boundary.");
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

