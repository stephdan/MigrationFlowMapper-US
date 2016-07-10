// Stores the data and settings
// Returns information about the data and settings.
Flox.Model = function() {
	
	"use strict";
	
		// Points and flows
	var nodes = [],
		flows = [],
	
		// TODO Might want to try storing the nodes in a Map again
		//nodesMap = new Map(),
	
		settings = {
			// Layout Settings
			maxFlowPoints : 20,
			distanceWeightExponent : 3,
			peripheralStiffnessFactor : 0.1,
			maxFlowLengthSpringConstant : 0.05,
			minFlowLengthSpringConstant : 0.5,
			enforceRangebox : true,
			flowRangeboxHeight : 0.4,
			antiTorsionWeight : 0.8,
			angularDistributionWeight : 0.5,
			nodeWeight : 0.0,
			nodeTolerancePx : 0,
			moveFlowsIntersectingNodes : true,
			multipleIterations : true,
			NBR_ITERATIONS : 100,
			showForceAnimation : false,
			FLOW_DISTANCE_THRESHOLD : 0.00000001, // TODO what should this be??
			checkFlowBoundingBoxes : true,
			maxFlows : 50,
			
			// adjusts sizes of features to fit scale better
			// TODO hardcoded everywhere, could be based off actual map scale.
			scaleMultiplier : 0.5, 
			
			// Map Appearance Settings
			maxFlowWidth : 30,
			maxNodeRadius : 10,
			isShowLockedFlows : true,
			flowDistanceFromStartPointPixel : 5,
			flowDistanceFromEndPointPixel : 5,
			NODE_STROKE_WIDTH : 0.5,
			useGlobalFlowWidth: true,
			
			// arrow settings
			arrowSizeRatio : 0.1,
			arrowLengthRatio : 0.2,
			arrowLengthScaleFactor : 1.8,
			arrowWidthScaleFactor : 1,
			arrowEdgeCtrlLength : 0.5,
			arrowEdgeCtrlWidth : 0.5,
			arrowCornerPosition : 0.0,
			pointArrowTowardsEndpoint : true,
			
			// cached values cached by updateCachedValues()
			minFlowValue : 0,
			maxFlowValue : 0,
			meanFlowValue : 0, // used for anything? Adding flows during editing?
			minFlowLength : 0,
			maxFlowLength : 0,
			minNodeValue : 0,
			maxNodeValue : 0,
			meanNodeValue : 0,	
			minFlowWidth: 0,
			
			// Draw Settings
			drawFlows : true,
			drawNodes : false,
			drawArrows : true,
			drawControlPoints : false,
			drawIntermediateFlowPoints : false,
			drawRangeboxes : false,
					
			datasetName : null,
			
			useSpiralMethod: true,
			SPIRAL_SPACING_PX: 15,
			
			useWebworkers: true
		},
	
		

		// A list of appropriate scales for different US states.
		// Increase to make flows wider.
		// FIXME this is problematic, and very hard-coded. There is probably
		// a way to handle this more responsively. 
		// Not really a setting. Doesn't get passed in to the layoutWorker. 
		// TODO The layouter might care about the scale in order to help
		// determine an appropriate distance flows should be moved off nodes. 
		stateScales = {
			"FIPS1"  : 1, // Alabama
			"FIPS34" : 0.5, // New Jersey
			"FIPS36" : 0.35, // New York
			"FIPS44" : 0.5, // Rhode Island
			"FIPS48" : 2, // Texas
			"FIPS54" : 2,  // West Virginia
			"FIPS72" : 0.5,
			"allStates": 0.2
		},
				
		// Public object		
		my = {};
    
	    // Stores all flows and points/
	    // TODO All the code in FloxGraph could be moved into Model, since Model
	    // is the only one who uses it.
		// graph = Flox.getNewFlowGraph();


// START STUFF FROM GRAPH ============================

	// This updates and returns the min/max flow length in the model.
	// Needed because flow lengths change on zoom and during drag events,
	// while other cached values do not.
    // returns {min: value, max: value}
    function getMinMaxFlowLength() {
		    
		var i, j, flow, l,

		minFlowLength = Infinity,
		maxFlowLength = 0;

		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
            l = flow.getBaselineLength();
            if (l > maxFlowLength) {
                maxFlowLength = l;
            }
            if (l < minFlowLength) {
                minFlowLength = l;
            }
		}
		settings.minFlowLength = minFlowLength;
		settings.maxFlowlength = maxFlowLength;
		return {min: minFlowLength, max: maxFlowLength};
    }

	
	// Updates the cached values. These values
	// are used for drawing and layouts, which only care about the flows being
	// shown.
	function updateCachedValues() {
		
		var flowSum = 0,
		    flowCounter = 0,
		    nodeSum = 0,
			nodeCounter = 0,
			i, j, v, flow, l,
		    
		    // values getting updated
			minFlowLength = Infinity,
			maxFlowLength = 0,
			minFlowValue,
			maxFlowValue,
			meanFlowValue,
			minNodeValue,
			maxNodeValue,
			meanNodeValue,
			minFlowWidth;
		
		if (flows.length < 1) {
			minFlowValue = 0;
			maxFlowValue = 0;
		} else {
			minFlowValue = maxFlowValue = flows[0].getValue();
		}

		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			v = flow.getValue();
			if (v < minFlowValue) {
			    minFlowValue = v;
			}
            if (v > maxFlowValue) {
                maxFlowValue = v;
            }
            flowSum += v;
            flowCounter += 1;
            l = flow.getBaselineLength();
            if (l > maxFlowLength) {
                maxFlowLength = l;
            }
            if (l < minFlowLength) {
                minFlowLength = l;
            }
		}
		
		meanFlowValue = flowSum / flowCounter;
			
		if(nodes.length < 1) {
			minNodeValue = 0;
		    maxNodeValue = 0;
		}

		if(nodes.length > 0) {
			minNodeValue = maxNodeValue = nodes[0].value;
		} else {
			minNodeValue = maxNodeValue = 0;
		}
		

		for (i = 0, j = nodes.length; i < j; i += 1) {
			
			v = nodes[i].value;
			
			if(!v) {
				nodes[i].value = 1;
				v = nodes[i].value;
			}
			
			if (v < minNodeValue) {
                minNodeValue = v;
            }
            if (v > maxNodeValue) {
                maxNodeValue = v;
            }
            nodeSum += v;
            nodeCounter += 1;
		}
		meanNodeValue = nodeSum / nodeCounter;
		minFlowWidth = (settings.maxFlowWidth * settings.minFlowValue / maxFlowValue);
		
		settings.minFlowLength = minFlowLength;
		settings.maxFlowLength = maxFlowLength;
		settings.minFlowValue = minFlowValue;
		settings.maxFlowValue = maxFlowValue;
		settings.meanFlowValue = meanFlowValue;
		settings.minNodeValue = minNodeValue;
		settings.maxNodeValue = maxNodeValue;
		settings.meanNodeValue = meanNodeValue;
		settings.minFlowWidth = minFlowWidth;
    }
    
    
    /**
     * If the target node exists in nodes already, return the existing node.
     * Otherwise, return the target node.
     */
    function findPoint(target) {

		var i, j, pt;
		// Loop through the existing nodes. If the coordinates match the current point, 
		// return the existing point.
		// If they don't match any of them, return the provided point.
		for (i = 0, j = nodes.length; i < j; i += 1) {
			pt = nodes[i];
			
			// If both points have an id, use that.
			if(target.hasOwnProperty("id") && pt.hasOwnProperty("id")) {
				if(pt.id === target.id)	{
					return [true,pt];
				}
			}
			
			// No id? Use latLng.
			if (pt.lat === target.lat && pt.lng === target.lng) {
				return [true,pt];
			}
		}
		
		return [false,target]; // No match! Return target.
	}
    
    /**
     * 
     */
    function addNode(node) {
		var xy, foundPt;
		
		// Add xy coords if pt doesn't have them
		if(!node.x || !node.y){
			xy = Flox.latLngToLayerPt([node.lat, node.lng]);
			node.x = xy.x;
			node.y = xy.y;
		}

		if(findPoint(node)[0]===false) {
			nodes.push(node);
		}
		
		// if(!node.id) {
			// console.log("node doesn't have an id! can't be added to nodesMap")
		// } else {
			// nodesMap.set(node.id, node);
		// }
		//updateCachedValues();
    }
    
    // FIXME this is usually sorting a lot of flows. It needs to not block 
    // the UI! There are ways of doing this. Maybe pass to worker. 
    /**
     * Sort flows by value in descending order, unless ascending === true.
     */
    function sortFlows(ascending) {
		var i;
		if(ascending === true) {
			flows.sort(function(a,b) {
				return a.getValue() - b.getValue();
			});
		} else {
			flows.sort(function(a,b) {
				return b.getValue() - a.getValue();
			});
		}
    }
    
	/**
	 * Finds opposing flow in the model if there is one.
	 * Assigns it as a property of flow, and assigns flow as a property
	 * off the opposing flow.
	 * TODO Assumes there could only be one opposing flow in the model.
	 * Also, this might be dumb and bad. 
	 */
	function assignOppositeFlow(flow) {
		var candidates, i, j;
		
		// Make sure this flow doesn't already have an opposingFlow.
		if(!flow.hasOwnProperty("oppositeFlow")) {
			// Look at the outgoing flows of the endpoint.
			candidates = flow.getEndPt().outgoingFlows;
			
			for(i = 0, j = candidates.length; i < j; i += 1) {
				// Make sure candidate doesn't already have an opposing flow
				if(!candidates[i].hasOwnProperty("opposingFlow")) {
					// If the end point of candidate is same as start point
					// of flow
					if((candidates[i].getEndPt()) === (flow.getStartPt())) {
						// this candidate is an opposing flow.
						flow.oppositeFlow = candidates[i];
						candidates[i].oppositeFlow = flow;
					}
				}
			}
		}
    }
    
	function addFlow(flow){
		// Check to see if the points exist already.
		var startPoint = findPoint(flow.getStartPt())[1],
			endPoint = findPoint(flow.getEndPt())[1];
		// If they do, have the flows refer to THOSE instead of their duplicates.
		addNode(startPoint);
        addNode(endPoint);
		flow.setStartPt(startPoint);
		flow.setEndPt(endPoint);
        flows.push(flow);
        
        // If the start and end points don't have incomingFlows and 
		// outgoingFlows as properties, add them here. 
		// TODO repeated again in addFlows
		if(!startPoint.hasOwnProperty("outgoingFlows")) {
			startPoint.outgoingFlows = [];
		}
		if(!startPoint.hasOwnProperty("incomingFlows")) {
			startPoint.incomingFlows = [];
		}
		if(!endPoint.hasOwnProperty("outgoingFlows")) {
			endPoint.outgoingFlows = [];
		}
		if(!endPoint.hasOwnProperty("incomingFlows")) {
			endPoint.incomingFlows = [];
		}
        startPoint.outgoingFlows.push(flow);
        endPoint.incomingFlows.push(flow);
        
        //updateCachedValues();
    }
    
    
    
	// Add multiple flows to the existing flows.
	function addFlows (newFlows) {
		var startPoint,
			endPoint,
			flow,
			i, j;
			
		for( i= 0, j = newFlows.length; i < j; i += 1) {
			flow = newFlows[i];
			
			// if the node has an id
			
			startPoint = findPoint(flow.getStartPt());
			endPoint = findPoint(flow.getEndPt());
			flow.setStartPt(startPoint[1]);
			flow.setEndPt(endPoint[1]);
			
			// The point is verified to not currently exist in nodes.
			// You can safely push it into nodes without fear of duplication.
			// It might not have xy though? You should make sure it has xy elsewhere. 
			if(startPoint[0]===false) {
				nodes.push(startPoint[1]);
			}
			if(endPoint[0]===false) {
				nodes.push(endPoint[1]);
			}
						
	        flows.push(flow);
	        
			// If the start and end points don't have incomingFlows and 
			// outgoingFlows as properties, add them here. 
			// This is needed after copying the model. 
			if(!startPoint[1].hasOwnProperty("outgoingFlows")) {
				startPoint[1].outgoingFlows = [];
			}
			if(!startPoint[1].hasOwnProperty("incomingFlows")) {
				startPoint[1].incomingFlows = [];
			}
			if(!endPoint[1].hasOwnProperty("outgoingFlows")) {
				endPoint[1].outgoingFlows = [];
			}
			if(!endPoint[1].hasOwnProperty("incomingFlows")) {
				endPoint[1].incomingFlows = [];
			}
	        startPoint[1].outgoingFlows.push(flow);
	        endPoint[1].incomingFlows.push(flow);
	        
	        assignOppositeFlow(flow);
		}
	    //updateCachedValues();
    }
    
	function deletePoint(pt) {
		// delete flows that are connected to pt
		// First figure out which flows don't have pt in it
		var flowsNotContainingPt = [],
			i, j, index;
		for (i = 0, j = flows.length; i < j; i += 1) {
			if(flows[i].getStartPt()!==pt && flows[i].getEndPt()!==pt) {
				flowsNotContainingPt.push(flows[i]);
			}
		}
		
		// Set flows to the array of flows not containing pt. 
		flows = flowsNotContainingPt;
		
		// FIXME There is still more than one of each point sometimes.
		// TODO is there a polyfill for indexOf()?
		
		// Remove pt from the nodes array.
		index = nodes.indexOf(pt);
		if (index > -1) {
			nodes.splice(index, 1);
		}
		updateCachedValues();
	}


