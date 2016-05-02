Flox.MapComponent_Leaflet = function() {
	"use strict";
	/**
	 * The leaflet map that gets displayed in the UI. 
	 */
    var map, 
		currentBasemap,// holder for map
		activeMapTool,
		
		// COPIED FROM RENDERER
		svg,
		// Color variables for flows, used by _getFlowColor(flow);
		lockedColor = "gray",
		selectedColor = "#59A4FF",
		defaultColor = "black",
		drag,
		previousDragX,
		previousDragY,
		// END COPIED FROM RENDERER
		
		// Baselayers are accessed using leaflet-providers.js
		// I copied this snippet from Ryan Stanley's cartovis.com'
		// TODO pick the baselayers that I want to use. These are kinda default.
		basemapLayers = {
			ESRI_grayBasemap: L.tileLayer.provider('Esri.WorldGrayCanvas'),
			OpenStreetMap_Mapnik: L.tileLayer.provider('OpenStreetMap.Mapnik'),
			OpenStreetMap_HOT: L.tileLayer.provider('OpenStreetMap.HOT'),
			Esri_WorldImagery: L.tileLayer.provider('Esri.WorldImagery'),
			Esri_WorldTerrain: L.tileLayer.provider('Esri.WorldTerrain'),
			Esri_NatGeoWorldMap: L.tileLayer.provider('Esri.NatGeoWorldMap'),
			Stamen_TonerLite: L.tileLayer.provider('Stamen.TonerLite'),
			Stamen_TerrainBackground: L.tileLayer.provider('Stamen.TerrainBackground')
		},
		
		basemapButtons = {
			"#gray_basemap": basemapLayers.ESRI_grayBasemap,
			"#osmapnik_basemap": basemapLayers.OpenStreetMap_Mapnik,
			"#oshot_basemap": basemapLayers.OpenStreetMap_HOT,
			"#esri_imagery_basemap": basemapLayers.Esri_WorldImagery,
			"#esri_terrain_basemap": basemapLayers.Esri_WorldTerrain,
			"#esri_natgeo_basemap": basemapLayers.Esri_NatGeoWorldMap,
			"#stamen_tonerlite_basemap": basemapLayers.Stamen_TonerLite,
			"#stamen_terrain_basemap": basemapLayers.Stamen_TerrainBackground
		},
	    my = {};    // returned "public" functions
	    
	    
	/**
	 * Initialize the map and the GUI elements on the map. 
	 */
    function initMap() {

        // Initialize the leaflet map. The L.map() function requires the id of an html div. That's where the map will go. This is almost always 'map' unless there's more than one map on a page.
        map = L.map("map").setView([50,10], 4);

		var addFlowToolToggle, panToolToggle, toolbar, sidebar;
            
        // Move the attribution text to the bottom left of the map.
        map.attributionControl.setPosition("bottomleft");

		// Add baselayer to the map. Uses leaflet-providers.js
        basemapLayers.ESRI_grayBasemap.addTo(map);
		currentBasemap = basemapLayers.ESRI_grayBasemap;

		// Update the baselayer when a new base layer is selected in the UI
		$('#baseLayerSelector').change(function() { 
			var newLayer = basemapButtons["#" + $(this).val()];
			map.removeLayer(currentBasemap);
			newLayer.addTo(map);
			currentBasemap = newLayer;
		});
		
        // This creates an action. Which is really a button. 
        // Actions can be added to toolbars, where they appear as a button.
        // Uses https://github.com/Leaflet/Leaflet.toolbar
        addFlowToolToggle = L.ToolbarAction.extend({
            // Options for this toolbar button.
            // Here the icon and tooltip info are set.
            options: {
                toolbarIcon: {
                    html: '&#678;', // This adds an icon to the button. It was kinda chosen at random
                    tooltip: 'Add Flow Tool'
                }
            },
            // I don't know why this is called addHooks. But this is where
            // the function you want to happen when the button is clicked goes.
            addHooks: function () {
				activeMapTool = "addFlowTool";
            }
        });
        
        panToolToggle = L.ToolbarAction.extend({
			
			// Options for this toolbar button.
            // Here the icon and tooltip info are set.
            options: {
                toolbarIcon: {
                    html: '&#678;', // This adds an icon to the button. It was kinda chosen at random
                    tooltip: 'Add Flow Tool'
                }
            },
            // I don't know why this is called addHooks. But this is where
            // the function you want to happen when the button is clicked goes.
            addHooks: function () {
				activeMapTool = "panTool";
            }
        });

        // Create a toolbar!
        // Uses https://github.com/Leaflet/Leaflet.toolbar
        toolbar = new L.Toolbar.Control({
            // Toolbar options
            position: "topleft", // where the toolbar goes!
            actions: [
                // An array of actions. Each action is a button. 
                // I don't know why they're called actions and not buttons.
                panToolToggle,
                addFlowToolToggle
                // add more actions
            ]
        });

        // Here is where the toolbar is added to the map. 
        // TODO It is commented out because it doesn't do anything useful yet.
        //toolbar.addTo(map);

        // Initializes and adds the sidebar to the map. 
        // The sidebar layout is set up in index.html
        // Uses https://github.com/Turbo87/sidebar-v2
        sidebar = L.control.sidebar('sidebar', {position:'right'}).addTo(map);

		// Initialize the SVG layer.
		map._initPathRoot();
		
		// When the map zooms or resets, update the map elements.
		map.on("zoomstart", Flox.zoomstart);
		map.on("viewreset", Flox.update);

        // Set the currentMap varible in the FloxMapComponent module to the map 
        // created by this function. This will make it accessible to other 
        // modules!
    }

// START COPIED FROM RENDERER



    // takes a flow object, builts an SVG curve out of the 3 points, translating 
    // the LatLng coordinates to screen coordinates.
    function buildSvgFlowPath(f) {
		var rs, re, flow, sPX, sPY, cPX, cPY, ePX, ePY;
		// The place where this thing is clipped will depend on whether or 
		// not arrows are drawn. 
		if (Flox.isDrawArrows() && f.getArrow()) {
			flow = f.getArrow()[6];
			rs = Flox.getFlowDistanceFromStartPointPixel() > 0 ? Flox.getStartClipRadius(f.getStartPt()) : 0;
			flow = flow.getClippedFlow(rs, 1); // clip the start bit off the arrowed flow
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
		
		s = "M " + a[0].x +  "," + a[0].y + 
		    " L" + a[1].x + "," + a[1].y + 
		    " Q" + a[2].x + "," + a[2].y +  
		    " "  + a[3].x + "," + a[3].y +
			" Q" + a[4].x + "," + a[4].y + 
		    " "  + a[5].x + "," + a[5].y +
		    " L" + a[0].x + "," + a[0].y;	
		
		// s = "M " + a.basePt.x +  "," + a.basePt.y + 
		    // " L" + a.corner1Pt.x + "," + a.corner1Pt.y + 
		    // " Q" + a.corner1cPt.x + "," + a.corner1cPt.y +  
		    // " "  + a.tipPt.x + "," + a.tipPt.y +
			// " Q" + a.corner2cPt.x + "," + a.corner2cPt.y + 
		    // " "  + a.corner2Pt.x + "," + a.corner2Pt.y +
		    // " L" + a.basePt.x + "," + a.basePt.y;		
		
		return s;
	}

    // Return svg paths for the control point connector lines
    function buildSvgCPtConnectorPath(flow) {
		var sPX = flow.getStartPt().x,
			sPY = flow.getStartPt().y,
			cPX = flow.getCtrlPt().x,
			cPY = flow.getCtrlPt().y,
			ePX = flow.getEndPt().x,
			ePY = flow.getEndPt().y;

        return "M" + sPX + "," + sPY + " L" + cPX + "," + cPY + " L" + ePX + "," + ePY;
    }

	// Returns an svg path for a flow's rangebox
    function buildRangeboxPath(flow) {
        // Get the 4 rangebox points
        var box = flow.computeRangebox(Flox.getFlowRangeboxHeight()),
			x0 = box[0].x,
			y0 = box[0].y,
			x1 = box[1].x,
			y1 = box[1].y,
			x2 = box[2].x,
			y2 = box[2].y,
			x3 = box[3].x,
			y3 = box[3].y;

        return "M" + x0 + "," + y0 + " L" + x1 + "," + y1 + " L" + x3 + "," + y3 + " L" + x2 + "," + y2 + " L" + x0 + "," + y0;

    }

    // Remove all svg elements (flows and nodes) from the map.
    function clearAll() {
		if(!svg) {
			return;
		}
        svg.selectAll("*").remove();
    }

	function dragStarted(d) {
		var offset = get_leaflet_offset();
		
		previousDragX = d3.event.sourceEvent.clientX - offset[0];
		previousDragY = d3.event.sourceEvent.clientY - offset[1];
		
			
		d3.event.sourceEvent.stopPropagation(); // TODO Does this help?
		d3.select(this).classed("dragging", true);
	}

	function dragEnded(d) {
		//var offset = get_leaflet_offset();
		d3.select(this).classed("dragging", false);
	}

	function get_leaflet_offset(){
		var mapPane = map.getPanes(mapPane).mapPane,
		    elemRect = mapPane.getBoundingClientRect();
		return [elemRect.left, elemRect.top]; 
	}

	function dragged(d) { // What is d? Depends on what got clicked maybe?
		var offset = get_leaflet_offset(),
			dx, dy,
			eventX = d3.event.sourceEvent.clientX - offset[0],
			eventY = d3.event.sourceEvent.clientY - offset[1],	
			latLng,
			cPt,
			newX, newY;
		
		dx = eventX - previousDragX;
		dy = eventY - previousDragY;
		
		previousDragX = eventX;
		previousDragY = eventY;
		//console.log(loc);
		
		d3.select(this).attr("transform", function (d){
			
			// d is either a flow or a node.
			// Why? Whether or not a control point is visible
			// depends on the state of the Flow, so Flows are bound to the 
			// svg control points for easy access to Flow properties.
			// if it's a node, just set coordinates of d
			// if it's a flow, get the control point and set the coords of that
			// How can we tell if it's a flow?
			// Flows have many functions. See if one of them exists.
			if (typeof d.getCtrlPt === "function") { // It's a flow
				cPt = d.getCtrlPt();
				cPt.x += dx;
				cPt.y += dy;
				newX = cPt.x;
				newY = cPt.y;
				latLng = Flox.layerPtToLatLng([cPt.x, cPt.y]);
				cPt.lat = latLng.lat;
				cPt.lng = latLng.lng;
		    } else { // It's a node
				d.x += dx;
				d.y += dy;
				newX = d.x;
				newY = d.y;
				latLng = Flox.layerPtToLatLng([d.x, d.y]);
				d.lat = latLng.lat;
				d.lng = latLng.lng;
			}
			
			d3.select("#flowPointLayer").remove();
			
			if(Flox.isDrawIntermediateFlowPoints()) {
				drawIntermediateFlowPoints();
			}
			
			update();
			return "translate(" + newX +"," + newY +")";
		});
	}

	drag = d3.behavior.drag()
             .origin(function (d){return d; })
             .on("dragstart", dragStarted)
             .on("drag", dragged)
             .on("dragend", dragEnded);

	// FIXME the following two functions are now rather obsolete.
	// Resizes the flows. Called when the slider is moved.
	function resizeFlows(){
		clearAll();
		render();
	}
	// Resizes the points.
	function resizePoints(){
		clearAll();
		drawFeatures();
	}

	// TODO add checkbox for indicating which flows are locked.
	function getFlowColor(flow) {
		if(flow.isSelected()){
			return selectedColor;
		}
		if(flow.isLocked() && Flox.isShowLockedFlows()){
			return lockedColor;
		}
		return defaultColor;
	}

	function showHideCtrlPts() {
		
		// If the checkbox is checked, set all the control points to visible		
		if(Flox.isDrawControlPoints()) {
			d3.select("#ctrlPaths").selectAll("path")
			  .style("visibility", "visible");
			d3.select("#ctrlPoints").selectAll("circle")
			  .style("visibility", "visible");
		} else { //set control points for selected flows to visible, the rest hidden
			d3.select("#ctrlPaths").selectAll("path")
			  .style("visibility", "hidden");
			d3.select("#ctrlPoints").selectAll("circle")
			  .style("visibility", "hidden");
			
			// Now, show only control points of selected flows 
			d3.select("#ctrlPaths").selectAll("path")
			  .style("visibility", function (d){
				if(d.isSelected()){
					return "visible";
				}
				return "hidden";
			  });
			d3.select("#ctrlPoints").selectAll("circle")
			  .style("visibility", function (d){
				if(d.isSelected()){
					return "visible";
				}
				return "hidden";
			  });
		}
	}

	function drawFlows() {
		
		Flox.configureArrows();
		
		var maxFlowWidth = Flox.getMaxFlowWidth(),
		    maxFlowValue = Flox.getMaxFlowValue(),
		    flows = Flox.getFlows(),
		    clippedFlows = [],
		    i, j, f, rs, re, clippedFlow,
		    svgFlows, curves, arrows;
				
		svgFlows = svg.append("g") // a group to hold all the flows
                   .attr("id", "flowsLayer")
                   .selectAll("g") // a group for each flow
                   .data(flows) // flow data added to GROUP
                   .enter().append("g"); // add the g to the flowsLayer

        // Add some attributes to the paths
        svgFlows.append("path") // Add a new path. This is the flow curve!
			 .classed("curve", true)
			 .attr("stroke", function (d) {
				return getFlowColor(d);
             })
             .style("cursor", "default")
             .attr("fill", "none")
             .attr("stroke-width", function (d) {
                 return Flox.getFlowStrokeWidth(d);
             })
        
		// If arrows are supposed to be drawn draw them.
		svgFlows.append("path") // add a new path. This is the arrowhead! 
				.classed("arrow", true)
				.style("cursor", "default")
				.attr("stroke", function(d){
					return "blue";//getFlowColor(d);
				})
				.attr("fill", function(d){
					return getFlowColor(d);
				})
				.attr("stroke-width", 0);
				
		// Change the width on hover		
		svgFlows.on("mouseover", function (d) {
                 d3.select(this).select(".curve").transition().duration(50)
                   .attr("stroke-width", function(){
						return Flox.getFlowStrokeWidth(d) + 3;
                   });
                 d3.select(this).select(".arrow").transition().duration(50)
                   .attr("stroke-width", 3);
             })
             .on("mouseout", function (d) {
                 d3.select(this).select(".curve").transition().duration(50)
                   .attr("stroke-width", function (){
						return Flox.getFlowStrokeWidth(d);
                   });
                 d3.select(this).select(".arrow").transition().duration(50)
                   .attr("stroke-width", 0);
             })
             .on("mousedown", function (d) {
				// deselect all flows, make them black.
				d3.event.stopPropagation();
				deselectAllFeatures();
				// Select this flow  
				d3.select(this)
				  .each(function (d){
					d.setSelected(true);
					Flox.updateTextBoxes();
				  })
				  .selectAll(".curve")
				  .attr("stroke", function (d) {
					return getFlowColor(d);
				  });
				d3.select(this).selectAll(".arrow")
				  .attr("fill", function (d) {
					return getFlowColor(d);
				  })
				  .attr("stroke", function (d) {
					return getFlowColor(d);
				  });
				showHideCtrlPts();
             });
	}

	function drawPoints() {
		var points = Flox.getPoints(),
			circles = svg.append("g")
						 .attr("id", "pointsLayer")
			             .selectAll("circle")
			             .data(points)
			             .enter().append("circle")
						 .each(function(){
						 	if(Flox.isEditMode()) {
						 		d3.select(this).call(drag);
						 	}
			             });
			              // a d3 thing that initiated various listeners
        
        // Add some attributes to the points
        circles.style("stroke", "black")
               .style("stroke-width", 2)
               .style("fill", "white")
               .style("stroke", function (d){ // adjust the color
                         if(d.selected){ 
                             return "#59A4FF";
                         }
                         return "black";
                     })
               .style("cursor", "default")
               .attr("r", function (d){
                   return Flox.getNodeRadius(d);
               })
               .on("mouseover", function (d){
				   //map.dragging.disable();
                   d3.select(this)
                     .transition().duration(50)
                     .attr("r", function (d){
                         return Flox.getNodeRadius(d) + 1.5;
                     });	
               })
               .on("mouseout", function (d){
                   //map.dragging.enable();
                   d3.select(this)
                     .transition().duration(50)
                     //.style("stroke", "black")
                     .attr("r", function(d){
                         return Flox.getNodeRadius(d);
                     });	
               })
               .on("mousedown", function (d){ // FIXME Does this suck? Loops through points twice.
                   d3.event.stopPropagation();
                   deselectAllFeatures();
                   
                   d3.select(this)
                     .each(function (d){
                         d.selected = true; // select the one that was clicked
                     });
                   d3.select("#pointsLayer")
                     .selectAll("circle") // Second loop through.
                     .style("stroke", function (d){ // adjust the color
                         if(d.selected){ 
                             return "#59A4FF";
                         }
                         return "black";
                     });
               });
	}

	function showHideRangeboxes() {
		d3.select("#rangeboxesLayer")
		  .style("visibility", function(d){
              if(Flox.isDrawRangeboxes()){
				  return "visible";
			  } 
			  return "hidden";
		  });
	}
	
	function drawRangeboxes() {
		console.log("draw rangeboxes called!");
		// draw rangeboxes
		var flows = Flox.getFlows(),
		    rangeboxes = svg.append("g")
                            .attr("id", "rangeboxesLayer")
                            .selectAll("path")
                            .data(flows)
                            .enter().append("path");

        rangeboxes.attr("stroke", "gray")
                  .attr("fill", "none")
                  .attr("stroke-width", 1);
	}

	function updateFlowColor() {
		d3.select("#flowsLayer").selectAll("path")
		  .attr("stroke", function (d) {
			  return getFlowColor(d);
		  });
	}

	
	// function showHideFlowPoints() {
		// d3.select("#flowPointLayer")
		  // .style("visibility", function (d){
			// if(Flox.isDrawIntermediateFlowPoints()){
				// return "visible";
			// }
			// return "hidden";
		  // });
	// }
	

	function drawControlPoints(isDrawControlPoints) {
		var flows = Flox.getFlows(),
		    ctrlPts = Flox.getCtrlPts(),
		    ctrlPtLayer, ctrlPaths, ctrlCircles;
		    
	    ctrlPtLayer = svg.append("g")
			             .attr("id", "ctrlPtLayer")
			             .style("visibility", function (d) {
							 if(Flox.isDrawControlPoints()){
								 return "visible";
							 }
							 return "hidden";
			             });

        ctrlPaths = ctrlPtLayer.append("g")
            .attr("id", "ctrlPaths")
            .attr("pointer-events", "none")
            .selectAll("path")
            .data(flows)
            .enter().append("path");

        ctrlPaths.attr("stroke", "gray")
                 .attr("fill", "none")
                 .attr("stroke-width", 1);

        ctrlCircles = ctrlPtLayer.append("g")
            .attr("id", "ctrlPoints")
            .selectAll("circle")
            .data(flows) 
            .enter().append("circle")
            .each(function(){
				if (Flox.isEditMode()) {
					d3.select(this).call(drag);
				}
            })
            
        ctrlCircles.style("stroke", "gray")
            .style("stroke-width", 1)
            .style("fill", "yellow")
            .attr("r", 4)
            .style("cursor", "default")
            .on("mouseover", function (d){
				d3.select(this)
				  .transition().duration(50)
				  .attr("r", 6);
            })
            .on("mouseout", function (d){
				d3.select(this)
				  .transition().duration(50)
				  //.style("fill", "yellow")
				  .attr("r", 4); 
            })
            .on("mousedown", function (d) {
				// turn that nice shade of blue
				d3.select(this)
				  .style("stroke", "#59A4FF")
				  .style("stroke-width", 2);
            })
			.on("mouseup", function (d) {
				d3.select(this)
				  .style("stroke", "gray")
				  .style("stroke-width", 1);
            });
		showHideCtrlPts();
	}

	function drawIntermediateFlowPoints() {
		var flowPointLayer, flowPoints, flowCircles;
		
		// Create an svg group to draw the flowPoints on. 
        flowPointLayer = svg.append("g")
                                .attr("id", "flowPointLayer");

        // Get the points along the flows.
        flowPoints = Flox.getAllFlowPoints();
		
        // Add an svg circle for each point in flowPoints
        flowCircles = flowPointLayer.selectAll("circle")
            .data(flowPoints)
            .enter().append("circle")
            .attr("pointer-events", "none")
            .style("stroke", "white")
            .style("stroke-width", 1.5)
            .style("fill", "pink")
            .attr("r", 3.4);
	}

	function deselectAllNodes() {
		d3.select("#pointsLayer") // select points layer
		     .selectAll("circle") // select the points. First loop through.
		     .each(function (d){
		         d.selected = false; // deselect them all, even the one you're selecting
		     })
		     .style("stroke", function (d){ // adjust the color
                 return "black";
             });
        Flox.updateTextBoxes();
	}

	function deselectAllFlows() {
		var flows, nodes;
		
		// Get all the flows and set their select state to false.
		// reset their color.
		flows = d3.select("#flowsLayer")
				  .selectAll("g")
				  .each(function(d){
					d.setSelected(false);
				  })
				  .selectAll(".curve")
				  .attr("stroke", function (d) {
					return getFlowColor(d);
				  });
				  
				d3.select("#flowsLayer").selectAll("g").selectAll(".arrow")
				  .attr("fill", function (d) {
					return getFlowColor(d);
				  })
				  .attr("stroke", function (d) {
					return getFlowColor(d);
				  });
		Flox.updateTextBoxes();
	}

	function deselectAllFeatures() {
		deselectAllNodes();
		deselectAllFlows();
		showHideCtrlPts();
	}

    // Renders the flows and related elements onto the map.
    function drawFeatures() {     
		
		var settings = Flox.getDrawSettings();

		// Set up the SVG
		svg = d3.select("#map").select("svg")
				.on("mousedown", function() {
					deselectAllFeatures();
				});
		
		if(!svg) {
			console.log("No SVG map layer to draw on!");
		}
		
		// TODO Show/hide flows & points with button/checkbox?
        drawFlows();
        drawPoints();
        
        if(settings.drawRangeboxes) {
			drawRangeboxes();
        }
        
        if(settings.drawIntermediateFlowPoints) {
			drawIntermediateFlowPoints();
        }
        
		drawControlPoints(settings.drawControlPoints);
		
		
        // Calling update here adds coordinate addributes to the svg elements 
        // that were created above.
        update();
    }
	
	
    // Updates the coordinates of the svg elements drawn on the Leaflet map. 
    // Translates the LatLng coordinates of the points to screen coordinates.
    // TODO update gets called before AND after layoutFlows. Why?
    function update() {

		var settings = Flox.getDrawSettings(),
			ctrlPts, points, paths, arrows, rangeboxes, cPtPaths, pointCircles,
			ctrlCircles, flowPoints,
			i, j, cPt, pt, xy, latLng;

        // Update the xy coordinates of all control points
		ctrlPts = Flox.getCtrlPts();
		for (i = 0, j = ctrlPts.length; i < j; i += 1) {
			cPt = ctrlPts[i];
			
			// Does the cPt have a latLng? 
			// If not, assign one based on current xy
			if(!cPt.lat || !cPt.lng) { // either lat or lng is missing
				// assign lat and lng!
				//console.log("found a cPt with no latlng");
				latLng = map.layerPointToLatLng([cPt.x, cPt.y]); // might be able to just pass cPt
				cPt.lat = latLng.lat;
				cPt.lng = latLng.lng;
			}
			
			xy = map.latLngToLayerPoint([cPt.lat, cPt.lng]);
			cPt.x = xy.x;
			cPt.y = xy.y;
		}

		// Update the layer coordinates of all nodes in the model
		points = Flox.getPoints();
		for (i = 0, j = points.length ; i < j; i += 1) {
			pt = points[i];
			
			xy = map.latLngToLayerPoint([pt.lat, pt.lng]);
			pt.x = xy.x;
			pt.y = xy.y;
		}

		Flox.configureArrows();

        // Select all the svg flow curves
        paths = svg.select("#flowsLayer").selectAll("g").select(".curve");

		arrows = svg.select("#flowsLayer").selectAll("g").select(".arrow");

        // For each svg flow curve, assign it a "d" attribute.
        // FIXME This is already done if flow points are drawn. 
        paths.attr("d", function (d) {
            return buildSvgFlowPath(d);
        });

		
		if(Flox.isDrawArrows()) {
			arrows.attr("d", function(d) {
				// d3 is friggin' sweet
				return buildSvgArrowPath(d);
			});
		}
		
		// update the color of the flows?
		//console.log("update was called!");
		updateFlowColor();
		
        // Select all rangeboxes
        rangeboxes = svg.select("#rangeboxesLayer").selectAll("path");

        // For each rangebox, assign it a "d" attribute
        rangeboxes.attr("d", function (d) {
            return buildRangeboxPath(d);
        });

        // Select all the svg ctrl point connector lines
        cPtPaths = svg.select("#ctrlPtLayer").selectAll("path");

        // For each line, assign it a "d" attribute
        cPtPaths.attr("d", function (d) {
            return buildSvgCPtConnectorPath(d);
        });

        // select all the point circles
        pointCircles = svg.select("#pointsLayer").selectAll("circle");

		// select the control point circles
		ctrlCircles = svg.select("#ctrlPtLayer").selectAll("circle");

        // This loops through all nodes and assigns coordinates to
        // them based on the node's xy
        pointCircles.attr("transform", function (d) { 
                                return "translate(" + d.x + "," + d.y + ")";}
        );

		// This loops through all control points 
		ctrlCircles.attr("transform", function (d) { 
                                return "translate(" + 
                                	
                                
                                
                                    d.getCtrlPt().x +","+ 
                                    d.getCtrlPt().y +")";
        // Note: d is a flow, not a control point. This is done to 
        // simplify things in drawControlPoints();
                                }
        );

		// Flowpoint location needs to be completely recalculated. 
		// Otherwise they appear inaccurate at closer zooms due to
		// pixel coordinate rounding, since they don't have a constant latLng
		if(settings.drawIntermediateFlowPoints){
			d3.select("#flowPointLayer").remove();
			drawIntermediateFlowPoints();
	        flowPoints = svg.select("#flowPointLayer").selectAll("circle");
	        flowPoints.attr("transform", function (d) {
						return "translate("+ d.x + "," + d.y + ")";
					}
	        );
		}
		
    }


// END COPIED FROM RENDERER



// PUBLIC --------------------------------------------------------------------

	// START COPIED FROM RENDERER

	my.drawIntermediateFlowPoints = function () {
		drawIntermediateFlowPoints();
	};

	my.showHideCtrlPts = function () {
		showHideCtrlPts();
	};

    my.drawFeatures = function () {
        drawFeatures();            
    };

    my.update = function () {
        update();
    };

    my.clearAll = function () {
        clearAll();
    };
   
    my.resizeFlows = function () {
		resizeFlows();
    };

	my.resizePoints = function () {
		resizePoints();
	};
		
	my.showHideRangeboxes = function () {
		showHideRangeboxes();
	};

	// END COPIED FROM RENDERER



	
	my.initMap = function() {
		initMap();
	};
	
	my.latLngToLayerPt = function(latLng) {
		return map.latLngToLayerPoint(latLng);
	};
	
	my.layerPtToLatLng = function(layerPt) {
		return map.layerPointToLatLng(layerPt);
	};

	my.setView = function(latLng, zoom) {
		map.setView(latLng, zoom);
	};

    return my;
};