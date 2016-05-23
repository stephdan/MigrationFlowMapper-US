Flox.MapComponent_d3 = function() {
	"use strict";

	var svg,
		model_copy,
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
		svg = d3.select("#map").append("svg").attr("width", "100%").attr("height", "100%").on("click", stopped, true);


		// MAP LAYERS ------------------------------------
		// Add a background layer for detecting pointer events
		background = svg.append("rect").attr("class", "background").attr("width", "100%").attr("height", "100%").on("click", reset);
		var mapFeaturesLayer = svg.append("g").attr("id", "mapFeaturesLayer"),
			statesLayer = mapFeaturesLayer.append("g").attr("id", "statesLayer"),
			countiesLayer = mapFeaturesLayer.append("g").attr("id", "countieslayer"),
			countyTooltip,
			stateTooltip;
		
		mapFeaturesLayer.append("g").attr("id", "flowsLayer");
		mapFeaturesLayer.append("g").attr("id", "pointsLayer");
		
		$(window).resize(function() {
			width = this.innerWidth;
			height = this.innerHeight;
			svg.attr("width", "100%").attr("height", "100%");
			background.attr("width", "100%").attr("height", "100%");
		});

		// Create and arrange layers in the appropriate order.


		svg.call(zoom)// delete this line to disable free zooming
		.call(zoom.event);

		// Custom tool tips
		countyTooltip = d3.select("body").append("div")
						  .attr("class", "tooltip-county")
						  .style("display", "none");

		stateTooltip = d3.select("body").append("div")
						  .attr("class", "tooltip-state")
						  .style("display", "none");

		d3.json("data/geometry/states_census_2015.json", function(error, us) {
			if (error) {
				throw error;
			}
			statesLayer.selectAll("path").data(topojson.feature(us, us.objects.states)
				.features).enter().append("path")
				.attr("d", path)
				.attr("id", function(d) {
					return "FIPS" + d.properties.STATEFP;
				})
				.attr("class", "feature state")
				.attr("stroke", "white")
				.attr("fill", "#ccc")
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
					.attr("class", function(d) {
						return "feature county hidden FIPS" + d.properties.STATEFP;
					})
					.attr("fill", "#ccc")
					.on("mouseover", function(d) {
						countyTooltip.style("display", "inline");
						d3.select(this).attr("fill", "yellow");
					})
					.on("mousemove", function(d) {
						var node, outgoingFlow, incomingFlow, model_master;
						model_master = Flox.getModel();
						node = model_master.findNodeByID(d.properties.STATEFP + d.properties.COUNTYFP);
						outgoingFlow = node.totalOutgoingFlow;
						incomingFlow = node.totalIncomingFlow;
						countyTooltip.html("Name: " + d.properties.NAME + "<br/>" + 
										   "Total Outflow: " + outgoingFlow + "<br/>" +
										   "Total Inflow: " + incomingFlow)
								.style("left", (d3.event.pageX + 4) + "px")
								.style("top", (d3.event.pageY - 34) + "px");
						
					})
					.on("mouseout", function() {
						countyTooltip.style("display", "none");
						d3.select(this).attr("fill", "#ccc");
					})
					.on("click", function(d) {
						console.log("county clicked!");
						countyClicked(d);
					});
			});
		});
		// end d3.json
	}// End initMap();



	function removeAllFlows() {
		d3.select("#flowsLayer").selectAll("g").remove();
		d3.select("#pointsLayer").selectAll("circle").remove();
	}

	function removeAllCircles() {
		// Select and remove the circles layer?
		var circlesLayer = d3.select("#circlesLayer").remove();
	}


	function getNodeRadius(node) {
		return model_copy.getNodeRadius(node);
	}

	function endClipRadius(endNode) {
		// distance between end of flow and end point
		var gapDistanceToEndNode = model_copy.getFlowDistanceFromEndPointPixel(),
		    endNodeRadius = model_copy.getNodeStrokeWidth() / 2 + getNodeRadius(endNode);
		return gapDistanceToEndNode + endNodeRadius;
	}
	
	function startClipRadius(startNode) {
		// distance between end of flow and end point
		var gapDistanceToStartNode = model_copy.getFlowDistanceFromStartPointPixel(),
		    startNodeRadius = model_copy.getNodeStrokeWidth() / 2 + getNodeRadius(startNode);
		return gapDistanceToStartNode + startNodeRadius;
	}



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
			rs = model_copy.getFlowDistanceFromStartPointPixel() > 0 ? startClipRadius(f.getStartPt()) : 0;
			flow = flow.getClippedFlow(rs, 1);
			// clip the start bit off the arrowed flow
		} else {
			rs = model_copy.getFlowDistanceFromStartPointPixel() > 0 ? startClipRadius(f.getStartPt()) : 0;
			re = model_copy.getFlowDistanceFromEndPointPixel() > 0 ? endClipRadius(f.getEndPt()) : 0;
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
		if (flow.isLocked() && model_copy.isShowLockedFlows()) {
			return lockedColor;
		}
		return defaultColor;
	}

	/**
	 * Configures the arrows so they will be scaled according to a model with
	 * more flows in it than the maxFlows model passed into drawFeatures. This
	 * allows arrows to be drawn the correct size when viewing individual
	 * county flows. 
	 */
	function configureArrowsWithActiveModel(activeModel) {
		
		var flows, flow, arrowSettings, i, j;
		
		// get the flows from the model_copy
		flows = model_copy.getFlows();
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			arrowSettings = activeModel.getArrowSettings(flow);
			
			flow.configureArrow(arrowSettings);
		}
		
	}


	function drawFlows(drawArrows) {

		var activeModel = Flox.getActiveFullModel(),
			flows = model_copy.getFlows(),
		    i,
		    j,
		    f,
		    rs,
		    re,
		    svgFlows,
		    tooltip;
	
		if(drawArrows) {
			configureArrowsWithActiveModel(activeModel);
		}
	
		tooltip = d3.select("body").append("div")
					.attr("class", "tooltip-flow")
					.style("display", "none");

		flows.sort(function(a, b){ return b.getValue() - a.getValue(); });

		// called svgFlows because flows is already taken!
		svgFlows = d3.select("#flowsLayer").append("g").attr("id", "svgFlows")
			.selectAll("g")// a group for each flow
			.data(flows)// flow data added to GROUP
			.enter().append("g");
	
		// Draw outlines first
		// if (drawArrows) {
			// svgFlows.append("path")// add a new path. This is the arrowhead!
				// .classed("arrowOutline", true)
				// .style("cursor", "default")
				// .attr("stroke", "#ccc")
				// .attr("fill", "#ccc")
				// .attr("stroke-width", 2)
				// .attr("d", function(d) {
					// return buildSvgArrowPath(d);
				// });
		// }
		// svgFlows.append("path")
			// .classed("curveOutline", true)
			// .attr("stroke", "#ccc")
			// .style("cursor", "default")
			// .attr("fill", "none")
			// .attr("stroke-width", function(d) {
				// return activeModel.getFlowStrokeWidth(d) + 2;
			// })
			// .attr("d", function(d) {
				// return buildSvgFlowPath(d, drawArrows);
			// });
			
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
				});
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
				
				return activeModel.getFlowStrokeWidth(d);
			})
			.attr("d", function(d) {
				return buildSvgFlowPath(d, drawArrows);
			});
		
         
        svgFlows.on("mouseover", function(d) {
			tooltip.style("display", "inline");
			d3.select(this).select(".curve").attr("stroke", "yellow");
			d3.select(this).select(".arrow").attr("fill", "yellow");
        })
        .on("mousemove", function(d) {
			if(d.AtoB) {
				// It's a total flow.
				tooltip.html("Total Flow: " + d.getValue() + "<br/>" + 
			             d.getStartPt().name + " to " + d.getEndPt().name + ": " + d.AtoB + "<br/>" + 
			             d.getEndPt().name + " to " + d.getStartPt().name + ": " + d.BtoA)
			       .style("left", (d3.event.pageX + 4) + "px")
			       .style("top", (d3.event.pageY - 34) + "px");
			} else {
				tooltip.html("Net Flow: " + d.getValue() + "<br/>" + 
			             "From: " + d.getStartPt().name + "<br/>" + 
			             "To: " + d.getEndPt().name )
			       .style("left", (d3.event.pageX + 4) + "px")
			       .style("top", (d3.event.pageY - 34) + "px");
			}
			
        })
        .on("mouseout", function() {
			tooltip.style("display", "none");
			d3.select(this).select(".curve").attr("stroke", "black");
			d3.select(this).select(".arrow").attr("fill", "black");
        });
	}

	function drawPoints() {
		var points = model_copy.getPoints(),
		    circles = d3.select("#pointsLayer").selectAll("circle").data(points).enter().append("circle");

		// Add some attributes to the points
		circles.style("stroke", "black").style("stroke-width", function(d) {
			return model_copy.getNodeStrokeWidth();
		})
		.attr("class", function(d) {
			return "node FIPS" + d.id; // FIXME id is really FIPS
		})
		.style("fill", "white").style("stroke", function(d) {// adjust the color
			if (d.selected) {
				return "#59A4FF";
			}
			return "black";
		})
		.style("cursor", "default").attr("r", function(d) {
			return model_copy.getNodeRadius(d);
		})
		.attr("cx", function(d) {
			return d.x;
		})
		.attr("cy", function(d) {
			return d.y;
		});
	}

	/**
	 * @param m : A copy of the model.
	 */
	function drawFeatures(m) {
	
		removeAllFlows();
	
		if(!m) {
			throw new Error("drawFeatures needs to be passed a copy of the model");
		}

		// Store m in model_copy
		model_copy = m;

		var drawArrows = model_copy.isDrawArrows();

		if (model_copy.isDrawFlows()) {
			drawFlows(drawArrows);
		}

		if (model_copy.isDrawNodes()) {
			drawPoints();
		}
	}

	function showCountyBordersWithinState(stateFIPS) {
		d3.selectAll(".FIPS" + stateFIPS).classed("hidden", false);
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
	 * Change the coordinates of pt so that it lies on 
	 * the intersection between the circle and a line drawn between pt and 
	 * the circle center.
	 */
	function projectPointOnCircle(pt, circle) {
		var d,
		    dx,
		    dy,
		    x,
		    y;

		// Get the distance between the points
		dx = pt.x - circle.cx;
		dy = pt.y - circle.cy;
		d = Math.sqrt(dx * dx + dy * dy);

		// Pt is the center of circle. Return Pt.
		// TODO could return some point on the outside of circle
		if (d === 0) {
			return pt;
		}

		// Point is inside the circle. Return Pt. 
		if (d <= circle.r) {
			//console.log("pt is inside the circle");
			return pt;
		}

		pt.x = circle.cx + (dx * circle.r / d);
		pt.y = circle.cy + (dy * circle.r / d);

		return pt; 
	}

	/**
	 * Places circles on outerCircle that correspond to the states array.
	 *
	 * @param {Object} outerCircle - Circle around central state polygon
	 * @param {Array} states - Array of state abbreviations to make circles for.
	 */
	function getStateCircles(outerCircle, states, outerStatesNodes) {

		var stateCircles = [],
		    i,
		    j,
		    pt;

		for ( i = 0, j = outerStatesNodes.length; i < j; i += 1) {
			pt = outerStatesNodes[i];
			projectPointOnCircle(pt, outerCircle);
			pt.necklaceMapNode = true;
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
		.duration(750) // TODO long zoom for testing asynchronous stuff.
		.call(zoom.translate(translate).scale(scale).event);
	}

	/**
	 * Does all the things needed when a state is selected. Makes a necklace
	 * map, zooms in, lays out the flows, displays the flows, everything.
	 * @param {object} Object containing the geometry and properties of the 
	 * selected state. 
	 */
	function selectState(stateFIPS) {
		
		var statePolygon, 
			stateBoundingBox,
			outerCircle,
		    testStates,
		    stateCircles;
		
		// Clear out all flows and necklace maps.
		removeAllFlows();
		d3.select("#necklaceMapLayer").remove(); 
		
		// get the statePolygon, yes?
		d3.select("#" + "FIPS" + stateFIPS).each(function(d) {
			statePolygon = d; // Yes!
		});
		
		// Tell the importer which flows need loadin'
		Flox.importTotalCountyFlowData(statePolygon.properties.STATEFP);
		
		zoomToPolygon(statePolygon); // Zoom in! FIXME Usually gets stuck 
		// due to UI freeze.
		
		// Hide county boundaries
		hideAllCountyBorders();

		// Show just the county boundaries for the selected state
		showCountyBordersWithinState(statePolygon.properties.STATEFP);
	}

	function selectCounty(countyFIPS) {
		removeAllFlows();
		d3.select("#necklaceMapLayer").remove();
		
		// This is kinda sucky
		// Flox.showSelectedCountyFlows(countyFIPS);
		
		// Instead, change a filter settings and tell Flox to filter flows.
		Flox.setFilterSettings({county: countyFIPS});
		Flox.filterBySettings();
		
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
		selectState(d.properties.STATEFP);
	}

	function countyClicked(d) {
		
		var FIPS = d.properties.STATEFP + d.properties.COUNTYFP;
		
		// If the county was already selected, deselect it. 
		
		// Change style stuff here?
		
		// Select this county
		
		selectCounty(FIPS);
		
	}

	
	// Zooms out to full extent, deselects everything, hides all county
	// boundaries, resets some filter settings.
	function reset() {
		active.classed("active", false);
		active = d3.select(null);

		d3.selectAll(".county").classed("hidden", true);
		removeAllCircles();
		removeAllFlows();
		
		// Also remove all necklace maps.
		d3.select("#necklaceMapLayer").remove(); 
		
		Flox.setFilterSettings({county: false, state: false});
		
		svg.transition().duration(750).call(zoom.translate([width / 2, height / 2]).scale(0.06).event);
	}

	function zoomed() {
		var g = svg.select("#mapFeaturesLayer");

		mapScale = d3.event.scale;

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
		    r = outerCircle.r + nodeRadius, // radius of the circle the necklace
		    // nodes are arranged around. Radius of the nodes is added to keep
		    // them from overlapping outer counties. 
			force, necklaceMap, nodes, i,
			necklaceNodeTooltip;	
			
		// delete the previous necklace map
		d3.select("#necklaceMapLayer").remove(); 
	
		// Initialize the force layout settings
		// 0 gravity has great results! Otherwize nodes arrange themselves lopsided. 
		force = d3.layout.force().gravity(0.0).charge(-r * 0.28).size([w, h]).nodes(stateNodes);

		// Add an SVG group to hold the necklace map.
		necklaceMap = d3.select("#mapFeaturesLayer").append("g").attr("id", "necklaceMapLayer");

		// Load the data.
		nodes = necklaceMap.selectAll("circle")
					  .data(stateNodes)
					  .enter().append("circle")
					  .attr("r", function(d) {
					  	return d.r;
					  })
					  .style("fill", "#D6F5FF")
					  .style("stroke", "black")
					  .style("stroke-width", function(d) {
					  	return (d.strokeWidth);
					  })
					  //.call(force.drag)
					  .on("mousedown", function() {
					  	//d3.event.stopPropagation();
					  });

		necklaceNodeTooltip = d3.select("body").append("div")
								.attr("class", "tooltip-necklaceMapNode")
								.style("display", "none");

		// Add some mouse interactions to the nodes, like tooltips.
		nodes.on("mouseover", function(d) {
			necklaceNodeTooltip.style("display", "inline");
			//d3.select(this).select(".curve").attr("stroke", "yellow");
			//d3.select(this).select(".arrow").attr("fill", "yellow");
        })
        .on("mousemove", function(d) {
			necklaceNodeTooltip.html(d.name + "<br/>" + 
			             "Outgoing Flow: " + d.totalOutgoingFlow + "<br/>" + 
			             "Incoming Flow: " + d.totalIncomingFlow )
			       .style("left", (d3.event.pageX + 4) + "px")
			       .style("top", (d3.event.pageY - 34) + "px");
        })
        .on("mouseout", function() {
			necklaceNodeTooltip.style("display", "none");
			//d3.select(this).select(".curve").attr("stroke", "black");
			//d3.select(this).select(".arrow").attr("fill", "black");
        })
        .on("click", function(d) {
        	necklaceNodeTooltip.style("display", "none");
			selectState(d.STATEFP);
        });
		


		function tick () {
			var dx, dy, dist;
			nodes.attr("cx", function(d) {
				dx = d.x - cx;
				dy = d.y - cy;
				dist = Math.sqrt(dx * dx + dy * dy);
				d.x = dx * r / dist + cx;
				return d.x;
			});
			nodes.attr("cy", function(d) {
				dx = d.x - cx;
				dy = d.y - cy;
				dist = Math.sqrt(dx * dx + dy * dy);
				d.y = dy * r / dist + cy;
				return d.y;
			});
		}

		// On each tick of the force layout,
		force.on("tick", tick);
				
		// Start the force layout.
		// Number of ticks increases with number of nodes.
		// FIXME this is not optimal. Sometimes it's not enough ticks,
		// sometimes too many. 
		force.start();
		for (i = stateNodes.length * 10; i > 0; i -= 1) {
			force.tick();
		}
		force.stop();
		
		// For each node, add it's STUSPS and itself to an object?
		// This is not needed now.
		// for(i = 0; i < stateNodes.length; i += 1) {
			// var FIPS = stateNodes[i].FIPS;
			// necklaceMapNodes[FIPS] = stateNodes[i];
		// }
		//callback(necklaceMapNodes);
		callback();
	}

	/**
	 * Gets the smallest circle that encloses targetStatepolygon. 
	 * Uses code copied from https://www.nayuki.io/page/smallest-enclosing-circle
	 * targetStatePolygon is a d3.feature. Points from that feature are
	 * converted from [x,y] tp {x: value, y: value} to be compatible
	 * with the copied code, which kinda sucks.
	 */
	function getSmallestCircleAroundPolygon(targetStatePolygon) {
		// Get the points from the polygon somehow?
		var points = (targetStatePolygon.geometry.coordinates[0]),
			formattedPoints = [],
			i, j, pt, xy, circle, formattedCircle;
		
		// convert the points to be compatible with smallest circle algorithm
		// FIXME this is dumb
		for(i = 0, j = points.length; i < j; i += 1) {
			pt = points[i];
			
			// convert latLng to pixel coords.
			xy = projection(pt);
			// turn the array of xy into an object of xy.
			// Push the new object into formattedPoints
			formattedPoints.push({x: xy[0], y: xy[1]});
		}
		
		circle = Flox.GeomUtils.makeCircle(formattedPoints);
		
		formattedCircle = {
			cx: circle.x,
			cy: circle.y,
			r: circle.r + 30
		};
		return formattedCircle;
		
	}

	/**
	 * Create a necklace map for the selected state. Flows entering or leaving
	 * the selected state will have outer-state nodes replaced with necklace
	 * map nodes. Only makes necklace map nodes for states that have displayed
	 * flows (maxFlows only).
	 * Uses d3 force layout to arrange nodes. 
 * @param {Number} stateFIPS - US state FIPS code
 * @param {Object} model - FloxModel containing flows
 * @param {Function} callback - Called when finished.
	 */
	function configureNecklaceMap(model, callback) {
		
		var flows = model.getFlows(),
			outerStates = [],
			outerStatesNodes = [],
			flow,
			targetStatePolygon,
			stateBoundingBox,
			outerCircle,
			stateCircles,
			i, j, sPt, ePt,
			necklaceMapNodes,
			smallerOuterCircle,
			datasetName = model.getDatasetName(); // FIPS code of selected state
			// in the format "FIPS00"
		
		// Remove the existing necklace map.
		d3.select("#necklaceMapLayer").remove();
		
		// Get the polygon of the currently selected state, which contains 
		// various needed parameters. 	
		d3.select("#" + datasetName).each(function(d) {
			targetStatePolygon = d;
		});
		
		// Loop through the flows in the model
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			
			// Start point and end point
			sPt = flow.getStartPt();
			ePt = flow.getEndPt();
			
			// If the state FIPS codes of the start or end point don't match
			// the FIPS code of the selected state, add that FIPS code to an 
			// array that tracks which states have out of state flows.
			if("FIPS" + sPt.STATEFP !== datasetName 
			   && (outerStates.indexOf(sPt.STATEFP) < 0)) {
				outerStates.push(sPt.STATEFP);
				outerStatesNodes.push(sPt);
			}
			if("FIPS" + ePt.STATEFP !== datasetName 
			   && (outerStates.indexOf(ePt.STATEFP) < 0)) {
				outerStates.push(ePt.STATEFP);
				outerStatesNodes.push(ePt);
			}
		}

		// Get the bounding box for the selected state polygon.
		// Then, get a circle that encloses the bounding box of the state.
		//stateBoundingBox = path.bounds(targetStatePolygon);
		//outerCircle = getCircleAroundBoundingBox(stateBoundingBox);
		
		// Get the smallest circle that encloses the targetStatePolygon
		smallerOuterCircle = getSmallestCircleAroundPolygon(targetStatePolygon);
		
		// Get a circle for each outerState.
		// Actually moves the offending flow nodes and adds attributes r, 
		// necklaceMapNode = true, and strokeWidth. I think that's it.
		stateCircles = getStateCircles(smallerOuterCircle, outerStates, outerStatesNodes);
		
		// If there are any stateCircles...
		if(stateCircles.length > 0) { 
			// Create and add the necklace map to the map. 
			addNecklaceMap(smallerOuterCircle, stateCircles, function(necklaceMapNodes) {				
				callback();
			});
		} else {
			console.log("No out of state nodes?");
			callback();
		}
	}
	
	
	
	// PUBLIC ---------------------------------------------------------------------

	// start MapComponent_d3 only-----------------------------------------------

	// Circles are an array of point objects like this:
	// { x, y, r } where r is the radius.
	my.drawCircles = function(circlesArray) {
		drawCircles(circlesArray);
	};

	my.configureNecklaceMap = function (stateFIPS, model_copy, callback) {
		configureNecklaceMap(stateFIPS, model_copy, callback);
	};

	// end MapComponent_d3 only-------------------------------------------------

	my.drawFeatures = function(m) {
		drawFeatures(m);
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

	my.removeAllFlows = function() {
		removeAllFlows();
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

