Flox.MapComponent_d3 = function() {
	"use strict";

	var svg,
		model_copy,
	    selectedColor = "#59A4FF",
	    defaultColor = "black",
	    lockedColor = "gray",
	    path,
	    width = $(window).width(),
	    height = $(window).height(),
	    selectedStateFIPS,
	    selectedCountyFIPS,
	    populationDensityColor,
	   
	    mapScale = 1,
	    
	    background,
	    
	    projection_albersUsa = d3.geo.albersUsa().scale(20000).translate([width / 2, height / 2]),
	    projection_mercator = d3.geo.mercator().scale(20000).translate([width / 2, height / 2]),
	    projectoin_albersUsaPR = albersUsaPr().scale(20000).translate([width / 2, height / 2]),
	    //projection_conicEqualArea = d3.geo.conicEqualArea().scale(1).translate([width / 2, height / 2]),
	    projection = projectoin_albersUsaPR,
	    
	    // TODO the scale setting below could be set to zoom in to the bounding
	    // box of the lower 48 based on the window size. 
	    zoom = d3.behavior.zoom()
				.translate([width / 2, height / 2])
				.scale(0.06).scaleExtent([0.05, 80])// change these numbers to be able to zoom in or out further.
				.on("zoom", zoomed),

		tooltipOffset = {x: 8, y: -38}, // FIXME y is not used
		tooltip = d3.select("body").append("div")
					.attr("class", "floxTooltip")
					.style("display", "none"),
		
		defaultClasses = 7,
		
		stateStrokeWidth = 20,
		stateHoverStrokeWidth = 40,
		countyStrokeWidth = 8,
		countyHoverStrokeWidth = 16,
		
		colors = {
			backgroundFill: [235,235,242],

			minPopDensityFill: [189,229,187],
			maxPopDensityFill: [81,154,188],

			minFlowStroke: [174,117,120, 1],
			maxFlowStroke: [174,49,46, 1],

			necklaceNodeFill: [96,191,191],
			necklaceNodeStroke: [44,99,99],

			polygonStroke: [59,137,145],

			flowHoverStroke: [255,255,0],
			necklaceNodeHoverFill: [255,255,0],
			polygonHoverStroke: [49,127,135],
			
			unselectedStateFill : [230, 230, 230],
			unselectedStateStroke: [215, 215, 215],
			unselectedStateHoverStroke: [190, 190, 190],
			
		},
		
		lookupLSAD = {
			"03": "City and Borough",
			"04": "Borough",
			"05": "Census Area",
			"06": "County",
			"07": "District",
			"12": "Municipality",
			"13": "Municipio",
			"15": "Parish",
			"25": "City"
		},
		
		
	    my = {};



	// takes an array like [r,g,b] and makes it "rgb(r,g,b)" for use with d3
	function rgbArrayToString(rgb){
		
		if(rgb[3]) {
			return "rgba(" +  rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + rgb[3] + ")";
		}
		
		return "rgb(" +  rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
	}

	function numberWithCommas(x) {
	    var parts = x.toString().split(".");
	    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	    return parts.join(".");
	}

	function buildFlowTooltipText(d) {
		var moverText = "<span class='tooltipValue'>" + numberWithCommas(d.getValue()) + "</span>",
			typeText,
			toFromText,
			flowType,
			filterSettings = Flox.getFilterSettings();
		
		if(filterSettings.netFlows === false) {
			// it's a total flow
			typeText = " <div class='tooltipTypeHolder'>TOTAL<br/>MOVERS</div><br/>";
			// But sometimes it's directional and needs to be treated differently.
			if((filterSettings.countyIncoming === false || filterSettings.countyOutgoing === false) &&
				((filterSettings.stateMode && filterSettings.selectedState !== false) ||
			(filterSettings.countyMode && filterSettings.selectedCounty !== false))) {
				// do things differently, more like a net flow
				toFromText = "<div class='tooltipToFromText'><span style='font-size: 8px;'>from </span>" + d.getStartPt().name + "<br/>" + 
				             "<span style='font-size: 8px;'>to </span>" + d.getEndPt().name + "</div>";
			} else {
				toFromText = "<div class='tooltipToFromText'>" + d.getStartPt().name + "<span style='font-size: 8px;'>  to  </span>" + d.getEndPt().name + ": " + numberWithCommas(d.AtoB) + "<br/>" + 
				             d.getEndPt().name + "<span style='font-size: 8px;'>  to  </span>" + d.getStartPt().name + ": " + numberWithCommas(d.BtoA) + "</div>";
			}
		} else {
			// it's a net flow
			typeText = " <div class='tooltipTypeHolder'>NET<br/>MOVERS</div><br/>";
			toFromText = "<div class='tooltipToFromText'><span style='font-size: 8px;'>from </span>" + d.getStartPt().name + "<br/>" + 
				             "<span style='font-size: 8px;'>to </span>" + d.getEndPt().name + "</div>";
		}
		return moverText + typeText + toFromText;
	}
	
	function buildAreaTooltipText(d, model) {
		var node, outgoingFlow, incomingFlow, areaName, inValue, outValue, inOutText;
		
		if(d.properties.COUNTYFP){
			// it's a county
			node = model.findNodeByID(Number(d.properties.STATEFP) + d.properties.COUNTYFP);
		} else {
			// it's a state
			node = model.findNodeByID(String(Number(d.properties.STATEFP)));
		}
		outgoingFlow = node.totalOutgoingFlow;
		incomingFlow = node.totalIncomingFlow;
		
		areaName = "<div class='tooltipAreaName'>" + node.name + "</div>";
		inValue = "<span class='tooltipValue'>" + numberWithCommas(incomingFlow) + 
				  "</span> <div class='tooltipTypeHolder'>MOVED<br/>IN</div><br/>";
		outValue = "<span class='tooltipValue'>" + numberWithCommas(outgoingFlow) + 
			       "</span> <div class='tooltipTypeHolder'>MOVED<br/>OUT</div><br/>";
		
		inOutText = "<div class='tooltipInOutText'>" + inValue +
					outValue + "</div>";
		return areaName + inOutText;
	}

	function buildNecklaceNodeTooltipText(d, inState) {
		var nodeName = d.name,
			incomingFlow = d.totalIncomingFlow,
			outgoingFlow = d.totalOutgoingFlow,
			nameText,
			fromText,
			toText;
		
		nameText = d.name + "<br/>";
		fromText = "<span class='tooltipValue'>" + numberWithCommas(incomingFlow) + "</span> " + 
					"<div class='tooltipTypeHolder'>MOVED<br/>IN FROM</div> " + inState + "<br/>";
		toText = "<span class='tooltipValue'>" + numberWithCommas(outgoingFlow) + " </span> " + 
				 "<div class='tooltipTypeHolder'>MOVED<br/>OUT TO</div> " + inState + "<br/>";
		return nameText + fromText + toText; 
	}

	// Moves the selected svg element to lay on top of other SVG elements under the 
	// same parent element. Needed for changing the color of polygon stroke
	// on hover to prevent stroke overlaps. 
	d3.selection.prototype.moveToFront = function() {
	  return this.each(function(){
	    this.parentNode.appendChild(this);
	  });
	};

	// Create a map! Add a baselayer, initialize all the panning and zooming
	// and whatnot, add it all to the map div.
	function initMap() {

		// Make a d3 path object, which will handle translating path objects
		// onto the projection. I think. 
		path = d3.geo.path().projection(projection);
		
		// Create the svg element to hold all the map features.
		svg = d3.select("#map").append("svg")
				.attr("width", "100%")
				.attr("height", "100%")
				.on("click", stopped, true)
				.on("mousemove", function() {
					var svgX = d3.event.x,
						svgY = d3.event.y,
						projectedX = 0,
						projectedY = 0,
						ll = projection.invert([svgX, svgY]),
						lat = projection.invert(ll[1]),
						lng = projection.invert(ll[0]);
						
					// get the appropriate spans, set the text to the things
					$("#xCoord").html(svgX);
					$("#yCoord").html(svgY);
					$("#latitude").html(lat);
					$("#longitude").html(lng);
					//console.log(d3.mouse(this));
				})

		// MAP LAYERS ------------------------------------
		// Add a background layer for detecting pointer events
		background = svg.append("rect").attr("class", "background")
						.attr("width", "100%")
						.attr("height", "100%")
						.attr("fill", rgbArrayToString(colors.backgroundFill))
						.on("click", reset);
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

		d3.json("data/geometry/states_census_2015.json", function(error, us) {
			if (error) {
				throw error;
			}
			var model_master = Flox.getModel();
			statesLayer.selectAll("path").data(topojson.feature(us, us.objects.states).features, function(d) { return d.properties.STATEFP})
				.enter().append("path")
				.attr("d", path)
				.attr("id", function(d) {
					return "FIPS" + Number(d.properties.STATEFP);
				})
				.attr("class", "feature state")
				.attr("stroke", function(d){
					return rgbArrayToString(colors.polygonStroke);
				})
				.style("stroke-width", stateStrokeWidth)
				.attr("fill", "#ccc")
				.on("click", stateClicked)
				.on("mouseover", function(d) {
					var settings = Flox.getFilterSettings();
					tooltip.style("display", "inline");
					d3.select(this)
					  .style("stroke", function(d) {
					  	// It is in county or state view mode?
					  	if (settings.countyMode && settings.selectedState !== false) {
					  		return rgbArrayToString(colors.unselectedStateHoverStroke);
					  	}
						return rgbArrayToString(colors.polygonHoverStroke);
					  })
					  .style("stroke-width", stateHoverStrokeWidth )
					  .classed("hovered", true)
					  .moveToFront();
				})
				.on("mousemove", function(d) {
					tooltip.html(function(){
						return buildAreaTooltipText(d, model_master);
					})
					.style("left", (d3.event.pageX + tooltipOffset.x) + "px")
					.style("top", function() {
						var tooltipHeight = d3.select(this).node().getBoundingClientRect().height;
						return (d3.event.pageY - tooltipHeight) + "px";
					});
				})
				.on("mouseout", function(d) {
					tooltip.style("display", "none");
					d3.select(this).style("fill", function(d) {
						var settings = Flox.getFilterSettings(),
							node;
						if (settings.stateMode || settings.selectedState === false) {
							node = model_master.findNodeByID(String(Number(d.properties.STATEFP)));
							return populationDensityColor(Number(node.populationDensity));
						} else if (settings.countyMode) {
							return rgbArrayToString(colors.unselectedStateFill);
						}
					})
					.style("stroke", function(d){
						var settings = Flox.getFilterSettings();
						if(settings.countyMode && settings.selectedState !== false) {
							return rgbArrayToString(colors.unselectedStateStroke);
						}
						return rgbArrayToString(colors.polygonStroke);
					})
					.style("stroke-width", stateStrokeWidth )
					.classed("hovered", false);
				});
			// statesLayer.append("path")
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
					.data(topojson.feature(us, us.objects.counties).features, function(d) {return (Number(d.properties.STATEFP) + d.properties.COUNTYFP);})
					.enter().append("path").attr("d", path)
					.attr("class", function(d) {
						return "feature county hidden FIPS" + Number(d.properties.STATEFP);
					})
					.attr("fill", "#ccc")
					.attr("stroke", function(d){
						return rgbArrayToString(colors.polygonStroke);
					})
					.style("stroke-width", 8) // TODO hardcoded value
					.on("mouseover", function(d) {
						tooltip.style("display", "inline");
						d3.select(this)
							.moveToFront()
							.style("stroke", function(d) {
								return rgbArrayToString(colors.polygonHoverStroke);
							})
							.style("stroke-width", 16 ) // TODO hardcoded value
							.classed("hovered", true);
					})			
					.on("mousemove", function(d) {
						tooltip.html(function(){
							return buildAreaTooltipText(d, model_master);
						})
						.style("left", (d3.event.pageX + tooltipOffset.x) + "px")
						.style("top", function() {
							var tooltipHeight = d3.select(this).node().getBoundingClientRect().height;
							return (d3.event.pageY - tooltipHeight) + "px";
						});
					})
					.on("mouseout", function() {
						tooltip.style("display", "none");
						d3.select(this)
							.moveToFront()
							.style("stroke", function(d){
								return rgbArrayToString(colors.polygonStroke);
							})
							.style("fill", function(d) {
								var node = model_master.findNodeByID(Number(d.properties.STATEFP) + d.properties.COUNTYFP);
								return populationDensityColor(Number(node.populationDensity));
							})
							.style("stroke-width", 8 ) // TODO hardcoded value
							.classed("hovered", false);
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

	function removeNecklaceMap() {
		d3.select("#necklaceMapLayer").remove();
	}

	function getNodeRadius(node) {
		return model_copy.getNodeRadius(node);
	}

	function endClipRadius(endNode) {
		// distance between end of flow and end point
		var gapDistanceToEndNode = model_copy.settings.flowDistanceFromEndPointPixel,
		    endNodeRadius = model_copy.settings.NODE_STROKE_WIDTH / 2 + getNodeRadius(endNode);
		return gapDistanceToEndNode + endNodeRadius;
	}
	
	function startClipRadius(startNode) {
		// distance between end of flow and end point
		var gapDistanceToStartNode = model_copy.settings.flowDistanceFromStartPointPixel,
		    startNodeRadius = model_copy.settings.NODE_STROKE_WIDTH / 2 + getNodeRadius(startNode);
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
			//flow = f.getArrow()[6];
			flow = f.getArrow().outFlow;
			rs = model_copy.settings.flowDistanceFromStartPointPixel > 0 ? startClipRadius(f.getStartPt()) : 0;
			flow = flow.getClippedFlow(rs, 1);
			// clip the start bit off the arrowed flow
		} else {
			rs = model_copy.settings.flowDistanceFromStartPointPixel > 0 ? startClipRadius(f.getStartPt()) : 0;
			re = model_copy.settings.flowDistanceFromEndPointPixel > 0 ? endClipRadius(f.getEndPt()) : 0;
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

		//s = "M " + a[0].x + "," + a[0].y + " L" + a[1].x + "," + a[1].y + " Q" + a[2].x + "," + a[2].y + " " + a[3].x + "," + a[3].y + " Q" + a[4].x + "," + a[4].y + " " + a[5].x + "," + a[5].y + " L" + a[0].x + "," + a[0].y;

		s = "M " + a.basePt.x + "," + a.basePt.y + 
		    " L" + a.corner1Pt.x + "," + a.corner1Pt.y + 
		    " Q" + a.corner1cPt.x + "," + a.corner1cPt.y + 
		     " " + a.tipPt.x + "," + a.tipPt.y + 
		    " Q" + a.corner2cPt.x + "," + a.corner2cPt.y + 
		     " " + a.corner2Pt.x + "," + a.corner2Pt.y + 
		    " L" + a.basePt.x + "," + a.basePt.y;

		return s;
	}

	function getFlowColor(flow) {
		var w, c;
		if (flow.isSelected()) {
			return selectedColor;
		}
		if (flow.isLocked() && model_copy.settings.showLockedFlows) {
			return lockedColor;
		}
		w = model_copy.getRelativeFlowValue(flow);
		c = Flox.ColorUtils.blend(colors.minFlowStroke, colors.maxFlowStroke, w);
		return rgbArrayToString(c);
		//return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
	}

	/**
	 * Configures the arrows so they will be scaled according to a model with
	 * more flows in it than the maxFlows model passed into drawFeatures. This
	 * allows arrows to be drawn the correct size when viewing individual
	 * county flows. 
	 */
	function configureArrows(model) {
		var flows, flow, arrowSettings, i, j;
		// get the flows from the model_copy...
		flows = model_copy.getLargestFlows();
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			// ...but get the settings from the activeModel.
			// This allows for proper sizing of arrows even though not all
			// flows are present in the model_copy
			arrowSettings = model.getArrowSettings(flow);
			flow.configureArrow(arrowSettings);
		}
	}

	

	function drawFlows(drawArrows) {

		var flows = model_copy.getLargestFlows(),
		    i,
		    j,
		    f,
		    rs,
		    re,
		    svgFlows;
	
		configureArrows(model_copy);

		
		// sort the flows in descending order so that big flows are drawn under
		// small flows (big flows will be drawn first)
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
		svgFlows.append("path")
			.classed("curveOutline", true)
			.attr("stroke", "#ccc")
			.style("cursor", "default")
			.attr("fill", "none")
			.attr("stroke-width", function(d) {
				return (model_copy.getFlowStrokeWidth(d) + 4 * model_copy.settings.scaleMultiplier);
			})
			.attr("opacity", 0.0)
			.attr("d", function(d) {
				return buildSvgFlowPath(d, drawArrows);
			});
			
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
				var strokeWidth = model_copy.getFlowStrokeWidth(d);
				if(strokeWidth <= model_copy.settings.minFlowWidth * model_copy.settings.scaleMultiplier) {
					d3.select(this).attr("stroke-dasharray", strokeWidth * 6 + "," + strokeWidth * 6);
					//return 1;
				}
				return strokeWidth;
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
			tooltip.html(function() {
				return buildFlowTooltipText(d);
			})
			.style("left", (d3.event.pageX + tooltipOffset.x) + "px")
			.style("top", function() {
				var tooltipHeight = d3.select(this).node().getBoundingClientRect().height;
				return (d3.event.pageY - tooltipHeight) + "px";
			});
        })
        .on("mouseout", function() {
			tooltip.style("display", "none");
			d3.select(this).select(".curve").attr("stroke", function(d) {
				return getFlowColor(d);
			});
			d3.select(this).select(".arrow").attr("fill", function(d) {
				return getFlowColor(d);
			});
        });
	}

	function drawPoints() {
		var //points = model_copy.getPoints(),
			points = model_copy.getPoints(),
		    circles = d3.select("#pointsLayer")
						.selectAll("circle")
						.data(points)
					    .enter().append("circle");

		// Add some attributes to the points
		circles.style("stroke", "black").style("stroke-width", function(d) {
			return model_copy.settings.NODE_STROKE_WIDTH;
		})
		.attr("class", function(d) {
			return "node FIPS" + d.id; // FIXME id is really FIPS
		})
		.style("fill", "white")
		.style("stroke", function(d) {// adjust the color
			if (d.selected) {
				return "#59A4FF";
			}
			return "black";
		})
		.style("cursor", "default")
		.attr("r", function(d) {
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
	 * For debugging.
	 * Draws obstacles, which includes nodes and circles around arrows. Good
	 * for making sure flows don't overlap them. 
	 */
	function drawObstacles() {
		var obstacles = Flox.getObstacles(model_copy),
			circles;
		
		d3.select("#obstaclesLayer").remove();
		
		circles = d3.select("#mapFeaturesLayer").append("g").attr("id", "obstaclesLayer")
					.selectAll("circle")
					.data(obstacles)
					.enter().append("circle");
			
		circles.style("stroke", "black")
			   .style("fill", "C80000")
			   .style("opacity", 0.1)
			   .attr("cx", function(d) {
					return d.x;
			   })
			   .attr("cy", function(d) {
					return d.y;
			   })
			   .attr("r", function(d) {
					return (d.r + model_copy.settings.minObstacleDistPx);
			   })
			   .attr("pointer-events", "none");
	}

	// TODO name better
	function getColorRampForD3(classes) {
		var colorRamp, d3ColorRamp = [], i;
		
		colorRamp = Flox.ColorUtils.getColorRamp(colors.minPopDensityFill,
			colors.maxPopDensityFill, classes);
		
		for(i = 0; i < colorRamp.length; i += 1) {
			d3ColorRamp.push(rgbArrayToString(colorRamp[i]));
		}
		return d3ColorRamp;
	}

	function colorCountiesByPopulationDensity() {
		var stateFIPS, counties, nodes, node, countyNodes = [], i,
		popDensities, model_master, popDensity, jenksBreaks,
		classes = defaultClasses;
		
		model_master = Flox.getModel();
		nodes = model_master.getPoints(); // this gets state and county nodes.
		stateFIPS = model_copy.settings.datasetName.slice(4); // FIXME goofy
		counties = d3.selectAll(".FIPS" + stateFIPS);
		
		for (i = 0; i < nodes.length; i += 1) {
			node = nodes[i];
			if(node.type === "county"){ // Even state nodes have this, so the state pop densities are being added.
				countyNodes.push(node);
			}
		}
		
		popDensities = countyNodes.map(function(d) {
				popDensity = Number(d.populationDensity);
				if(isNaN(popDensity)) {
					console.log("pop density is NaN!");
					return 0;
				}
				return popDensity;
		});
		
		if(popDensities.length <= defaultClasses) {
			// There are as many or more colors than there are counties
			// There will be only one county of each color. 
			// Therefore, you don't need to make a jenks scale. You can just
			// use the popDensities as breaks. Sorted, of course.
			popDensities.sort(function(a,b) {
				return a - b;
			});
			jenksBreaks = popDensities;
			classes = popDensities.length;
			populationDensityColor = d3.scale.threshold()
				.domain(jenksBreaks.slice(1))
				.range(getColorRampForD3(classes));
		} else {
			jenksBreaks = ss.jenks(popDensities, classes);
			populationDensityColor = d3.scale.threshold()
				.domain(jenksBreaks.slice(1, -1))
				.range(getColorRampForD3(classes));
		}		
					
		// TODO update legend here!
		configureLegend(jenksBreaks);

		
		counties.style("fill", function(d) {
			node = model_master.findNodeByID(Number(d.properties.STATEFP) + d.properties.COUNTYFP);
			popDensity = Number(node.populationDensity);
			if(isNaN(popDensity)===false) {
				var color = populationDensityColor(popDensity);
				return color;
			}
			return "ccc";
		});
	}

	function colorStatesByPopulationDensity() {
		// Select the state polygons somehow. 
		var statePolygons, model_master, nodes, node, i, popDensities, STATEFP,
			colorRamp, jenksBreaks;
		
		statePolygons = d3.selectAll(".feature.state");
		model_master = Flox.getModel();
		nodes = model_master.getPoints(); // This gets county AND state points.
		
		popDensities = nodes.map(function(d){
			return Number(d.populationDensity);
		});
		
		// Create a jenks natural breaks scale with 7 classes.
		// Uses simple_statistics.js
		// TODO build the color gradient from a min and max color rather than
		// hard coding each color.
		
		jenksBreaks = ss.jenks(popDensities, defaultClasses)
		
		populationDensityColor = d3.scale.threshold()
		    .range(getColorRampForD3(defaultClasses))
			.domain(jenksBreaks.slice(1, -1));
		
		configureLegend(jenksBreaks);
		
		statePolygons.style("fill", function(d) {
			STATEFP = d.properties.STATEFP;
			node = model_master.findNodeByID(String(Number(STATEFP)));
			var color = populationDensityColor(Number(node.populationDensity));
			return color;
		})
		.style("stroke", rgbArrayToString(colors.polygonHoverStroke))
		.attr("opacity", 1);
		
	}

	function drawIntermediateFlowPoints() {
		// flow points should be stored inside flows, right?
		var flows,
			flowPoints,
			allFlowPoints = [],
			flow,
			circles,
			i, j;
		
		model_copy.cacheAllFlowLineSegments();
		flows = model_copy.getLargestFlows();
		
		for(i = 0; i < flows.length; i += 1) {
			flowPoints = flows[i].getCachedLineSegments();
			for(j = 0; j < flowPoints.length; j += 1) {
				allFlowPoints.push(flowPoints[j]);
			}
		}
		
		d3.select("#flowPointsLayer").remove();
		
		circles = d3.select("#mapFeaturesLayer").append("g").attr("id", "flowPointsLayer")
			.selectAll("circle")
			.data(allFlowPoints)
			.enter().append("circle");
			
		circles.style("stroke", "black")
			.style("fill", "white")
			.attr("cx", function(d) {
				return d.x;
			})
			.attr("cy", function(d) {
				return d.y;
			})
			.attr("r", function(d) {
				return 5 * model_copy.settings.scaleMultiplier;
			});
	}

	/**
	 * @param m : A copy of the model.
	 */
	function drawFeatures(m) {
	
		var filterSettings = Flox.getFilterSettings(), modelJSON, 
			drawArrows, modelJSONString;
		
		// Stringify the model! For debugging. TODO
		//m.stringifyModel();
		
		removeAllFlows();
	
		if(!m) {
			throw new Error("drawFeatures needs to be passed a copy of the model");
		}
		model_copy = m;
		
		
		
		// if this is county flow data, color the counties by pop density
		if(filterSettings.countyMode && filterSettings.selectedState !== false){
			colorCountiesByPopulationDensity();
			// and make the states a neutral color.
			
		} else {
			// color the states by population density
			colorStatesByPopulationDensity();
		}

		if (model_copy.settings.drawFlows) {
			drawFlows(model_copy.settings.drawArrows);
		}
		if (model_copy.settings.drawNodes) {
			console.log("The model says to draw nodes, so I'm drawing nodes.");
			drawPoints();
		} 

		//drawObstacles();
		//drawIntermediateFlowPoints();
	}
	
	// TODO Are counties the only features that have a state fips as a class?
	// This seems like it will cause conflict later. 
	function showCountyBordersWithinState(stateFIPS) {
		d3.selectAll(".FIPS" + Number(stateFIPS)).classed("hidden", false);
	}

	function hideAllCountyBorders() {
		d3.selectAll(".county").classed("hidden", true);
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

	function getMaxOutOfStateNetFlow(model) {
		// Get the nodes
		var nodes = model.getPoints(),
			maxNetFlow = 0, i, netFlow;
		// looooopy loop-de-looper loop loop
		for (i = 0; i < nodes.length; i += 1) {
			netFlow = Math.abs(nodes[i].netFlow);
			maxNetFlow = netFlow > maxNetFlow ? netFlow: maxNetFlow;
		}
		return maxNetFlow;
	}

	// FIXME could I make one function that does both this and the above one?
	function getMaxOutOfStateTotalFlow() {
		// Get the nodes
		var nodes = Flox.getModel().getPoints(),
			maxTotalFlow = 0, i, totalFlow;
		// looooopy loop-de-looper loop loop
		for (i = 0; i < nodes.length; i += 1) {
			totalFlow =nodes[i].totalIncomingFlow + nodes[i].totalOutgoingFlow;
			maxTotalFlow = totalFlow > maxTotalFlow ? totalFlow: maxTotalFlow;
		}
		return maxTotalFlow;
	}

	function sortCirclesByRadius(circles) {
		circles.sort(function(a,b) {
			return b.r - a.r;
		});
	}

	/**
	 * Places circles on outerCircle that correspond to the states array.
	 *
	 * @param {Object} outerCircle - Circle around central state polygon
	 * @param {Array} states - Array of state abbreviations to make circles for.
	 */
	function getStateCircles(model, outerCircle, states, outerStatesNodes) {

		var stateCircles = [],
			nodeValue,
			maxNodeValue = getMaxOutOfStateTotalFlow(),
			filterSettings = Flox.getFilterSettings(),
			maxR = outerCircle.r * 0.2,
			maxArea = Math.PI * maxR * maxR,
			ptArea,
		    i,
		    j,
		    pt;

		for ( i = 0, j = outerStatesNodes.length; i < j; i += 1) {
			pt = outerStatesNodes[i];
			projectPointOnCircle(pt, outerCircle);
			pt.necklaceMapNode = true;
			
			// Make node radius based on total flow for that node.
			ptArea = (maxArea * (pt.totalIncomingFlow + pt.totalOutgoingFlow))/maxNodeValue;
			pt.r = Math.sqrt(ptArea/Math.PI);

			pt.strokeWidth = pt.r * 0.10;
			stateCircles.push(pt);
		}
		sortCirclesByRadius(stateCircles);
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
	
	// Zooms to a circle object {cx: center x, cy: center y, r: radius}
	// Adds a litle padding to the circle and the edge of the window
	function zoomToCircle(c){
		// get the corners of a box around the circle. 
		var dx = c.r * 2,
			dy = c.r * 2,
			scale = 0.7 / Math.max(dx / width, dy / height),
			translate = [width / 2 - scale * c.cx, height / 2 - scale * c.cy];
		svg.transition()
		.duration(750) // TODO long zoom for testing asynchronous stuff.
		.call(zoom.translate(translate).scale(scale).event);
	}
	
	// FIXME Hardcoded scale. Calculate scale from feature extent somehow.
	function zoomToFullExtent() {
		svg.transition().duration(750).call(zoom.translate([width / 2, height / 2]).scale(0.06).event);
	}

	// Zooms out to full extent, deselects everything, hides all county
	// boundaries, resets some filter settings.
	function reset() {

		// // Hide county boundaries.
		// d3.selectAll(".county").classed("hidden", true);
// 		
		// var settings = Flox.getFilterSettings();
// 		
		// // Remove flows if a state is selected, or if there is no state
		// // selected but it's in county mode (to get rid of state to state
		// // flows when the County Flows button is pushed)
		// if(settings.selectedState !== false || (settings.selectedState === false && settings.countyMode)) {
			// removeAllFlows();
			// if(settings.countyMode){
				// my.resetStateFillColor();
			// }
		// }
// 		
		// // If it's in state mode, and a state is selected, need to get
		// // rid of them flows and add the state to state ones. 
		// if(settings.stateMode && settings.selectedState !== false) {
			// Flox.importStateToStateMigrationFlows();
		// }
		// // Also remove all necklace maps.
		// d3.select("#necklaceMapLayer").remove(); 
// 		
		// // Deselect countys and states
		// Flox.setFilterSettings({selectedState: false, selectedCounty: false});
		
		zoomToFullExtent();
	}

	/**
	 * Does all the things needed when a state is selected. Makes a necklace
	 * map, zooms in, lays out the flows, displays the flows, everything.
	 * @param {object} Object containing the geometry and properties of the 
	 * selected state. 
	 */
	function selectState(stateFIPS) {
		
		var statePolygon, stateBoundingBox, outerCircle, testStates, 
		stateCircles, filterSettings;
		
		// Clear out all flows and necklace maps.
		removeAllFlows();
		d3.select("#necklaceMapLayer").remove(); 
		
		// get the statePolygon, yes? This is goofy here. You want the data though.
		// How else would you get it?
		d3.select("#" + "FIPS" + Number(stateFIPS)).each(function(d) {
			statePolygon = d;
		});
		
		// Behavior should be different if it's in stateMode vs countyMode.
		filterSettings = Flox.getFilterSettings();
		
		// Deselect the selected county if there is one
		filterSettings.selectedCounty = false;
		filterSettings.selectedState = stateFIPS;
		filterSettings.selectedFeatureName = statePolygon.properties.NAME;
		
		// County mode?
		if(filterSettings.countyMode) {
			
			// Get the smallest circle around the polygon, save it for later.
			outerCircle = getSmallestCircleAroundPolygon(statePolygon);
			
			
			// Load the county flow data for that state
			//zoomToPolygon(statePolygon); 
			zoomToCircle(outerCircle);
			
			Flox.importTotalCountyFlowData(statePolygon.properties.STATEFP);
			// Hide county boundaries
			hideAllCountyBorders();
			// Show just the county boundaries for the selected state
			showCountyBordersWithinState(statePolygon.properties.STATEFP);
			
			
			
			d3.selectAll(".feature.state")
			  .transition()
			  .style("fill", rgbArrayToString(colors.unselectedStateFill))
			  .style("stroke", rgbArrayToString(colors.unselectedStateStroke));
			
		} else if (filterSettings.stateMode) {
			// Load the state flow data for that state.
			// Because it's in state mode, the state flows should already be
			// loaded. So all it has to do is show the flows. 
			Flox.updateMap();
		}
		

	}

	function selectCounty(countyFIPS, feature) {
		removeAllFlows();
		d3.select("#necklaceMapLayer").remove();
		var lsad = feature.properties.LSAD,
			featureType = lookupLSAD[lsad];
		
		Flox.setFilterSettings({
			selectedCounty: countyFIPS,
			selectedFeatureName: feature.properties.NAME + " " + featureType});
		Flox.updateMap();
	}

	function stateClicked(d) {
		// If it's in state mode, and this state is already selected...reset?
		if(Number(Flox.getFilterSettings().selectedState) === Number(d.properties.STATEFP)) {
			reset();
			// load the state to state flows?
			Flox.importStateToStateMigrationFlows();
		} else {
			selectState(d.properties.STATEFP);
		}
	}

	function countyClicked(d) {
		var FIPS = d.properties.STATEFP + d.properties.COUNTYFP;
		selectCounty(FIPS, d);
	}

	function necklaceNodeClicked(d) {
		selectState(d.STATEFP);
	}
	
	

	function zoomed() {
		var //features = d3.selectAll(".feature"),
			//hoveredFeatures = d3.selectAll(".feature.hovered"),
			
		g = svg.select("#mapFeaturesLayer");

		mapScale = d3.event.scale;

		//console.log(mapScale);
		
		//g.style("stroke-width", 1 / mapScale + "px");
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
			labelSize = (outerCircle.r * 0.07),	// in pixels
			pt,
			labelOffset = 0;
			
		// delete the previous necklace map
		d3.select("#necklaceMapLayer").remove(); 
	
		// Initialize the force layout settings
		// 0 gravity has great results! Otherwize nodes arrange themselves lopsided. 
		force = d3.layout.force().gravity(0.0).charge(-r * 0.28).size([w, h]).nodes(stateNodes);

		// Add an SVG group to hold the necklace map.
		necklaceMap = d3.select("#mapFeaturesLayer").append("g").attr("id", "necklaceMapLayer");

		nodes = necklaceMap.selectAll(".necklaceNode")
					.data(stateNodes)
					.enter().append("g")
					.attr("class", "necklaceNode")
					.style("cursor", "default");

		// Load the data.
		nodes.append("circle")
			.attr("r", function(d) {
				return d.r;
			})
			.style("fill", function(d) {
				return rgbArrayToString(colors.necklaceNodeFill);
			})
			.style("stroke", function(d) {
				return rgbArrayToString(colors.necklaceNodeStroke);
			})
			.style("stroke-width", function(d) {
				return (d.strokeWidth);
			});
			// .call(force.drag)
			// .on("mousedown", function() {
				// d3.event.stopPropagation();
			// });

		// Add some mouse interactions to the nodes, like tooltips.
		nodes.on("mouseover", function(d) {
			tooltip.style("display", "inline");
			d3.select(this).selectAll("circle")
			  .style("fill", function(d) {
				return rgbArrayToString(colors.necklaceNodeHoverFill);
			  });
        })
        .on("mousemove", function(d) {
			tooltip.html(buildNecklaceNodeTooltipText(d, outerCircle.name))
			       .style("left", (d3.event.pageX + tooltipOffset.x) + "px")
			       .style("top", function() {
						var tooltipHeight = d3.select(this).node().getBoundingClientRect().height;
						return (d3.event.pageY - tooltipHeight) + "px";
			       });
        })
        .on("mouseout", function() {
			tooltip.style("display", "none");
			d3.select(this).selectAll("circle")
			  .style("fill", function(d) {
				return rgbArrayToString(colors.necklaceNodeFill);
			  });
        })
        .on("click", function(d) {
			tooltip.style("display", "none");
			necklaceNodeClicked(d);
        });
		
		function tick () {
			var dx, dy, dist;
			// Changing the transform moves everything in the group.
			nodes.attr("transform", function(d) {
				dx = d.x - cx;
				dy = d.y - cy;
				dist = Math.sqrt(dx * dx + dy * dy);
				d.x = dx * r / dist + cx;
				
				dx = d.x - cx;
				dy = d.y - cy;
				dist = Math.sqrt(dx * dx + dy * dy);
				d.y = dy * r / dist + cy;
				
				return "translate(" + d.x + "," + d.y + ")";
			})
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
		
		nodes.append("text")
			//.attr("text-anchor", "middle")
			.style("font-size", function(d) {
				return labelSize +  "px";
			})
			//.attr("dominant-baseline", "central")
			.text(function(d){
				return d.STUSPS;
			})
			.each(function(d){
				pt = d3.select(this);
				if(labelSize < (d.r + (d.r * 0.70))) {
					pt.attr("text-anchor", "middle")
					  .attr("dominant-baseline", "central");
				} else {
					labelOffset = (d.r * -0.1);
					if(d.x >= cx && d.y <= cy) { // top right
						pt.attr("text-anchor", "start")
						  .attr("x", d.r + labelOffset)
						  .attr("y", -d.r - labelOffset);
					}
					if(d.x >= cx && d.y > cy) { // bottom right
						pt.attr("text-anchor", "start")
						  .attr("dominant-baseline", "hanging")
						  .attr("x", d.r + labelOffset)
						  .attr("y", d.r + labelOffset);
					}
					if(d.x < cx && d.y <= cy) { // top left
						pt.attr("text-anchor", "end")
						  .attr("x", -d.r - labelOffset)
						  .attr("y", -d.r - labelOffset);
					}
					if(d.x < cx && d.y > cy) { // bottom left
						pt.attr("text-anchor", "end")
						  .attr("dominant-baseline", "hanging")
						  .attr("x", -d.r - labelOffset)
						  .attr("y", d.r + labelOffset);
					}
				}
			});
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
		
		var points, polygons,
			formattedPoints = [],
			i, j, pt, xy, circle, formattedCircle;
		
		
		if(targetStatePolygon.geometry.type === "MultiPolygon") {

			polygons = targetStatePolygon.geometry.coordinates;
			
			for(i = 0; i < polygons.length; i += 1) {
				// polygons[0] is an array of one thing. 
				// polygons[1] is also an array of one thing.
				// those one things are arrays of point arrays.
				points = polygons[i][0];
				for(j = 0; j < points.length; j += 1) {
					xy = projection(points[j]);
					if(xy !== null) {
						formattedPoints.push({x: xy[0], y: xy[1]});
					}
				}
			}
			
			
		} else {
			// do this other thing.
			points = (targetStatePolygon.geometry.coordinates[0]);
			for(i = 0, j = points.length; i < j; i += 1) {
				// convert latLng to pixel coords.
				xy = projection(points[i]);
				// turn the array of xy into an object of xy.
				// Push the new object into formattedPoints
				// convert the points to be compatible with smallest circle algorithm
				// FIXME this is dumb
				formattedPoints.push({x: xy[0], y: xy[1]});
			}
		}
		
		circle = Flox.GeomUtils.makeCircle(formattedPoints);
		
		formattedCircle = {
			cx: circle.x,
			cy: circle.y,
			r: circle.r + 30,
			name: targetStatePolygon.properties.NAME
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
	function configureNecklaceMap(model) {
		
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
			datasetName = model.settings.datasetName; // FIPS code of selected state
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
		stateCircles = getStateCircles(model, smallerOuterCircle, outerStates, outerStatesNodes);
		
		// If there are any stateCircles...
		if(stateCircles.length > 0) { 
			// Create and add the necklace map to the map. 
			addNecklaceMap(smallerOuterCircle, stateCircles, function(necklaceMapNodes) {				
				//callback();
			});
		} else {
			//console.log("No out of state nodes?");
		}
	}
	
	function configureLegend(legendData) {
		
		var rectWidth = 25,
			rectHeight = 25,
			rectSpacer = 4,
			labelSizePx = 13,
			legendItemContainer,
			rectangle, 
			legendItem,
			legendColors = populationDensityColor.range();
		
		d3.select("#legendSlidingPanelContent svg").remove();
		
		legendItemContainer = d3.select("#legendSlidingPanelContent")
			.append("svg")
			.attr("width", "100%")
			.attr("height", function() {
				var l = legendColors.length;
				return (l * rectHeight + (l - 1) * rectSpacer);
			});
						
		// rectangle = legendItemContainer.selectAll("rect")
			// .data(legendData.slice(0, -1))
			// .enter().append("rect")
			// .attr("width", rectWidth)
			// .attr("height", rectHeight)
			// .attr("fill", "white")
			// .attr("y", function(d, i) {
				// return (rectHeight + rectSpacer) * i;
			// })
			// .attr("x", 2)
			// .attr("fill", function(d) {
				// return populationDensityColor(d);
			// });
			
		legendItem = legendItemContainer.selectAll("g")
			.data(populationDensityColor.range())
			.enter().append("g");
			
		legendItem.append("rect")
			.attr("width", rectWidth)
			.attr("height", rectHeight)
			.attr("fill", "white")
			.attr("y", function(d, i) {
				return (rectHeight + rectSpacer) * i;
			})
			.attr("x", 2)
			.attr("fill", function(d, i) {
				//return populationDensityColor.range()[i];
				return d;
			});
		
		legendItem.append("text")
			.style("font-size", labelSizePx + "px")
			.style("font-family", "Tahoma, Geneva, sans-serif")
			.attr("fill", "white")
			.text(function(d, i) {
				if(legendData.length <= defaultClasses) {
					//One color for each value
					return (Math.round(legendData[i] * 100)/100);
				} 
				// There are more values than colors.
				// legendData includes 8 values, where the first
				// and last are the min and max. Ranges!
				if(i < defaultClasses - 1) {
					return (Math.round(legendData[i] * 100)/100) + " and up"
				}
				return  (Math.round(legendData[i] * 100)/100) + " to " + 
						(Math.round(legendData[i + 1] * 100) / 100);
			})
			.attr("x", rectWidth + 10)
			.attr("y", function(d, i) {
				return (rectHeight/2 + (labelSizePx/2 - 1))+ ((rectHeight + rectSpacer) * i);
			});
	}
	
	//configureLegend([1,2,3,4,5,6,7]);
	
	// PUBLIC ---------------------------------------------------------------------



	my.configureNecklaceMap = function (m) {
		configureNecklaceMap(m);
	};


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

	my.removeNecklaceMap = function() {
		removeNecklaceMap();
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
		var ll = projection.invert([layerPt[0], layerPt[1]]);

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
	
	my.hideAllCountyBorders = function() {
		hideAllCountyBorders();
	};

	my.rotateProjection = function(lat, lng, roll) {
		projection.rotate([lat, lng, roll]);
	};

	my.selectState = function(stateFIPS) {
		selectState(stateFIPS);
	};

	my.reset = function() {
		reset();
	};

	my.resetStateFillColor = function() {
		// select the states
		var statePolygons = d3.selectAll(".feature.state");
		statePolygons.transition()
			.duration(500)
			.style("fill", "#ccc")
			.attr("opacity", 1);
	};
	
	my.zoomToFullExtent = function() {
		zoomToFullExtent();
	};
	
	// Debug
	my.getPopulationDensityColor = function() {
		return populationDensityColor;
	};
	
	return my;
};

