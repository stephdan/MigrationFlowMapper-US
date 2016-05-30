// Stores the data and settings
// Returns information about the data and settings.
Flox.Model = function() {
	
	"use strict";
	
		// Points and flows
	var nodes = [],
		flows = [],
	
		nodesMap = new Map(),
	
		// Layout Settings
		maxFlowPoints = 20,
		distanceWeightExponent = 3,
		peripheralStiffnessFactor = 0.1,
		
		maxFlowLengthSpringConstant = 0.05,
		minFlowLengthSpringConstant = 0.5,
		
		enforceRangebox = true,
		flowRangeboxHeight = 0.4,
		antiTorsionWeight = 0.8,
		angularDistributionWeight = 0.5,
		nodeWeight = 0.0,
		nodeTolerancePx = 0,
		moveFlowsIntersectingNodes = true,
		multipleIterations = true,
		NBR_ITERATIONS = 100,
		showForceAnimation = false,
		FLOW_DISTANCE_THRESHOLD = 0.00000001, // TODO what should this be??
		checkFlowBoundingBoxes = true,
		maxFlows = 50,
		useNetFlows = false,
		mapScale = 0.5,
		
		// Map Appearance Settings
		maxFlowWidth = 30,
		maxNodeRadius = 10,
		isShowLockedFlows = true,
		flowDistanceFromStartPointPixel = 5,
		flowDistanceFromEndPointPixel = 5,
		NODE_STROKE_WIDTH = 0.5,
		
		// arrow settings
		// TODO Add arrowstuff to settings export and Flox.initGUI
		arrowSizeRatio = 0.1,
		arrowLengthRatio = 0.2,
		arrowLengthScaleFactor = 1.6,
		arrowWidthScaleFactor = 0.8,
		arrowEdgeCtrlLength = 0.5,
		arrowEdgeCtrlWidth = 0.5,
		arrowCornerPosition = 0.0,
		pointArrowTowardsEndpoint = true,
		
		// cached values cached by updateCachedValues()
		minFlowValue,
		maxFlowValue,
		meanFlowValue, // used for anything? Adding flows during editing?
		minFlowLength,
		maxFlowLength,
		minNodeValue,
		maxNodeValue,
		meanNodeValue,	
		
		// Draw Settings
		drawFlows = true,
		drawNodes = false,
		drawArrows = true,
		drawControlPoints = false,
		drawIntermediateFlowPoints = false,
		drawRangeboxes = false,
				
		datasetName = null,

		// A list of appropriate scales for different US states. 
		// FIXME this is problematic, and very hard-coded. There is probably
		// a way to handle this more responsively. 
		// Not really a setting. Doesn't get passed in to the layoutWorker. 
		// TODO The layouter might care about the scale in order to help
		// determine an appropriate distance flows should be moved off nodes. 
		stateScales = {
			"FIPS1"  : 1, // Alabama
			"FIPS48" : 2, // Texas
			"FIPS54" : 1,  // West Virginia
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
		    
		var i, j, flow, l;

		minFlowLength = Infinity;
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
		return {min: minFlowLength, max: maxFlowLength};
    }

	
	// Updates the cached values. These values
	// are used for drawing and layouts, which only care about the flows being
	// shown.
	function updateCachedValues() {
		
		if (flows.length < 1) {
			minFlowValue = 0;
			maxFlowValue = 0;
		} else {
			minFlowValue = maxFlowValue = flows[0].getValue();
		}

		var flowSum = 0,
		    flowCounter = 0,
		    nodeSum = 0,
			nodeCounter = 0,
			i, j, v, flow, l;
		    
		minFlowLength = Infinity;
		maxFlowLength = 0;

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
    }
    
    
    /**
     * If the target node exists in nodes already, return the existing node.
     * Otherwise, return the target node.
     */
    function findPoint(target) {

		var i, j, pt;

		// If the target has an id, get it from the nodesMap. It should be in 
		// the nodes map.
		if(target.hasOwnProperty("id")) {
			// If it is in the nodesMap, get it
			if(nodesMap.get(target.id)) {
				return [true, nodesMap.get(target.id)];
			} // if its not in the nodes map...either none of the existing nodes
			  // have ids, or it was never added.
		}
		
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
		
		if(!node.id) {
			console.log("node doesn't have an id! can't be added to nodesMap")
		} else {
			nodesMap.set(node.id, node);
		}
		//updateCachedValues();
    }
    
    // FIXME this is usually sorting a lot of flows. It needs to not block 
    // the UI! There are ways of doing this. Maybe pass to worker. 
    /**
     * Sort flows by value in descending order, unless ascending === true.
     */
    function sortFlows(ascending) {
		
		console.log("sorting flows...");
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
		console.log("done sorting flows");
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
			tol = shortestFlowLength/(maxFlowPoints+1);

        // FIXME Not sure why this conditional statement is used. 
        // When would the first condition ever be true? 
        if (longestFlowLength / tol <= maxFlowPoints+1) {
            return tol;
        } 
        return longestFlowLength / (maxFlowPoints+1);
    }

	function getNodeRadius (node) {
		var nodeVal = node.value,
			maxNodeArea = Math.PI * (maxNodeRadius * maxNodeRadius),
			ratio, 
			area,
			radius;
			
		if (!maxNodeValue) { // There are not nodes yet
			ratio = maxNodeArea;
		} else {
			ratio = maxNodeArea / maxNodeValue;
		}
		
		// The area of node will be its value times the ratio
		area = Math.abs(nodeVal * ratio);
		
		// Need the radius to draw the point tho
		radius = Math.sqrt(area / Math.PI);
		return radius * mapScale;
	}

	function getStartClipRadius(startNode) {
		var startNodeRadius = getNodeRadius(startNode) + (NODE_STROKE_WIDTH/2);
		return flowDistanceFromStartPointPixel + startNodeRadius;
			
	}

	function getEndClipRadius(endNode) {
		var endNodeRadius = getNodeRadius(endNode) + (NODE_STROKE_WIDTH/2);
		return flowDistanceFromEndPointPixel + endNodeRadius;
	}

	function getFlowStrokeWidth(flow) {
		var strokeWidth =  (maxFlowWidth * flow.getValue()) / maxFlowValue;
		return strokeWidth * mapScale;
	}

	function getArrowSettings(flow) {
		var arrowSettings,
			i, j,
			minFlowWidth = (maxFlowWidth * minFlowValue / maxFlowValue),
			endClipRadius, startClipRadius, endPt, startPt;
		
		endPt = flow.getEndPt();
		startPt = flow.getStartPt();
		
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
		
		return {
			endClipRadius: endClipRadius,
			minFlowWidth: minFlowWidth,
			maxFlowWidth: maxFlowWidth,
			maxFlowValue: maxFlowValue,
			arrowSizeRatio: arrowSizeRatio,
			arrowLengthRatio: arrowLengthRatio,
			arrowLengthScaleFactor: arrowLengthScaleFactor,
			arrowWidthScaleFactor: arrowWidthScaleFactor,
			arrowCornerPosition: arrowCornerPosition,
			pointArrowTowardsEndpoint: pointArrowTowardsEndpoint,
			arrowEdgeCtrlLength: arrowEdgeCtrlLength,
			arrowEdgeCtrlWidth: arrowEdgeCtrlWidth,
			mapScale: mapScale
		};	
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
	 function updateSettings(settings) {
		
		// Layout Settings
		maxFlowPoints = settings.maxFlowPoints;
		distanceWeightExponent = settings.distanceWeightExponent;
		peripheralStiffnessFactor = settings.peripheralStiffnessFactor;
		maxFlowLengthSpringConstant = settings.maxFlowLengthSpringConstant;
		minFlowLengthSpringConstant = settings.minFlowLengthSpringConstant;
		enforceRangebox = settings.enforceRangebox;
		flowRangeboxHeight = settings.flowRangeboxHeight;
		antiTorsionWeight = settings.antiTorsionWeight;
		angularDistributionWeight = settings.angularDistributionWeight;
		nodeWeight = settings.nodeWeight;
		nodeTolerancePx = settings.nodeTolerancePx;
		moveFlowsIntersectingNodes = settings.moveFlowsIntersectingNodes;
		multipleIterations = settings.multipleIterations;
		NBR_ITERATIONS = settings.NBR_ITERATIONS;
		showForceAnimation = settings.showForceAnimation;
		FLOW_DISTANCE_THRESHOLD = settings.FLOW_DISTANCE_THRESHOLD;
		checkFlowBoundingBoxes = settings.checkFlowBoundingBoxes;
		maxFlows = settings.maxFlows;
		mapScale = settings.mapScale;
		
		// Map Appearance Settings
		maxFlowWidth = settings.maxFlowWidth;
		maxNodeRadius = settings.maxNodeRadius;
		isShowLockedFlows = settings.isShowLockedFlows;
		flowDistanceFromStartPointPixel = settings.flowDistanceFromStartPointPixel;
		flowDistanceFromEndPointPixel = settings.flowDistanceFromEndPointPixel;
		NODE_STROKE_WIDTH = settings.NODE_STROKE_WIDTH;
		datasetName = settings.datasetName;
		
		drawFlows = settings.drawFlows;
		drawNodes = settings.drawNodes;
		drawArrows = settings.drawArrows;
		drawControlPoints = settings.drawControlPoints;
		drawIntermediateFlowPoints = settings.drawIntermediateFlowPoints;
		drawRangeboxes = settings.drawRangeboxes;
		
		minFlowValue = settings.minFlowValue;
		maxFlowValue = settings.maxFlowValue;
		meanFlowValue = settings.meanFlowValue; // used for anything? Adding flows during editing?
		minFlowLength = settings.minFlowLength;
		maxFlowLength = settings. maxFlowLength;
		minNodeValue = settings.minNodeValue;
		maxNodeValue = settings.maxNodeValue;
		meanNodeValue = settings.meanNodeValue;
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

// PUBLIC ======================================================================
	
	
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
			rs = flowDistanceFromStartPointPixel > 0 ? getStartClipRadius(flow.getStartPt()) : 0;
			re = flowDistanceFromEndPointPixel > 0 ? getEndClipRadius(flow.getEndPt()) : 0;
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

	my.setNodeWeight = function (d) {
		nodeWeight = d;
	};

	my.getFlowDistanceFromEndPointPixel = function() {
		return flowDistanceFromEndPointPx;
	};
	
	my.getFlowDistanceFromStartPointPixel = function() {
		return flowDistanceFromStartPointPx;
	};

	my.getNodeStrokeWidth = function() {
		return NODE_STROKE_WIDTH;
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
	
	my.isMultipleIterations = function() {
		return multipleIterations;
	};
	
	my.setMultipleIterations = function(boo) {
		multipleIterations = boo;
	};

	my.isMoveFlowsIntersectingNodes = function() {
		return moveFlowsIntersectingNodes;
	};

	my.setMoveFlowsIntersectingNodes = function(boo) {
		moveFlowsIntersectingNodes = boo;
	};

    my.getAngularDistributionWeight =  function() {
        return angularDistributionWeight;
    };

    
    my.getNbrFlows = function() {
       return flows.length;
    };

    my.getAntiTorsionWeight = function() {
        return antiTorsionWeight;
    };
    
    my.setAntiTorsionWeight = function(d) {
		antiTorsionWeight = d;
    };

    my.getMaxFlowWidth = function () {
        return maxFlowWidth;
    };

	my.getMaxNodeRadius = function() {
		return maxNodeRadius;
	};

	my.setMaxNodeRadius = function(d) {
		maxNodeRadius = d;
	};

    my.setMaxFlowWidth = function (maxWidth) {
        maxFlowWidth = maxWidth;
    };

	my.getAllNodes = function() {
		return nodes;
	};

    my.getPoints = function() {
        //return nodes; 
        if(Array.from(nodesMap.values()).length > 0) {
			console.log("getting points from nodesMap")
			return Array.from(nodesMap.values())
        }
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
        updateCachedValues();
    };

    my.getMaxFlowPoints = function() {
        return maxFlowPoints;
    };

    my.setMaxFlowPoints = function(d) {
        maxFlowPoints = d;
    };

    my.getDistanceWeightExponent = function() {
        return distanceWeightExponent;
    };

    my.setDistanceWeightExponent = function(d) {
        distanceWeightExponent = d;
    };

    my.setMaxFlowLengthSpringConstant = function(d) {
        maxFlowLengthSpringConstant = d;
    };

    my.setMinFlowLengthSpringConstant = function(d) {
        minFlowLengthSpringConstant = d;
    };

    my.setAngularDistributionWeight = function(d) {
        angularDistributionWeight = d;
    };

    my.setPeripheralStiffnessFactor = function(d) {
        peripheralStiffnessFactor = d;
    };

    my.getPeripheralStiffnessFactor = function() {
        return peripheralStiffnessFactor;
    };

    my.getMinFlowLengthSpringConstant = function() {
        return minFlowLengthSpringConstant;
    };

    my.getMaxFlowLengthSpringConstant = function() {
        return maxFlowLengthSpringConstant;
    };

    my.isEnforceRangebox = function() {
        return enforceRangebox;
    };

    my.setEnforceRangebox = function(bool) {
        enforceRangebox = bool;
    };

    my.getFlowRangeboxHeight = function() {
        return flowRangeboxHeight;
    };

    my.setFlowRangeboxHeight = function(val) {
        flowRangeboxHeight = val;
    };

	my.deletePoint = function(pt) {
		deletePoint(pt);
	};
	
	my.getNodeWeight = function() {
		return nodeWeight;
	};
	
	my.getNodeTolerancePx = function() {
		return nodeTolerancePx;
	};
	
	my.setNodeTolerancePx = function(d) {
		nodeTolerancePx = d;
	};
	
	my.getMinFlowValue = function() {
		return minFlowValue;
	};
	
	my.getMaxFlowValue = function() {
		return maxFlowValue;
	};
	
	my.setMaxFlowValue = function(d) {
		maxFlowValue = (d);
	};
	
	my.getMeanFlowValue = function() {
		return meanFlowValue;
	};
	
	my.getMinFlowLength = function() {
		return minFlowLength;
	};
	
	my.getMaxFlowLength = function() {
		return maxFlowLength;
	};
	
	my.getMinNodeValue = function() {
		return minNodeValue;
	};
	
	my.getMaxNodeValue = function() {
		return maxNodeValue;
	};
	
	my.getMeanNodeValue = function() {
		return meanNodeValue;
	};
	
	my.isShowLockedFlows = function() {
		return isShowLockedFlows;
	};

	my.getMinMaxFlowLength = function() {
		return getMinMaxFlowLength();
	};

	my.getIterations = function () {
		return NBR_ITERATIONS;
	};

	my.updateCachedValues = function() {
		updateCachedValues();
	};

	my.isShowForceAnimation = function () {
		return showForceAnimation;
	};
	
	my.setShowForceAnimation = function (boo) {
		showForceAnimation = boo;
	};

	my.getFlowDistanceThreshold = function() {
		return FLOW_DISTANCE_THRESHOLD;
	};

	my.getFlowDistanceFromStartPointPixel = function() {
		return flowDistanceFromStartPointPixel;
	};
	
	my.setFlowDistanceFromStartPointPixel = function (d) {
		flowDistanceFromStartPointPixel = d;
	};

	my.getFlowDistanceFromEndPointPixel = function() {
		return flowDistanceFromEndPointPixel;
	};
	
	my.setFlowDistanceFromEndPointPixel = function (d) {
		flowDistanceFromEndPointPixel = d;
	};

	my.getStartClipRadius = function (startNode) {
	return getStartClipRadius(startNode);
	};
	
	my.getEndClipRadius = function (endNode) {
		return getEndClipRadius(endNode);
	};

	my.isDrawArrows = function () {
		return drawArrows;
	};

	my.setDrawArrows = function (boo) {
		drawArrows = boo;
	};

	my.configureArrows = function() {
		configureArrows();
	};

	my.getArrowSizeRatio = function() {
		return arrowSizeRatio;
	};
	
	/**
	 * Returns an empty array if arrows aren't being drawn.
	 */
	my.getArrows = function() {
		var i, arrow,
			arrows = [];
		if(drawArrows) {
			for(i = 0; i < flows.length; i += 1) {
				if(flows[i].getArrow()) {
					arrows.push(flows[i].getArrow());
				}
			}
			
		}
		return arrows;
	};
	
	my.setArrowSizeRatio = function(d) {
		arrowSizeRatio = d;
	};
	
	my.getArrowLengthRatio = function(d) {
		return arrowLengthRatio;
	};
	
	my.setArrowLengthRatio = function(d) {
		arrowLengthRatio = d;
	};
	
	my.getArrowLengthScaleFactor = function() {
		return arrowLengthScaleFactor;
	};
	
	my.setArrowLengthScaleFactor = function(d) {
		arrowLengthScaleFactor = d;
	};
	
	my.getArrowWidthScaleFactor = function() {
		return arrowWidthScaleFactor;
	};
	
	my.setArrowWidthScaleFactor = function(d) {
		arrowWidthScaleFactor = d;
	};
	
	my.getArrowEdgeCtrlLength = function() {
		return arrowEdgeCtrlLength;
	};
	
	my.setArrowEdgeCtrlLength = function(d) {
		arrowEdgeCtrlLength = d;
	};
	
	my.getArrowEdgeCtrlWidth = function() {
		return arrowEdgeCtrlWidth;
	};
	
	my.setArrowEdgeCtrlWidth = function (d) {
		arrowEdgeCtrlWidth = d;
	};
	
	my.getArrowCornerPosition = function() {
		return arrowCornerPosition;
	};

	my.setArrowCornerPosition = function(d) {
		arrowCornerPosition = d;
	};
	
	my.getPointArrowTowardsEndpoint = function() {
		return pointArrowTowardsEndpoint;
	};
	
	my.setPointArrowTowardsEndpoint = function(d) {
		pointArrowTowardsEndpoint = d;
	};

	my.getDrawSettings = function () {
		return {
			drawFlows : drawFlows,
			drawNodes : drawNodes,
			drawArrows : drawArrows,
			drawControlPoints : drawControlPoints,
			drawIntermediateFlowPoints : drawIntermediateFlowPoints,
			drawRangeboxes : drawRangeboxes
		};
	};
	
	my.isDrawFlows = function() {
		return drawFlows;
	};
	my.setDrawFlows = function(boo) {
		drawFlows = boo;
	};
	my.isDrawNodes = function() {
		return drawNodes;
	};
	my.setDrawNodes = function(boo) {
		drawNodes = boo;
	};
	my.isDrawArrows = function() {
		return drawArrows;
	};
	my.setDrawArrows = function(boo) {
		drawArrows = boo;
	};
	my.isDrawControlPoints = function() {
		return drawControlPoints;
	};
	my.setDrawControlPoints = function(boo) {
		drawControlPoints = boo;
	};
	my.isDrawIntermediateFlowPoints = function() {
		return drawIntermediateFlowPoints;
	};
	my.setDrawIntermediateFlowPoints = function(boo) {
		drawIntermediateFlowPoints = boo;
	};
	my.isDrawRangeboxes = function() {
		return drawRangeboxes;
	};
	my.setDrawRangeboxes = function(boo) {
		drawRangeboxes = boo;
	};


	my.deselectAllFeatures = function() {
		deselectAllFeatures();
	};

	my.setCheckFlowBoundingBoxes = function(boo) {
		checkFlowBoundingBoxes = boo;
	};

	my.isCheckFlowBoundingBoxes = function() {
		return checkFlowBoundingBoxes;
	};

	// Sort flows by value in descending order, unless otherwise specified.
	my.sortFlows = function (ascending) {
		sortFlows(ascending);
	};

	my.getMaxFlows = function () {
		return maxFlows;
	};
	
	my.setMaxFlows = function (d) {
		setMaxFlows(d);
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
	
	my.getDrawSettings = function () {
		return {
			drawFlows: drawFlows,
			drawNodes: drawNodes,
			drawArrows: drawArrows,
			drawControlPoints: drawControlPoints,
			drawIntermediateFlowPoints: drawIntermediateFlowPoints,
			drawRangeboxes: drawRangeboxes
		};
	};
	
	my.getMapScale = function () {
		return mapScale;
	};
	
	my.setMapScale = function (d) {
		mapScale = d;
	};
	
	my.setStateMapScale = function(stateFIPS) {
		var stateString = "FIPS" + stateFIPS;
		if(stateScales.hasOwnProperty(stateString)) {
			mapScale = stateScales[stateString];
		} else {
			mapScale = 1;
		}
	};
	
	my.getStateMapScale = function(stateString) {
		return stateScales[stateString];
	};
	
	/**
	 * 
 * @param {Object} settings Key: value pairs of FloxModel parameters, 
 * e.g. maxFlowPoints: 20
	 */
	my.updateSettings = function(settings) {
		updateSettings(settings);
	};

	my.setDatasetName = function(nameString) {
		datasetName = nameString;
	};

	my.getDatasetName = function() {
		return datasetName;
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
		
		// Make a nodesMap, but only if the nodes have ids. 
		for(i = 0; i < nodes.length; i += 1) {
			if(nodes[i].hasOwnProperty("id")) {
				nodesMap.set(nodes[i].id, nodes[i]);
			}
		}
	};

	my.getArrowSettings = function(flow) {
		return getArrowSettings(flow);
	};

	my.toJSON = function(){
		
		var JSON = {
				flows: [],
				nodes: []
		    },

			i, j, flow, node, sPt, ePt, cPt, val, nodeCopy, prop;
		
		JSON.settings = {
			maxFlowPoints : maxFlowPoints,
			distanceWeightExponent : distanceWeightExponent,
			peripheralStiffnessFactor : peripheralStiffnessFactor,
			maxFlowLengthSpringConstant : maxFlowLengthSpringConstant,
			minFlowLengthSpringConstant : minFlowLengthSpringConstant,
			enforceRangebox : enforceRangebox,
			flowRangeboxHeight : flowRangeboxHeight,
			maxFlowWidth : maxFlowWidth,
			maxNodeRadius : maxNodeRadius,
			antiTorsionWeight : antiTorsionWeight,
			angularDistributionWeight : angularDistributionWeight,
			nodeWeight : nodeWeight,
			nodeTolerancePx : nodeTolerancePx,
			moveFlowsIntersectingNodes : moveFlowsIntersectingNodes,
			multipleIterations : multipleIterations,
			isShowLockedFlows : isShowLockedFlows,
			NODE_STROKE_WIDTH : NODE_STROKE_WIDTH,
			NBR_ITERATIONS: NBR_ITERATIONS,
			showForceAnimation: showForceAnimation,
			FLOW_DISTANCE_THRESHOLD : FLOW_DISTANCE_THRESHOLD,
			flowDistanceFromStartPointPixel : flowDistanceFromStartPointPixel,
			flowDistanceFromEndPointPixel : flowDistanceFromEndPointPixel,
			checkFlowBoundingBoxes: checkFlowBoundingBoxes,
			maxFlows : maxFlows,
			mapScale: mapScale,
			datasetName: datasetName,
			
			drawFlows: drawFlows,
			drawNodes: drawNodes,
			drawArrows: drawArrows,
			drawControlPoints: drawControlPoints,
			drawIntermediateFlowPoints: drawIntermediateFlowPoints,
			drawRangeboxes: drawRangeboxes,
			
			minFlowValue: minFlowValue,
			maxFlowValue: maxFlowValue,
			meanFlowValue: meanFlowValue, // used for anything? Adding flows during editing?
			minFlowLength: minFlowLength,
			maxFlowLength: maxFlowLength,
			minNodeValue: minNodeValue,
			maxNodeValue: maxNodeValue,
			meanNodeValue: meanNodeValue
		};
		
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
		
		// Add the nodes to the json. Commented out because, so far, there
		// is no use for these. The node info is in the flows. 
		// for (i = 0, j = nodes.length; i < j; i += 1) {
			// node = nodes[i];
			// JSON.nodes.push(
				// {
					// x: node.x,
					// y: node.y,
					// value: node.value
				// }
			// );
		// }
		return JSON;
	};

	my.deserializeModelJSON = function(modelJSON) {
		// What did we pass this thing again?
		var flowData = modelJSON.flows,
			newFlows = [],
			flow, i, j, sPt, ePt, cPt;
			
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
	
	return my;
};


