// END STUFF FROM GRAPH ============================

	/**
     * This value is called deCasteljauTol in java Flox. 
     * I don't know why I changed it. I should change it back.
     * Why do I keep doing this?
     * TODO
     */
    function getFlowPointGap() {
        // Get longest and shortest flow baseline lengths
        
        // FIXME this is all goofy, needs updated to worked with cashed values
        var flowLengthMinMax = getMinMaxFlowLength(),
			longestFlowLength = flowLengthMinMax.max,
			shortestFlowLength = flowLengthMinMax.min,
			tol = shortestFlowLength/(settings.maxFlowPoints+1);

        // FIXME Not sure why this conditional statement is used. 
        // When would the first condition ever be true? 
        if (longestFlowLength / tol <= settings.maxFlowPoints+1) {
            return tol;
        } 
        return longestFlowLength / (settings.maxFlowPoints+1);
    }

	function getNodeRadius (node) {
		var nodeVal = node.value,
			maxNodeArea = Math.PI * (settings.maxNodeRadius * settings.maxNodeRadius),
			ratio, 
			area,
			radius;
		
		if(node.necklaceMapNode) {
			return node.r + node.strokeWidth;
		}
		
		if(node.hasOwnProperty("r")) {
			return node.r * settings.scaleMultiplier;
		}
		
		if (settings.maxNodeValue === 0) { // There are not nodes yet
			ratio = maxNodeArea;
		} else {
			ratio = maxNodeArea / settings.maxNodeValue;
		}
		
		// The area of node will be its value times the ratio
		area = Math.abs(nodeVal * ratio);
		
		// Need the radius to draw the point tho
		radius = Math.sqrt(area / Math.PI);
		return radius * settings.scaleMultiplier;
	}

	function getStartClipRadius(startNode) {
		var startNodeRadius = getNodeRadius(startNode) + (settings.NODE_STROKE_WIDTH/2);
		return settings.flowDistanceFromStartPointPixel + startNodeRadius;
			
	}

	function getEndClipRadius(endNode) {
		var endNodeRadius = getNodeRadius(endNode) + (settings.NODE_STROKE_WIDTH/2);
		return settings.flowDistanceFromEndPointPixel + endNodeRadius;
	}

	function getFlowStrokeWidth(flow) {
		var strokeWidth;
		if(settings.useGlobalFlowWidth) {
			strokeWidth =  (settings.maxFlowWidth * flow.getValue()) / settings.maxFlowValue;
			return strokeWidth * settings.scaleMultiplier;
		}
		strokeWidth =  (settings.maxFlowWidth * flow.getValue()) / flows[0].getValue();
		return strokeWidth * settings.scaleMultiplier;
	}

	// TODO Might be able to just pass the flow the model's settings instead
	// of passing the model a flow. ALSO, this adds endClipRadius to the 
	// settings, which is kinda bad. FIXME.
	function getArrowSettings(flow) {
		var arrowSettings,
			i, j,
			minFlowWidth,
			maxFlowValue,
			endClipRadius, startClipRadius, endPt, startPt;
		
		endPt = flow.getEndPt();
		startPt = flow.getStartPt();
		
		if(settings.useGlobalFlowWidth) {
			minFlowWidth = (settings.maxFlowWidth * settings.minFlowValue / settings.maxFlowValue);
		} else {
			minFlowWidth = (settings.maxFlowWidth * flows[flows.length-1].getValue() / flows[0].getValue());
		}
		
		
		if(endPt.necklaceMapNode) {
			endClipRadius = endPt.r + endPt.strokeWidth;
		} else {
			endClipRadius = getEndClipRadius(endPt);	
		}
		
		if(startPt.necklaceMapNode) {
			startClipRadius = startPt.r + startPt.strokeWidth;
		} else {
			startClipRadius = getStartClipRadius(startPt);	
		}
		
		if(settings.useGlobalFlowWidth) {
			maxFlowValue = settings.maxFlowValue;
		} else {
			maxFlowValue = flows[0].getValue();
		}
		
		arrowSettings = {
			endClipRadius: endClipRadius,
			startClipRadius: startClipRadius,
			minFlowWidth: minFlowWidth,
			maxFlowValue: maxFlowValue,
			maxFlowWidth: settings.maxFlowWidth,
			scaleMultiplier: settings.scaleMultiplier,
			arrowSizeRatio: settings.arrowSizeRatio,
			arrowLengthRatio: settings.arrowLengthRatio,
			arrowLengthScaleFactor: settings.arrowLengthScaleFactor,
			arrowWidthScaleFactor: settings.arrowWidthScaleFactor,
			arrowCornerPosition: settings.arrowCornerPosition,
			arrowEdgeCtrlWidth: settings.arrowEdgeCtrlWidth,
			arrowEdgeCtrlLength: settings.arrowEdgeCtrlLength
		};
		return arrowSettings;	
	}

	// configure arrows for flows 
	function configureArrows() {
		var i, j, arrowSettings;
		for(i = 0, j = flows.length; i < j; i += 1) {
			arrowSettings = getArrowSettings(flows[i]);
			flows[i].configureArrow(arrowSettings);	
		}
	}

	function deselectAllFeatures() {
		var i, j, flow, node;
		
		for (i = 0, j = flows.length; i < j; i += 1) {
			flows[i].setSelected(false);
		}
		for (i = 0, j = nodes.length; i < j; i += 1) {
			nodes[i].selected = false;
		}
		Flox.updateTextBoxes();
	}

	/**
	 * @param {Object} settings key: value pairs of Model parameters.
	 */
	function updateSettings(newSettings) {
		// FIXME loop over settings to prevent setting deletion
		settings = newSettings;
		my.settings = newSettings;
	}
	
	function findNodeByID(id) {
		var i, j;

		// Loop through the nodes.
		// If node.id matches id, return the node!
		for ( i = 0, j = nodes.length; i < j; i += 1) {
			if (nodes[i].id === id) {
				return nodes[i];
			}
		}
		//console.log("It's not in there!");
		return false;
		// It's not in there!
		
	}

	function getRelativeFlowValue(flow) {
		if(settings.useGlobalFlowWidth) {
			return (flow.getValue() - settings.minFlowValue)
                / (settings.maxFlowValue - settings.minFlowValue);
		}
		return (flow.getValue() - flows[flows.length-1].getValue())
            / (flows[0].getValue() - flows[flows.length-1].getValue());
	}

	function getFlowColor(flow) {
		var w = getRelativeFlowValue(flow);
		return Flox.ColorUtils.blend(minFlowColor, maxFlowColor, w);
	}

