// Stores the data and settings
// Returns information about the data and settings.
var FloxModel = function() {
	
	"use strict";
	
		// Points and flows
	var nodes = [],
		flows = [],
		filteredNodes = [],
		filteredFlows = [],
		netFlows = [],
		netNodes = [],
	
		// Layout Settings
		maxFlowPoints = 20,
		distanceWeightExponent = 3,
		peripheralStiffnessFactor = 0.1,
		maxFlowLengthSpringConstant = 0.05,
		minFlowLengthSpringConstant = 0.5,
		enforceRangebox = true,
		flowRangeboxHeight = 0.30,
		antiTorsionWeight = 0.8,
		angularDistributionWeight = 0.5,
		nodeWeight = 0.5,
		nodeTolerancePx = 5,
		moveFlowsIntersectingNodes = true,
		multipleIterations = true,
		NBR_ITERATIONS = 100,
		showForceAnimation = false,
		FLOW_DISTANCE_THRESHOLD = 0.00000001, // TODO what should this be??
		checkFlowBoundingBoxes = true,
		maxFlows = 75,
		useNetFlows = false,
		mapScale = 1,
		
		// Map Appearance Settings
		maxFlowWidth = 30,
		maxNodeRadius = 5,
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
		
		// cached values
		minFlowValue,
		maxFlowValue,
		meanFlowValue,
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

		// Not really a setting. Doesn't get passed in to the layoutWorker. 
		stateScales = {
			"wv" : 0.5
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

	
	// Updates the cached values using only the filtered flows. These values
	// are used for drawing and layouts, which only care about the flows being
	// shown.
	function updateCachedValues() {
		
		if (filteredFlows.length < 1) {
			minFlowValue = 0;
			maxFlowValue = 0;
		} else {
			minFlowValue = maxFlowValue = filteredFlows[0].getValue();
		}

		var flowSum = 0,
		    flowCounter = 0,
		    nodeSum = 0,
			nodeCounter = 0,
			i, j, v, flow, l;
		    
		minFlowLength = Infinity;
		maxFlowLength = 0;

		for(i = 0, j = filteredFlows.length; i < j; i += 1) {
			flow = filteredFlows[i];
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
    
    function findPoint(target) {

		var i, j, pt;
		
		// Loop through the _points. If the coordinates match the current point, 
		// return the existing point.
		// If they don't match any of them, return the provided point.
		for (i = 0, j = nodes.length; i < j; i += 1) {
			pt = nodes[i];
			if (pt.lat === target.lat && pt.lng === target.lng) {
				return [true,pt];
			}
		}
		return [false,target];
	}
    
    function addPoint(pt) {
		
		var xy, foundPt;
		
		// Does the point have an xy and latLng?
		if(!pt.x || !pt.y){
			xy = Flox.latLngToLayerPt([pt.lat, pt.lng]);
			pt.x = xy.x;
			pt.y = xy.y;
		}

		// Make sure it isn't a duplicate point
		foundPt = findPoint(pt);
		// Add the point to the _points array
		if(foundPt[0]===false) {
			nodes.push(foundPt[1]);
		}
		updateCachedValues();
    }
    
    // Sort flows by value in descending order, unless true is passed in.
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
    
    function sortTheseFlows(theseFlows) {
		var i;
		theseFlows.sort(function(a,b) {
			return b.getValue() - a.getValue();
		});
	}
    
    function containsObject(obj, list) {
	    var i;
	    for (i = 0; i < list.length; i += 1) {
	        if (list[i] === obj) {
	        	//console.log("it's already in there!")
	            return true;
	        }
	    }
	    //console.log("It's not in there!")
	    return false;
	}
    
    // Creates a subset of flows of length maxFlows
    // TODO Flows should be sorted first. Maybe they should be sorted here?
    function setFilteredFlows(n) {
		//console.log("setFilteredFlows called!");
		
		var flowSet, i, j, flow;
		
		if (useNetFlows) {
			flowSet = netFlows;
		} else {
			flowSet = flows;
		}
	
		if(!n) {
			n = maxFlows;
		}
	
		if (n > flowSet.length) {
			n = flowSet.length;
		}
	
		// Reset filtered flows and filtered nodes to empty.
		filteredFlows = [];
		filteredNodes = [];

		filteredFlows = flowSet.slice(0, n);
		
		// Now filter the nodes. 
		for (i = 0, j = filteredFlows.length; i < j; i += 1) {
			flow = filteredFlows[i];
			
			if(!containsObject(flow.getStartPt(), filteredNodes)) {
				filteredNodes.push(flow.getStartPt());
			}
			
			if(!containsObject(flow.getEndPt(), filteredNodes)) {
				filteredNodes.push(flow.getEndPt());
			}
		}
	}
    
	function addFlow(flow){
		// Check to see if the points exist already.
		var startPoint = findPoint(flow.getStartPt())[1],
			endPoint = findPoint(flow.getEndPt())[1];
		// If they do, have the flows refer to THOSE instead of their duplicates.
		addPoint(startPoint);
        addPoint(endPoint);
		flow.setStartPt(startPoint);
		flow.setEndPt(endPoint);
        flows.push(flow);
        setFilteredFlows();
        updateCachedValues();
    }
    
	function deletePoint(pt) {
		// delete flows that are connected to pt
		// First figure out which flows have pt in it
		var filteredFlows = [],
			i, j, index;
		for (i = 0, j = flows.length; i < j; i += 1) {
			if(flows[i].getStartPt()!==pt && flows[i].getEndPt()!==pt) {
				filteredFlows.push(flows[i]);
			}
		}
		flows = filteredFlows;
		
		// FIXME There is still more than one of each point sometimes.
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
		return radius;
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
		    
		//if (strokeWidth >= 1.5) { // FIXME hardcoded value. Min stroke width?
			return strokeWidth;
		//}
		//return 1.5; // FIXME hardcoded value
	}


	

	
	// configure the arrows of filtered flows. 
	function configureArrows() {
		var i, j, flow, flowWidth,	
			minFlowWidth = (maxFlowWidth * minFlowValue / maxFlowValue),
			endClipRadius, startClipRadius, endPt, startPt;
			
			//minFlowWidth = minFlowWidth > 1.5 ? minFlowWidth : 1.5;
			// FIXME again with the hard-coded minimum flow width. Stop doing this!
		
		// if flows haven't been filtered, filter them;
		if(!filteredFlows[0]) {
			setFilteredFlows();
		}
		
		for(i = 0, j = filteredFlows.length; i < j; i += 1) {
			flow = filteredFlows[i];
			flowWidth = getFlowStrokeWidth(flow);	
			
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
			
			flow.configureArrow(endClipRadius, minFlowWidth, maxFlowWidth, flowWidth,
				arrowSizeRatio, arrowLengthRatio, arrowLengthScaleFactor,
				arrowWidthScaleFactor, arrowCornerPosition, pointArrowTowardsEndpoint,
				arrowEdgeCtrlLength, arrowEdgeCtrlWidth);	
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

	function setMaxFlows(d) {
		maxFlows = d;
		
		// need to do all the things.	
		setFilteredFlows();
		updateCachedValues();
	}
	

	function cacheNetFlows() {

		var flowset = flows.slice(),
			i, j, f1, f2, diff, hasOpposingFlow, flow;
		
		// Reset netFlows and netNodes to empty
		netFlows = [];
		netFlows = [];
		
		// Loop backwards through flows
		for (i = flowset.length - 1; i >= 0; i -= 1) {
			
			hasOpposingFlow = false;
			
			f1 = flowset[i];
			
			if(f1) {
				// Loop forwards through flows, stopping at flows[i - 1];
				for (j = 0; j < i; j += 1) {
					
					if(flowset[j]) {
						f2 = flowset[j];
						if(f1.getStartPt() === f2.getEndPt() && f1.getEndPt() === f2.getStartPt()) {
							// These are two way flows!
							hasOpposingFlow = true;
							
							console.log("found opposing flow!");
							
							diff = f1.getValue() - f2.getValue();
							
							if (diff > 0) { // f1 is bigger
								netFlows.push(new Flow(f1.getStartPt(), f1.getEndPt(), diff));
							}
							
							if (diff < 0) { // f2 is bigger
								netFlows.push(new Flow(f2.getStartPt(), f2.getEndPt(), Math.abs(diff)));
							}
							
							if (diff === 0) {
								console.log("Hurray! Opposing flows have equal values!");
							}
							
							flowset[j] = false; // so f2 isn't added when encountered again
							// in the reverse loop.
						}		
						
					}
					
						
				}
				
				if(!hasOpposingFlow) {
					netFlows.push(flows[i]);
				}
			}
		}
		
		sortTheseFlows(netFlows);
		
		// Need to set up netNodes
		for (i = 0, j = netFlows.length; i < j; i += 1) {
			flow = netFlows[i];
			
			if(!containsObject(flow.getStartPt(), netFlows)) {
				netNodes.push(flow.getStartPt());
			}
			
			if(!containsObject(flow.getEndPt(), netFlows)) {
				netNodes.push(flow.getEndPt());
			}
		}
	}

	// set filteredFlows to the flows between minValue and maxValue. The flows
	// should already be sorted. 
	function filterFlows(minValue, maxValue) {
		var i, j, flow;
		
		filteredFlows = [];
		
		for (i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			if (flow.getValue() >= minValue && flow.getValue() <= maxValue) {
				filteredFlows.push(flow);
			}
		}
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
		
        for(i = 0, j = filteredFlows.length; i < j; i += 1) {
			flow = filteredFlows[i];
			rs = flowDistanceFromStartPointPixel > 0 ? getStartClipRadius(flow.getStartPt()) : 0;
			re = flowDistanceFromEndPointPixel > 0 ? getEndClipRadius(flow.getEndPt()) : 0;
			flow.cacheClippedLineSegments(rs, re, gap);
        }
	};

	my.cacheAllFlowBoundingBoxes = function() {
		// console.log("caching flow bounding boxes!");
		var flow, i, j;
		for(i = 0, j = filteredFlows.length; i < j; i += 1) {
			filteredFlows[i].cacheBoundingBox();
		}
	};

	my.toJSON = function(){
		
		var JSON = {
				flows: [],
				nodes: []
		    },

			i, j, flow, node, sPt, ePt, cPt, val;
		
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
			flowDistanceFromEndPointPx : flowDistanceFromEndPointPx,
			flowDistanceFromStartPointPx : flowDistanceFromStartPointPx,
			NODE_STROKE_WIDTH : NODE_STROKE_WIDTH,
			NBR_ITERATIONS: NBR_ITERATIONS,
			showForceAnimation: showForceAnimation,
			FLOW_DISTANCE_THRESHOLD : FLOW_DISTANCE_THRESHOLD,
			flowDistanceFromStartPointPixel : flowDistanceFromStartPointPixel,
			flowDistanceFromEndPointPixel : flowDistanceFromEndPointPixel,
			checkFlowBoundingBoxes: checkFlowBoundingBoxes,
			maxFlows : maxFlows,
			mapScale: mapScale
		};
		
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
							value: sPt.value,
							lat: sPt.lat,
							lng: sPt.lng
						},
					endPt: 
						{
							x: ePt.x, 
							y: ePt.y,
							value: ePt.value,
							lat: ePt.lat,
							lng: ePt.lng
						},
					cPt:
						{
							x: cPt.x,
							y: cPt.y
						},
					value: flow.getValue()
				}
			);
		}
		
		for (i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			JSON.nodes.push(
				{
					x: node.x,
					y: node.y,
					value: node.value
				}
			);
		}
		//console.log("Model.toJSON made this: ");
		//console.log(JSON);
		//console.log(JSON.flows);
		//console.log(JSON.nodes);
		return JSON;
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
		for(i=0, j = filteredFlows.length; i < j; i += 1) {
			locks.push(filteredFlows[i].isLocked());
		}
		return locks;
	};
	
	my.applyLocks = function(locks) {
		var i, j;
		if(filteredFlows.length === locks.length) {
			for(i = 0, j = locks.length; i < j; i += 1) {
				filteredFlows[i].setLocked(locks[i]);
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

    my.addPoint = function(pt) {
        addPoint(pt);
    };

	my.getAllPoints = function() {
		return nodes;
	};

    my.getPoints = function() {
        return filteredNodes; 
    };

    my.addFlow = function(flow) {
        addFlow(flow);
    };

    // Add multiple flows 
    my.addFlows = function(newFlows) {
        var i, j;
	    for( i= 0, j = newFlows.length; i < j; i += 1) {
	        addFlow(newFlows[i]);
	    }
	    updateCachedValues();
    };

    // Get the filtered flows.
    my.getFlows = function() {
        if(filteredFlows[0]!==undefined) {
			return filteredFlows;
		}
		setFilteredFlows();
		return filteredFlows;
    };

	// Return all unfiltered flows
	my.getAllFlows = function() {
		return flows;
	};

	// Returns all unfiltered control points
	my.getAllCtrlPts = function() {
		var ctrlPts = [],
			i, j;
        for(i=0, j = flows.length; i < j; i += 1) {
            ctrlPts.push(flows[i].getCtrlPt());
        }
        return ctrlPts;
	};

    // Get the control points of all filtered flows
    my.getCtrlPts = function() {
        var ctrlPts = [],
			i, j;
        for(i=0, j = filteredFlows.length; i < j; i += 1) {
            ctrlPts.push(filteredFlows[i].getCtrlPt());
        }
        return ctrlPts;
    };

    // Delete all flows from the model.
    my.deleteAllFlows = function() {
        flows = [];
        nodes = [];
        filteredFlows = [];
        filteredNodes = [];
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

	my.setFilteredFlows = function(n) {
		setFilteredFlows(n);
	};

	my.filterFlows = function(minValue, maxValue) {
		filterFlows(minValue, maxValue);
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

	my.cacheNetFlows = function () {
		cacheNetFlows();
	};

	my.getDifferenceFlows = function() {
		return netFlows;
	};

	my.getSelectedFlows = function () {
		// should only look in filtered flows, because these are the only 
		// flows that might have a select state. 
		// ...Unless a selected flow is filtered out before being deselected.
		// If that's the case then we don't want that one anyway! But it should
		// get deselected I think. Anyway,
		var i, j, selectedFlows = [];
		
		for(i = 0, j = filteredFlows.length; i < j; i += 1) {
			if (filteredFlows[i].isSelected()) {
				selectedFlows.push(filteredFlows[i]); 
			}
		}
		return selectedFlows;
	};

	my.getSelectedNodes = function () {
		var i, j, selectedNodes = [];
		
		for(i = 0, j = filteredNodes.length; i < j; i += 1) {
			if (filteredNodes[i].selected) {
				selectedNodes.push(filteredNodes[i]); 
			}
		}
		return selectedNodes;
	};
	
	my.setUseNetFlows = function (boo) {
		
		useNetFlows = boo;
		
		if(boo) {
			cacheNetFlows();
		} 
		
		setFilteredFlows();
		updateCachedValues();
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
	
	my.setStateMapScale = function(stateString) {
		mapScale = stateScales[stateString];
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
		
		maxFlowPoints = settings.maxFlowPoints;
		distanceWeightExponent = settings.distanceWeightExponent;
		peripheralStiffnessFactor = settings.peripheralStiffnessFactor;
		maxFlowLengthSpringConstant = settings.maxFlowLengthSpringConstant;
		minFlowLengthSpringConstant = settings.minFlowLengthSpringConstant;
		enforceRangebox = settings.enforceRangebox;
		flowRangeboxHeight = settings.flowRangeboxHeight;
		maxFlowWidth = settings.maxFlowWidth;
		maxNodeRadius = settings.maxNodeRadius;
		antiTorsionWeight = settings.antiTorsionWeight;
		angularDistributionWeight = settings.angularDistributionWeight;
		nodeWeight = settings.nodeWeight;
		nodeTolerancePx = settings.nodeTolerancePx;
		moveFlowsIntersectingNodes = settings.moveFlowsIntersectingNodes;
		multipleIterations = settings.multipleIterations;
		isShowLockedFlows = settings.isShowLockedFlows;
		flowDistanceFromEndPointPx = settings.flowDistanceFromEndPointPx;
		flowDistanceFromStartPointPx = settings.flowDistanceFromStartPointPx;
		NODE_STROKE_WIDTH = settings.NODE_STROKE_WIDTH;
		NBR_ITERATIONS = settings.NBR_ITERATIONS;
		showForceAnimation = settings.showForceAnimation;
		FLOW_DISTANCE_THRESHOLD = settings.FLOW_DISTANCE_THRESHOLD;
		flowDistanceFromStartPointPixel = settings.flowDistanceFromStartPointPixel;
		flowDistanceFromEndPointPixel = settings.flowDistanceFromEndPointPixel;
		checkFlowBoundingBoxes = settings.checkFlowBoundingBoxes;
		maxFlows = settings.maxFlows;
		mapScale = settings.mapScale;
	};

	return my;

};


