// PUBLIC ======================================================================
	
	my.getRelativeFlowValue = function(flow) {
		return getRelativeFlowValue(flow);
	};
	
	my.getNodeRadius = function (node) {
		return getNodeRadius(node);
	};
	
	my.getFlowStrokeWidth = function(flow) {
		return getFlowStrokeWidth(flow);
	};
	
	/**
	 * Cashe line segments of filtered flows.
	 */
	my.cacheAllFlowLineSegments = function () {
		var gap = getFlowPointGap(),
			flow,
			rs, re,
			i, j;
		
        for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			rs = settings.flowDistanceFromStartPointPixel > 0 ? getStartClipRadius(flow.getStartPt()) : 0;
			re = settings.flowDistanceFromEndPointPixel > 0 ? getEndClipRadius(flow.getEndPt()) : 0;
			flow.cacheClippedLineSegments(rs, re, gap);
        }
	};


	// FIXME only cashes maxFlows bounding boxes
	my.cacheAllFlowBoundingBoxes = function() {
		// console.log("caching flow bounding boxes!");
		var flow, i, j;
		for(i = 0, j = flows.length; i < j; i += 1) {
			flows[i].cacheBoundingBox();
		}
	};

	

	// Convert the nodes into json readable by the editableTable.js library
	/**
	 * @param editable Boolean determining whether the table is editable.
	 */
	my.getNodeTable = function (editable) {
		var data = [],
			metadata = [],
			i, j, node;
			
		metadata.push({ 
			name: "id", 
			label: "ID", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "lat", 
			label: "LAT", 
			datatype: "double", 
			editable: true});
		metadata.push({ 
			name: "lng", 
			label: "LNG", 
			datatype: "double", 
			editable: true});
		metadata.push({ 
			name: "value", 
			label: "VALUE", 
			datatype: "double", 
			decimal_point: '.',
			thousands_separator: ',',
			editable: true});
		metadata.push({ 
			name: "action", 
			label: " ", 
			datatype: "html", 
			editable: false});
			
			
		for (i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			if(!node.id) {
				node.id = i;
			}
			data.push({
				id: node.id,
				values: {
					"id": node.id,
					"lat": node.lat,
					"lng": node.lng,
					"value": node.value
				}
			});
		}
		return {"metadata": metadata, "data": data};
	};

	my.getFlowTable = function () {
		var data = [],
			metadata = [],
			i, j, flow;
			
		metadata.push({ 
			name: "id", 
			label: "ID", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "start", 
			label: "START", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "end", 
			label: "END", 
			datatype: "string", 
			editable: false});
		metadata.push({ 
			name: "value", 
			label: "VALUE", 
			datatype: "double", 
			decimal_point: '.',
			thousands_separator: ',',
			editable: true});
		metadata.push({ 
			name: "action", 
			label: " ", 
			datatype: "html", 
			editable: false});
			
		for (i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			if(isNaN(flow.getId())) {
				flow.setId(i);
			}
			data.push({
				id: flow.getId(),
				values: {
					"id": flow.getId(),
					"start": flow.getStartPt().id,
					"end": flow.getEndPt().id,
					"value": flow.getValue()
				}
			});
		}
		
		
		return {"metadata": metadata, "data": data};
	};
	
	my.getLocks = function() {
		var locks = [],
			i, j;
		for(i=0, j = flows.length; i < j; i += 1) {
			locks.push(flows[i].isLocked());
		}
		return locks;
	};
	
	my.applyLocks = function(locks) {
		var i, j;
		if(flows.length === locks.length) {
			for(i = 0, j = locks.length; i < j; i += 1) {
				flows[i].setLocked(locks[i]);
			}
		} else {
			console.log("Flows and locks have different lengths");
		}
	};
    
    my.getNbrFlows = function() {
       return flows.length;
    };

	my.getAllNodes = function() {
		return nodes;
	};

    my.getPoints = function() {
        //return nodes; 
        // if(Array.from(nodesMap.values()).length > 0) {
			// return Array.from(nodesMap.values())
        // }
        // this only happens if nodes don't have an id parameter.
		return nodes;
    };

    my.addFlow = function(flow) {
        addFlow(flow);
    };

    // Add multiple flows 
    my.addFlows = function(newFlows) {
        addFlows(newFlows);
    };

    // return all flows
    my.getFlows = function() {
        return flows;
    };

	// Return all flows
	my.getAllFlows = function() {
		return flows;
	};

    // Get the control points of all filtered flows
    my.getCtrlPts = function() {
        var ctrlPts = [],
			i, j;
        for(i=0, j = flows.length; i < j; i += 1) {
            ctrlPts.push(flows[i].getCtrlPt());
        }
        return ctrlPts;
    };

    // Delete all flows from the model.
    my.deleteAllFlows = function() {
        flows = [];
        nodes = [];
        //updateCachedValues();
    };

	my.deletePoint = function(pt) {
		deletePoint(pt);
	};

	my.getMinMaxFlowLength = function() {
		return getMinMaxFlowLength();
	};

	my.updateCachedValues = function() {
		updateCachedValues();
	};

	my.getStartClipRadius = function (startNode) {
	return getStartClipRadius(startNode);
	};
	
	my.getEndClipRadius = function (endNode) {
		return getEndClipRadius(endNode);
	};

	my.configureArrows = function() {
		configureArrows();
	};
	
	/**
	 * Returns an empty array if arrows aren't being drawn.
	 */
	my.getArrows = function() {
		var i, arrow,
			arrows = [];
		if(settings.drawArrows) {
			for(i = 0; i < flows.length; i += 1) {
				if(flows[i].getArrow()) {
					arrows.push(flows[i].getArrow());
				}
			}
			
		}
		return arrows;
	};

	my.deselectAllFeatures = function() {
		deselectAllFeatures();
	};


	// Sort flows by value in descending order, unless otherwise specified.
	my.sortFlows = function (ascending) {
		sortFlows(ascending);
	};

	/**
	 * Assumes flows are already sorted
	 * If n is specified, returns that many flows.
	 * Otherwise, returns the number of flows equal to maxFlows
	 */
	my.getLargestFlows = function(n) {
		if(n){
			return flows.slice(0,n);
		}
		return flows.slice(0, settings.maxFlows);
	};

	my.getSelectedFlows = function () {
		var i, j, selectedFlows = [];
		
		for(i = 0, j = flows.length; i < j; i += 1) {
			if (flows[i].isSelected()) {
				selectedFlows.push(flows[i]); 
			}
		}
		return selectedFlows;
	};

	my.getSelectedNodes = function () {
		var i, j, selectedNodes = [];
		
		for(i = 0, j = nodes.length; i < j; i += 1) {
			if (nodes[i].selected) {
				selectedNodes.push(nodes[i]); 
			}
		}
		return selectedNodes;
	};
	
	my.setScaleMultiplierByState = function(stateFIPS) {
		var stateString = "FIPS" + stateFIPS;
		if(stateScales.hasOwnProperty(stateString)) {
			settings.scaleMultiplier = stateScales[stateString];
		} else {
			settings.scaleMultiplier = 1;
		}
	};
	
	/**
	 * 
 * @param {Object} settings Key: value pairs of FloxModel parameters, 
 * e.g. maxFlowPoints: 20
	 */
	my.updateSettings = function(settings) {
		// TODO Can probably delete this function
		updateSettings(settings);
	};

	/**
	 * Return the node with the matching id.
	 * Return null if no such node exists.
	 */
	my.findNodeByID = function(id) {
		return findNodeByID(id);
	};

	/**
	 * Add multiple nodes to the model
 * @param {Array} nodes - The nodes to add. 
	 */
	my.addNodes = function(newNodes) {
		// If the node isn't already in the model, add it.
		var i, j;
		
		for(i = 0, j = newNodes.length; i < j; i += 1) {
			addNode(newNodes[i]);
		}
	};

	/**
	 * Deletes existing nodes and flows, sets nodes to newNodes.
 * @param {Array} newNodes - Nodes to add. 
	 */
	my.initNodes = function(newNodes) {
		
		var node, i;
		
		flows = [];
		nodes = newNodes;
		
		// for(i = 0; i < nodes.length; i += 1) {
			// nodesMap.set(nodes[i].id, nodes[i]);
		// }
	};

	my.getArrowSettings = function(flow) {
		return getArrowSettings(flow);
	};

	// TODO probably don't need to update minFlowWidth here.
	my.getGlobalArrowSettings = function() {
		var i, j,
			minFlowWidth = (settings.maxFlowWidth * settings.minFlowValue / settings.maxFlowValue);
		
		settings.minFlowWidth = minFlowWidth;
		
		return settings;
	};

	my.toJSON = function(){
		
		var JSON = {
				flows: [],
				nodes: []
		    },

			i, j, flow, node, sPt, ePt, cPt, val, nodeCopy, prop;
		
		JSON.settings = settings;
		
		for(i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			nodeCopy = {};
			
			for (prop in node) {
			    if (node.hasOwnProperty(prop)
			        && prop !== "incomingFlows"
			        && prop !== "outgoingFlows") {
			        nodeCopy[prop] = node[prop];
			    }
			}
			JSON.nodes.push(nodeCopy);
		}
		
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			sPt = flow.getStartPt();
			ePt = flow.getEndPt();
			cPt = flow.getCtrlPt();
			
			JSON.flows.push(
				{
					startPt: 
						{
							x: sPt.x,
							y: sPt.y,
							lat: sPt.lat,
							lng: sPt.lng,
							id: sPt.id
							
						},
					endPt: 
						{
							x: ePt.x, 
							y: ePt.y,
							lat: ePt.lat,
							lng: ePt.lng,
							id: ePt.id
						},
					cPt:
						{
							x: cPt.x,
							y: cPt.y
						},
					value: flow.getValue(),
					
					AtoB: flow.AtoB,
					BtoA: flow.BtoA
				}
			);
		}
		return JSON;
	};

	my.deserializeModelJSON = function(modelJSON) {
		// What did we pass this thing again?
		var flowData = modelJSON.flows,
			newFlows = [],
			flow, i, j, sPt, ePt, cPt;
		
		// Assign new xy coordinates to the nodes.	
		nodes = modelJSON.nodes;
		
		// Delete this model's flows and nodes
		//my.deleteAllFlows();		
		
		// Build flows out of flowData
		for(i = 0, j = flowData.length; i < j; i += 1) {
			sPt = flowData[i].startPt;
			ePt = flowData[i].endPt;
			cPt = flowData[i].cPt;
			flow = new Flox.Flow(sPt, ePt, flowData[i].value);
			flow.setCtrlPt(cPt);
			flow.AtoB = flowData[i].AtoB;
			flow.BtoA = flowData[i].BtoA;
			newFlows.push(flow);
		}
		addFlows(newFlows);
		updateSettings(modelJSON.settings);
	};
	
	my.stringifyModel = function() {
		var modelJSON = my.toJSON(),
			modelJSONString = JSON.stringify(modelJSON);
		console.log(modelJSONString);
	};
	
	my.getFlowColor = function(flow) {
		return getFlowColor(flow);
	};
	
	my.settings = settings;
	
	return my;
};


















