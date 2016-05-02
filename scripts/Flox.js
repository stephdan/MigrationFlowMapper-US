
(function($, L, d3, Flow, window, document, undefined) {

"use strict";
// Define Flox as a global variable. This is how leaflet does it with L, and I 
// thought it was cool and very clear. Other globals are defined with this app
// that DON'T do this though, like Flow and FloxModel. TODO
var Flox = {};
window.Flox = Flox;

var mapComponent,
	model,
    drawRangeboxes = false,
    drawControlPoints = false,
    editMode = true,
    // drawIntermediateFlowPoints = false,
    layoutWorker,
    skipEndPoints = false,
    flowGrid = null,
	nodeGrid = null;
    
function initLayoutWorker() {
	
	var flows,
		ctrlPts,
		flow, flowCPt, 
		i, j, latLng,
		progress = document.getElementById("layoutProgressBar");
		progress.style.visibility = "visible";
	
	if (window.Worker) {
	
		if(layoutWorker) {
			layoutWorker.terminate();
		}
	
		// Web workers take a separate file. Note that the path is relative
		// to index.html, not Flox.js
		layoutWorker = new Worker("scripts/layoutWorker.js");
		
		// This happens when layoutWorker sends out a message
		// What it SHOULD do is update the control points of flows in the model
		// with new locations.
		layoutWorker.onmessage = function(e) {
			
			progress.value = (e.data[1] / model.getIterations()) * 100;
			if(((e.data[1] / model.getIterations()) * 100)===100) {
				progress.style.visibility = "hidden";
			}
			
			ctrlPts = e.data[0];			
			flows = model.getFlows();
			
			if(ctrlPts) {
				
				for (i = 0, j = flows.length; i < j; i += 1) {
					flowCPt = flows[i].getCtrlPt();
					flowCPt.x = ctrlPts[i].x;
					flowCPt.y = ctrlPts[i].y;
					
					// Also update the latLngs of the cPts
					latLng = mapComponent.layerPtToLatLng([ctrlPts[i].x, ctrlPts[i].y]);
					
					flowCPt.lat = latLng.lat;
					flowCPt.lng = latLng.lng;
				}
				refreshMap();
			}
		};	
	}
}

function runLayoutWorker() {
	console.log("layout worker isn't working");
	return;
	initLayoutWorker();
	console.log("running layoutWorker");
	var modelJSON = model.toJSON();
	layoutWorker.postMessage(modelJSON);
}

function refreshMap() {
    mapComponent.clearAll();
    mapComponent.drawFeatures();
}

function importCSV(path) {
    // clear the model
    model.deleteAllFlows();

    // import the new flows
    Flox.FlowImporter.importCSV(path);
    // FlowImporter redraws the map; if it was redrawn here, it would 
    // redraw before the CSV was read in all the way.
}

function straightenFlows(onlySelected) {
	// TODO Could straighten only selected flows based on a setting.
	if(model.getFlows().length > 0) {
		var layouter = new Flox.FlowLayouter(model);
		layouter.straightenFlows(false); // True if only selected

		refreshMap();
	}
}

// Updates caached flow points and returns a single array containing all 
// points along all flows. 
// Primarily used by mapComponent for drawing flow points after drag events,
// but also serves to update cached points after edits. 
function getAllFlowPoints() {
	
	model.cacheAllFlowLineSegments();
	
    var flows = model.getFlows(),
        allFlowPoints = [],
        i, j, flow, somePoints;
	
	for (i = 0, j = flows.length; i < j; i += 1) {
		flow = flows[i];
		somePoints = flow.getCachedLineSegments();
		//console.log(somePoints);
		allFlowPoints = allFlowPoints.concat(somePoints);
	}
	
    return allFlowPoints;
}



/**
 * Sets up and calls each iteration of FlowLayouter.layoutAllFlows(weight)
 * with the appropriate weight.
 * Decreases the weight of each iteration. 
 * Calls moveFlowsIntersectingNodes() during second half of iterations.
 */
function layoutFlows() {

	//console.log("layoutFlows called");
	
	if (model.getFlows().length < 2) {
		console.log("there is less than 2 flows, not doing a layout");
		refreshMap();
		return;
	}
	
    var multipleIterations = model.isMultipleIterations(),
        //progress = document.getElementById("layoutProgressBar"),
        initialLocks = model.getLocks(),
        i, j, weight,
        layouter,
        startTime = performance.now(),
        endTime,
        iterations;

	layouter = new Flox.FlowLayouter(model);
	

	// For debug purposes, there is a UI setting for performing a single
	// layout iteration.
    if(!multipleIterations){
        layouter.layoutAllFlows(0.2);
        if(model.isMoveFlowsIntersectingNodes()) {
			layouter.moveFlowsIntersectingNodes();
		}
		model.applyLocks(initialLocks);
		
		
        d3.select("#flowPointLayer").remove();
		mapComponent.update();
        return;
    }

	// Straighten the flows
	straightenFlows();
	iterations = model.getIterations();
	
	// Run the first half of iterations, without MFIN
    for (i = 0, j = Math.floor(iterations/2); i < j; i += 1) {
        weight = 1 - i/iterations;
        layouter.layoutAllFlows(weight);

    }
    
    // Run second half of iterations, with MFIN
    for (i = Math.floor(iterations/2); i < iterations; i += 1) {
        weight = 1 - i/iterations;
        layouter.layoutAllFlows(weight);
        if(model.isMoveFlowsIntersectingNodes()) {
			layouter.moveFlowsIntersectingNodes();
		}
    }
    
	model.applyLocks(initialLocks);
	
	// update the map
	// TODO this is called here rather than at the end of each iteration
	// because it doesn't work at the end of each iteration. 
	// Maybe because of asynchronous functions in D3?
	d3.select("#flowPointLayer").remove();
	mapComponent.update();
	endTime = performance.now();
	console.log("Layout time in milliseconds: " + Math.round(endTime - startTime));
}

function initGUI() {

    // Get the sliders
    var flowRangeboxHeightSlider = document.getElementById("flowRangeboxHeightSlider"),
        flowRangeboxHeightSliderOutText = document.getElementById("flowRangeboxHeightSliderOutputText"),
        peripheralFlowStiffnessSlider = document.getElementById("peripheralFlowStiffnessSlider"),
        peripheralFlowStiffnessSliderOutText = document.getElementById("peripheralFlowStiffnessSliderOutputText"),
        angularDistributionSlider = document.getElementById("angularDistributionSlider"),
        angularDistributionSliderOutText = document.getElementById("angularDistributionSliderOutputText"),
		longestFlowSpringStiffnessSlider = document.getElementById("longestFlowSpringStiffnessSlider"),
		longestFlowSpringStiffnessSliderOutputText = document.getElementById("longestFlowSpringStiffnessSliderOutputText"),
		shortestFlowSpringStiffnessSlider = document.getElementById("shortestFlowSpringStiffnessSlider"),
		shortestFlowSpringStiffnessSliderOutputText = document.getElementById("shortestFlowSpringStiffnessSliderOutputText"),
        distanceWeightExponentSlider = document.getElementById("distanceWeightExponentSlider"),
		distanceWeightExponentSliderOutputText = document.getElementById("distanceWeightExponentSliderOutputText"),
		antiTorsionSlider = document.getElementById("antiTorsionSlider"),
		antiTorsionSliderOutputText = document.getElementById("antiTorsionSliderOutputText"),
		maxFlowWidthSlider = document.getElementById("maxFlowWidthSlider"), 
	    maxNodeRadiusSlider = document.getElementById("maxNodeRadiusSlider"),
	    maxFlowWidthSliderOutputText = document.getElementById("maxFlowWidthSliderOutputText"), 
	    maxNodeRadiusSliderOutputText = document.getElementById("maxNodeRadiusSliderOutputText"),
	    
		moveFlowsIntersectingNodesCheckbox = document.getElementById("moveFlowsIntersectingNodesCheckbox"),
		multipleIterationsCheckbox = document.getElementById("multipleIterationsCheckbox"),
		nodeWeightSlider = document.getElementById("nodeWeightSlider"),
		nodeWeightSliderOutputText = document.getElementById("nodeWeightSliderOutputText"),
		showForceAnimationCheckbox = document.getElementById("showForceAnimationCheckbox"),
		minDistOfFlowsFromNodesSlider = document.getElementById("minDistOfFlowsFromNodesSlider"),
		minDistOfFlowsFromNodesSliderOutputText = document.getElementById("minDistOfFlowsFromNodesSliderOutputText"),
		flowDistanceFromStartPointTextBox = document.getElementById("flowDistanceFromStartPointTextBox"),
		flowDistanceFromEndPointTextBox = document.getElementById("flowDistanceFromEndPointTextBox"),
		
		addArrowsCheckbox = document.getElementById("addArrowsCheckbox"),
		addArrowsCheckboxOutputText = document.getElementById("addArrowsCheckboxOutputText"),
		arrowLengthSlider = document.getElementById("arrowLengthSlider"),
		arrowLengthSliderOutputText = document.getElementById("arrowLengthSliderOutputText"),
		arrowWidthSlider = document.getElementById("arrowWidthSlider"),
		arrowWidthSliderOutputText = document.getElementById("arrowWidthSliderOutputText"),
		arrowEdgeCtrlPointLengthSlider = document.getElementById("arrowEdgeCtrlPointLengthSlider"),
		arrowEdgeCtrlPointLengthSliderOutputText = document.getElementById("arrowEdgeCtrlPointLengthSliderOutputText"),
		arrowEdgeCtrlPointWidthSlider = document.getElementById("arrowEdgeCtrlPointWidthSlider"),
		arrowEdgeCtrlPointWidthSliderOutputText = document.getElementById("arrowEdgeCtrlPointWidthSliderOutputText"),
		arrowCornerPositionSlider = document.getElementById("arrowCornerPositionSlider"),
		arrowCornerPositionSliderOutputText = document.getElementById("arrowCornerPositionSliderOutputText"),
		arrowSizeRatioSlider = document.getElementById("arrowSizeRatioSlider"),
		arrowSizeRatioSliderOutputText = document.getElementById("arrowSizeRatioSliderOutputText"),
		arrowLengthRatioSlider = document.getElementById("arrowLengthRatioSlider"),
		arrowLengthRatioSliderOutputText = document.getElementById("arrowLengthRatioSliderOutputText"),
		maxFlowsSlider = document.getElementById("maxFlowsSlider"),
		maxFlowsSliderOutputText = document.getElementById("maxFlowsSliderOutputText");
    
    // Set the slider values and checkboxes    
    flowRangeboxHeightSlider.value = model.getFlowRangeboxHeight() * 100;
    flowRangeboxHeightSliderOutText.innerHTML = parseFloat(flowRangeboxHeightSlider.value).toFixed(0);
    peripheralFlowStiffnessSlider.value = model.getPeripheralStiffnessFactor() * 100;
    peripheralFlowStiffnessSliderOutText.innerHTML = parseFloat(peripheralFlowStiffnessSlider.value).toFixed(0);
    angularDistributionSlider.value = model.getAngularDistributionWeight() * 100;
    angularDistributionSliderOutText.innerHTML = parseFloat(angularDistributionSlider.value).toFixed(0);
    longestFlowSpringStiffnessSlider.value = model.getMaxFlowLengthSpringConstant() * 100;
    longestFlowSpringStiffnessSliderOutputText.innerHTML = parseFloat(longestFlowSpringStiffnessSlider.value).toFixed(0);
    shortestFlowSpringStiffnessSlider.value = model.getMinFlowLengthSpringConstant() * 100;
    shortestFlowSpringStiffnessSliderOutputText.innerHTML = parseFloat(shortestFlowSpringStiffnessSlider.value).toFixed(0);
    distanceWeightExponentSlider.value = model.getDistanceWeightExponent();
    distanceWeightExponentSliderOutputText.innerHTML = Math.pow(2, parseFloat(distanceWeightExponentSlider.value)).toFixed(0);
    antiTorsionSlider.value = model.getAntiTorsionWeight() * 100;
    antiTorsionSliderOutputText.innerHTML = parseFloat(antiTorsionSlider.value).toFixed(0);
    maxFlowWidthSlider.value = model.getMaxFlowWidth();
    maxFlowWidthSliderOutputText.innerHTML = parseFloat(maxFlowWidthSlider.value).toFixed(1);
    maxFlowsSlider.value = model.getMaxFlows();
    maxFlowsSliderOutputText.innerHTML = parseFloat(maxFlowsSlider.value).toFixed(0);
    
    maxNodeRadiusSlider.value = model.getMaxNodeRadius();
    maxNodeRadiusSliderOutputText.innerHTML = parseFloat(maxNodeRadiusSlider.value).toFixed(1);
    
    moveFlowsIntersectingNodesCheckbox.checked = model.isMoveFlowsIntersectingNodes();
    multipleIterationsCheckbox.checked = model.isMultipleIterations();
    nodeWeightSlider.value = model.getNodeWeight() * 10;
    nodeWeightSliderOutputText.innerHTML = parseFloat(nodeWeightSlider.value).toFixed(0);
    showForceAnimationCheckbox.checked = model.isShowForceAnimation();
    minDistOfFlowsFromNodesSlider.value = model.getNodeTolerancePx();
    minDistOfFlowsFromNodesSliderOutputText.innerHTML = parseFloat(minDistOfFlowsFromNodesSlider.value).toFixed(0);
    flowDistanceFromStartPointTextBox.value = model.getFlowDistanceFromStartPointPixel();
    flowDistanceFromEndPointTextBox.value = model.getFlowDistanceFromEndPointPixel();
    
    addArrowsCheckbox.checked = model.isDrawArrows();
    
    arrowLengthSlider.value = model.getArrowLengthScaleFactor();
	arrowWidthSlider.value = model.getArrowWidthScaleFactor();
	arrowEdgeCtrlPointLengthSlider.value = model.getArrowEdgeCtrlLength();
	arrowEdgeCtrlPointWidthSlider.value = model.getArrowEdgeCtrlWidth();
	arrowCornerPositionSlider.value = model.getArrowCornerPosition();
	arrowSizeRatioSlider.value = model.getArrowSizeRatio();
	arrowLengthRatioSlider.value = model.getArrowLengthRatio();
    
    arrowLengthSliderOutputText.innerHTML = parseFloat(arrowLengthSlider.value).toFixed(2);
    arrowWidthSliderOutputText.innerHTML = parseFloat(arrowWidthSlider.value).toFixed(2);
    arrowEdgeCtrlPointLengthSliderOutputText.innerHTML = parseFloat(arrowEdgeCtrlPointLengthSlider.value).toFixed(2);
    arrowEdgeCtrlPointWidthSliderOutputText.innerHTML = parseFloat(arrowEdgeCtrlPointWidthSlider.value).toFixed(2);
    arrowCornerPositionSliderOutputText.innerHTML = parseFloat(arrowCornerPositionSlider.value).toFixed(2);
    arrowSizeRatioSliderOutputText.innerHTML = parseFloat(arrowSizeRatioSlider.value).toFixed(2);
    arrowLengthRatioSliderOutputText.innerHTML = parseFloat(arrowLengthRatioSlider.value).toFixed(2);
}

function getNodeRadius(node) {
	return model.getNodeRadius(node);
}

function endClipRadius(endNode) {
	// distance between end of flow and end point
	var gapDistanceToEndNode = model.getFlowDistanceFromEndPointPixel(),
	    endNodeRadius = model.getNodeStrokeWidth() / 2 + getNodeRadius(endNode);
	return gapDistanceToEndNode + endNodeRadius;
}

function startClipRadius(startNode) {
	// distance between end of flow and end point
	var gapDistanceToStartNode = model.getFlowDistanceFromStartPointPixel(),
	    startNodeRadius = model.getNodeStrokeWidth() / 2 + getNodeRadius(startNode);
	return gapDistanceToStartNode + startNodeRadius;
}

function updateFlowDistanceFromStartPointTextBox () {
	var textBox = document.getElementById("flowDistanceFromStartPointTextBox"),
		val = parseFloat(textBox.value);
	// Make sure it's a number. 
	
	if(!isNaN(val)) {
		console.log("it's a number!");
		textBox.value = val;
		model.setFlowDistanceFromStartPointPixel(val);
		refreshMap();
		// redraw the flows?
	} else {
		console.log("It's not a number!");
		textBox.value = 0;
		model.setFlowDistanceFromStartPointPixel(0);
		refreshMap();
	}
}

function updateFlowDistanceFromEndPointTextBox () {
	var textBox = document.getElementById("flowDistanceFromEndPointTextBox"),
		val = parseFloat(textBox.value);
	// Make sure it's a number. 
	
	if(!isNaN(val)) {
		console.log("it's a number!");
		textBox.value = val;
		model.setFlowDistanceFromEndPointPixel(val);
		refreshMap();
		// redraw the flows?
	} else {
		console.log("It's not a number!");
		textBox.value = 0;
		model.setFlowDistanceFromEndPointPixel(0);
		refreshMap();
	}
}

function importCensusData() {
	// clear the model
    model.deleteAllFlows();
	
	var nodePath = "data/census/state_latLng.csv",
		flowPath = "data/census/US_State_migration_2014_flows.csv";
	
	Flox.FlowImporter.importStateMigrationData(nodePath, flowPath);
	
	// move and zoom to the correct location
	mapComponent.setView([39,-95], 4);
}

function importTelecomData() {
	importCSV("data/TeleGeographyMap_flows copy.csv");
	
	// move and zoom to the correct location
	mapComponent.setView([50,10], 4);
}


// PUBLIC =====================================================================

Flox.getStartClipRadius = function (startNode) {
	return model.getStartClipRadius(startNode);
};

Flox.getEndClipRadius = function (endNode) {
	return model.getEndClipRadius(endNode);
};

Flox.createLatLng = function(lat, lng) {
	return new L.LatLng(lat,lng);
};

Flox.update = function() {
	mapComponent.update();
};

Flox.getFlowDistanceFromStartPointPixel = function() {
	return model.getFlowDistanceFromStartPointPixel();
};

Flox.getFlowDistanceFromEndPointPixel = function() {
	return model.getFlowDistanceFromEndPointPixel();
};


Flox.angleDif = function(startToCtrlAngle, fStartToCtrlAngle) {
	return Flox.GeomUtils.angleDif(startToCtrlAngle, fStartToCtrlAngle);
};

Flox.getMaxFlowPoints = function() {
	return model.getMaxFlowPoints();
};

Flox.isEnforceRangebox = function() {
	return model.isEnforceRangebox();
};

Flox.getAngularDistributionWeight = function() {
	return model.getAngularDistributionWeight();
};

Flox.getPeripheralStiffnessFactor = function() {
	return model.getPeripheralStiffnessFactor();
};

Flox.getNodeWeight = function() {
	return model.getNodeWeight();
};

Flox.getDistanceWeightExponent = function() {
	return model.getDistanceWeightExponent();
};

Flox.getMinFlowLengthSpringConstant = function() {
	return model.getMinFlowLengthSpringConstant();
};

Flox.getMaxFlowLengthSpringConstant = function() {
	return model.getMaxFlowLengthSpringConstant();
};

Flox.getAntiTorsionWeight = function() {
	return model.getAntiTorsionWeight();
};

Flox.flowToBezier = function(x0, y0, x1, y1, x2, y2) {
	return new Bezier(x0, y0, 
                      x1, y1,
                      x2, y2);
};

Flox.getNodeTolerancePx = function() {
	return model.getNodeTolerancePx();
};
	
Flox.getClippedFlow = function(flow, startClipRadius, endClipRadius) {
	getClippedFlow(flow, startClipRadius, endClipRadius);
};

Flox.endClipRadius = function(endNode) {
	endClipRadius(endNode);
};

Flox.startClipRadius = function(startNode) {
	startClipRadius(startNode);
};	

Flox.isShowLockedFlows = function() {
	return model.isShowLockedFlows();
};

Flox.getFlowStrokeWidth = function(flow) {
	var maxFlowWidth = model.getMaxFlowWidth(),
	    maxFlowValue = model.getMaxFlowValue(),
	    strokeWidth =  (maxFlowWidth * flow.getValue()) / maxFlowValue;
	    
	if (strokeWidth >= 1.5) { // FIXME hardcoded value. Min stroke width?
		return strokeWidth;
	}
	
	return 1.5; // FIXME hardcoded value
	
};

Flox.getMaxFlowValue = function() {
	return model.getMaxFlowValue();
};

Flox.getMaxFlowWidth = function() {
	return model.getMaxFlowWidth();
};

/**
 * Returns the radius of the node based on its value.
 */
Flox.getNodeRadius = function(node) {
	return getNodeRadius(node);
};

/**
 * Takes pixel coordinates, converts them to latLng, 
 * makes a Point, returns it.
 * lyrPt can be an array [x,y]
 */
Flox.pointFromLayerPt = function(lyrPt) {
	var latLng = mapComponent.layerPtToLatLng(lyrPt);
	return new Flox.Point(latLng.lng, latLng.lat);
};

/**
 * Convenience constructor for making a Flow when the location of
 * the control point is known. 
 * TODO Might not be optimal, since the default constructor
 * calculates a location for the cPt. 
 */
Flox.createFlowWithCPt = function(sPt, cPt, ePt, val) {
	var newFlow = new Flow(sPt, ePt, val);
	newFlow.setCtrlPt(cPt);
	return newFlow;
};

Flox.enforceRangebox = function(flow) {
    return Flox.RangeboxEnforcer.enforceRangebox(flow);
};

Flox.layoutFlows = function() {
    layoutFlows();
};

Flox.getAllFlowPoints = function() {
    return getAllFlowPoints();
};

Flox.importCSV = function(path) {
    importCSV(path);
};

Flox.getMap = function() {
    return mapComponent.getMap();
};

Flox.refreshMap = function() {
    // redraw the flows
    refreshMap();
};

Flox.getModel = function() {
    return model;
};

Flox.getDistanceBetweenPoints = function(p1, p2) {
    var squaredDist = Flox.GeomUtils.squaredDistanceBetweenPoints(p1, p2);
    return Math.sqrt(squaredDist);
};

Flox.latLngToLayerPt = function(latLng) {
    return mapComponent.latLngToLayerPt(latLng);
};

Flox.layerPtToLatLng = function(layerPt) {
    return mapComponent.layerPtToLatLng(layerPt);
};

Flox.layerPtToPoint = function(layerPt) {
    var latLng = mapComponent.layerPtToLatLng(layerPt);
    return new Flox.Point(latLng.lng, latLng.lat);
};

Flox.getDistanceToQuadraticBezierCurve = function (p0x, p0y, p1x, p1y, p2x, p2y, xy) {
	return Flox.GeomUtils.getDistanceToQuadraticBezierCurve(p0x, p0y, p1x, p1y, p2x, p2y, xy);
};

// FIXME this can be optimized to not iterate over all flows.
Flox.getLongestFlowPxLength = function() {

    // Get the flows the Model
    var flows = model.getFlows(),
    lengths = [],
    i, j, flow, p1, p2, dist; // Used in for loop

    // Loop through flows
    for (i = 0, j = flows.length; i < j; i += 1) {

        flow = flows[i];

        p1 = flows[i].getStartPt();
        p2 = flows[i].getEndPt();

        // Get the distance between p1 and p2
        dist = Flox.GeomUtils.squaredDistanceBetweenPoints(p1, p2);

        lengths.push(dist);
    }

    // Return the longest length. The syntax for this is goofy.
    return Math.sqrt(Math.max.apply(Math, lengths));

};

Flox.getShortestFlowPxLength = function() {
    
    // Get the flows the Model
    var flows = model.getFlows(),
        lengths = [],
        i, j, flow, dist, p1, p2;

    // Loop through flows
    for (i = 0, j = flows.length; i < j; i += 1) {

        flow = flows[i];

        p1 = flows[i].getStartPt();
        p2 = flows[i].getEndPt();

        // Get the distance between p1 and p2
        dist = Flox.GeomUtils.squaredDistanceBetweenPoints(p1, p2);

        lengths.push(dist);
    }

    // Return the longest length
    return Math.sqrt(Math.min.apply(Math, lengths));

};

// Returns [x,y] of the midpoint between two points
Flox.midXYBetweenTwoPoints = function(p1, p2) {
    return Flox.GeomUtils.midXYBetweenTwoPoints(p1, p2);
};

// Returns a leaflet layer point between two points
Flox.midLayerPointBetweenTwoPoints = function(p1, p2) {
    var midPtCoords = Flox.GeomUtils.midXYBetweenTwoPoints(p1, p2);
    return L.point(midPtCoords[0], midPtCoords[1]);
};

Flox.straightenFlows = function() {
	straightenFlows();
};

Flox.getFlowRangeboxHeight = function() {
    return model.getFlowRangeboxHeight();
};

Flox.linesIntersect = function(x1, y1, x2, y2, x3, y3, x4, y4) {
    return Flox.GeomUtils.linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4);
};

Flox.getLineLineIntersection = function(x1, y1, x2, y2, x3, y3, x4, y4) {
    return Flox.GeomUtils.getLineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4);
};

Flox.computeRangebox = function(flow) {
    return Flox.RangeboxEnforcer.computeRangebox(flow);
};


Flox.isDrawIntermediateFlowPoints = function() {
	return model.isDrawIntermediateFlowPoints();
};


Flox.isDrawRangeboxes = function() {
	return drawRangeboxes;
};

Flox.runLayoutWorker = function() {
	runLayoutWorker();
};

// ----------------------- GUI STUFF---------------------------------------------

Flox.nodeWeightSliderOninput = function() {
	var sliderVal = document.getElementById("nodeWeightSlider").value,
		outText = document.getElementById("nodeWeightSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(0);
	model.setNodeWeight(parseFloat(sliderVal) / 10);
};

// Change the height of the rangeboxes as the slider moves.
Flox.flowRangeboxHeightSliderOninput = function() {
    var sliderVal = document.getElementById("flowRangeboxHeightSlider").value,
		outText = document.getElementById("flowRangeboxHeightSliderOutputText");
    outText.innerHTML = parseFloat(sliderVal).toFixed(0);
    model.setFlowRangeboxHeight(parseFloat(sliderVal) / 100);
    mapComponent.update();
};

// Draw rangeboxes when the rangebox size slider is mousedowned
Flox.flowRangeboxHeightSliderMousedown = function() {
    model.setDrawRangeboxes(true);
    refreshMap();
};

// Stop drawing rangeboxes when the rangebox size slider is mouseuped
Flox.flowRangeboxHeightSliderMouseup = function() {
    if(!document.getElementById("showRangeboxesCheckbox").checked){
        model.setDrawRangeboxes(false);
		refreshMap();
    }
};

Flox.peripheralFlowStiffnessSliderOninput = function() {
	var sliderVal = document.getElementById("peripheralFlowStiffnessSlider").value,
		outText = document.getElementById("peripheralFlowStiffnessSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(0);
	model.setPeripheralStiffnessFactor(parseFloat(sliderVal) / 100);
};


Flox.angularDistributionSliderOninput = function() {
	var sliderVal = document.getElementById("angularDistributionSlider").value,
	    outText = document.getElementById("angularDistributionSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(0);
	model.setAngularDistributionWeight(parseFloat(sliderVal) / 100);
};

/**
 * Fires whenever the lostestFlowSpringStiffnessSLider is moved or clicked.
 * Sets the value of the output text to the value of the slider. Updates the
 * model with the new values. 
 */
Flox.longestFlowSpringStiffnessSliderOninput = function() {
	var sliderVal = document.getElementById("longestFlowSpringStiffnessSlider").value,
	    outText = document.getElementById("longestFlowSpringStiffnessSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(0);
	model.setMaxFlowLengthSpringConstant(parseFloat(sliderVal) / 100);
};

/**
 * Fires whenever the shortestFlowSpringStiffnessSLider is moved or clicked.
 * Sets the value of the output text to the value of the slider. Updates the
 * model with the new values. 
 */
Flox.shortestFlowSpringStiffnessSliderOninput = function() {
	var sliderVal = document.getElementById("shortestFlowSpringStiffnessSlider").value,
		outText = document.getElementById("shortestFlowSpringStiffnessSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(0);
	model.setMinFlowLengthSpringConstant(parseFloat(sliderVal) / 100);
};

/**
 * Fires whenever the distanceWeightExponentSlider is moved or clicked.
 * Sets the value of the output text to the value of the slider. Updates the
 * model with the new values. 
 */
Flox.distanceWeightExponentSliderOninput = function() {
	var sliderVal = document.getElementById("distanceWeightExponentSlider").value,
		outText = document.getElementById("distanceWeightExponentSliderOutputText");
	outText.innerHTML = Math.pow(2, parseFloat(sliderVal)).toFixed(0);
	model.setDistanceWeightExponent(parseFloat(sliderVal));
};

Flox.antiTorsionSliderOninput = function() {
	var sliderVal = document.getElementById("antiTorsionSlider").value,
		outText = document.getElementById("antiTorsionSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(0);
	model.setAntiTorsionWeight(parseFloat(sliderVal) / 100);
};

Flox.minDistOfFlowsFromNodesSliderOninput = function() {
	var sliderVal = document.getElementById("minDistOfFlowsFromNodesSlider").value,
		outText = document.getElementById("minDistOfFlowsFromNodesSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(0);
	model.setNodeTolerancePx(parseFloat(sliderVal));
};

Flox.checkFlowBoundingBoxesCheckboxClicked = function() {
	model.setCheckFlowBoundingBoxes(document.getElementById("checkFlowBoundingBoxesCheckbox").checked);
};


/**
 * Fires whenever the maxFlowWidthSlider is moved or clicked.
 * Gets the mapComponent to directly update the flow widths.
 */
// FIXME it might be better if this updated a value in the model?
// Right now the mapComponent directly accesses the slider, which will
// break if I change the slider at all. 
Flox.maxFlowWidthSliderOninput = function() {
	var sliderVal = document.getElementById("maxFlowWidthSlider").value,
		outText = document.getElementById("maxFlowWidthSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(1);
	model.setMaxFlowWidth(parseFloat(sliderVal));
	mapComponent.resizeFlows();
};

/**
 * Fires whenever the maxNodeRadiusSlider is moved or clicked.
 * Gets the mapComponent to directly update the node size.
 */
Flox.maxNodeRadiusSliderOninput = function() {
	var sliderVal = document.getElementById("maxNodeRadiusSlider").value,
		outText = document.getElementById("maxNodeRadiusSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(1);
	model.setMaxNodeRadius(parseFloat(sliderVal));
	mapComponent.resizePoints();
};

Flox.showFlowPointsCheckboxClicked = function() {
	var boo = document.getElementById("showFlowPointsCheckbox").checked;
	model.setDrawIntermediateFlowPoints(boo);
	refreshMap();
};

Flox.showControlPointsCheckboxClicked = function() {
	model.setDrawControlPoints(document.getElementById("showControlPointsCheckbox").checked);
	refreshMap();
};

Flox.showForceAnimationCheckboxClicked = function () {
	var boo = document.getElementById("showForceAnimationCheckbox").checked;
	model.setShowForceAnimation(boo);
};

Flox.isDrawControlPoints = function() {
	return model.isDrawControlPoints();
};

Flox.showRangeboxesCheckboxClicked = function() {
    model.setDrawRangeboxes(document.getElementById("showRangeboxesCheckbox").checked);
    refreshMap();
};

Flox.moveFlowsIntersectingNodesCheckboxClicked = function() {
	var boo = document.getElementById("moveFlowsIntersectingNodesCheckbox").checked;
	model.setMoveFlowsIntersectingNodes(boo);
};

Flox.multipleIterationsCheckboxClicked = function() {
	var boo = document.getElementById("multipleIterationsCheckbox").checked;
	model.setMultipleIterations(boo);
};




Flox.flowDistanceFromStartPointTextBoxOnkeypress = function(e) {
	var evt = e || window.event,
		charCode = evt.which || evt.keyCode,
		textBox, val;
	if ( charCode === 13 ) {
      console.log("enter pressed");
      updateFlowDistanceFromStartPointTextBox();
		
    }
};

Flox.flowDistanceFromEndPointTextBoxOnkeypress = function(e) {
	var evt = e || window.event,
		charCode = evt.which || evt.keyCode,
		textBox, val;
	if ( charCode === 13 ) {
      console.log("enter pressed");
      updateFlowDistanceFromEndPointTextBox();
    }
};

Flox.updateFlowDistanceFromStartPointTextBox= function() {
	updateFlowDistanceFromStartPointTextBox();
};

Flox.updateFlowDistanceFromEndPointTextBox= function() {
	updateFlowDistanceFromEndPointTextBox();
};


// -----------> ARROW STUFF


Flox.addArrowsCheckboxClicked = function() {
	var boo = document.getElementById("addArrowsCheckbox").checked;
	model.setDrawArrows(boo);
	refreshMap();
};

Flox.arrowLengthSliderOninput = function() {
	var sliderVal = document.getElementById("arrowLengthSlider").value,
		outText = document.getElementById("arrowLengthSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(2);
	model.setArrowLengthScaleFactor(parseFloat(sliderVal));
	refreshMap();
};

Flox.arrowWidthSliderOninput = function() {
	var sliderVal = document.getElementById("arrowWidthSlider").value,
		outText = document.getElementById("arrowWidthSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(2);
	model.setArrowWidthScaleFactor(parseFloat(sliderVal));
	refreshMap();
};

Flox.arrowEdgeCtrlPointLengthSliderOninput = function() {
	var sliderVal = document.getElementById("arrowEdgeCtrlPointLengthSlider").value,
		outText = document.getElementById("arrowEdgeCtrlPointLengthSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(2);
	model.setArrowEdgeCtrlLength(parseFloat(sliderVal));
	refreshMap();
};

Flox.arrowEdgeCtrlPointWidthSliderOninput = function() {
	var sliderVal = document.getElementById("arrowEdgeCtrlPointWidthSlider").value,
		outText = document.getElementById("arrowEdgeCtrlPointWidthSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(2);
	model.setArrowEdgeCtrlWidth(parseFloat(sliderVal));
	refreshMap();
};

Flox.arrowCornerPositionSliderOninput = function() {
	var sliderVal = document.getElementById("arrowCornerPositionSlider").value,
		outText = document.getElementById("arrowCornerPositionSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(2);
	model.setArrowCornerPosition(parseFloat(sliderVal));
	refreshMap();
};

Flox.arrowSizeRatioSliderOninput = function() {
	var sliderVal = document.getElementById("arrowSizeRatioSlider").value,
		outText = document.getElementById("arrowSizeRatioSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(2);
	model.setArrowSizeRatio(parseFloat(sliderVal));
	refreshMap();
};

Flox.arrowLengthRatioSliderOninput = function() {
	var sliderVal = document.getElementById("arrowLengthRatioSlider").value,
		outText = document.getElementById("arrowLengthRatioSliderOutputText");
	outText.innerHTML = parseFloat(sliderVal).toFixed(2);
	model.setArrowLengthRatio(parseFloat(sliderVal));
	refreshMap();
};

Flox.updateTextBoxes = function () {
	
		// Get an array of selected nodes.
	var selectedNodes = model.getSelectedNodes(),
	
		// Get an array of selected flows.
		selectedFlows = model.getSelectedFlows(),
		
		flowValueTextBox = $("#flowValueTextBox"),
		flowStartPointTextBox = $("#flowStartPointTextBox"),
		flowEndPointTextBox = $("#flowEndPointTextBox"),
		flow;
	
	if (selectedFlows.length === 1) {
		flow = selectedFlows[0];
		flowValueTextBox.val(flow.getValue());
		flowStartPointTextBox.val(flow.getStartPt().id);
		flowEndPointTextBox.val(flow.getEndPt().id);
	} else {
		flowValueTextBox.val("");
	}
};


// Here is an example of how jQuery can maybe help!
// Adds an event to the editModeCheckbox that does a thing, 
// rather than clicking on the checkbox calling a function. 
// It makes the HTML a bit cleaner by removing onclick events. 
$("#editModeCheckbox").change(function() {
	editMode = this.checked;
	if(editMode) {
		$("#editTab").removeClass("disabled");
	} else {
		$("#editTab").addClass("disabled");
	}
	refreshMap();
});

$("#skipEndPointsCheckbox").change(function() {
	skipEndPoints = this.checked;
	console.log(skipEndPoints);
});


$("#telecomMenuItem").click(function() {
	importTelecomData();
});

$("#usBetweenStateMigrationMenuItem").click(function() {
	importCensusData();
});

$("#clearAllDataMenuItem").click(function() {
	model.deleteAllFlows();
	refreshMap();
});

$("#maxFlowsSlider").change(function() {
	model.setMaxFlows(this.value);
	layoutFlows();
	//refreshMap();
}).on("input", function() {
	var outputText = document.getElementById("maxFlowsSliderOutputText");
	outputText.innerHTML = parseFloat(this.value).toFixed(0);
});

$("#showNetFlowsCheckbox").change(function() {
	
	// Inform the model
	model.setUseNetFlows(this.checked);
	layoutFlows();
	refreshMap();
});


// $("#maxFlowsSlider").on("input", function() {
	// var outputText = document.getElementById("maxFlowsSliderOutputText");
	// outputText.innerHTML = parseFloat(this.value).toFixed(0);
// });

// Flox.editModeCheckboxClicked = function () {
	// var editMode = document.getElementById("editModeCheckbox").checked;
	// if(editMode) {
		// $("#editTab").removeClass("disabled");
	// } else {
		// $("#editTab").addClass("disabled");
	// }
	// refreshMap(); // map is refreshed in order to apply d3 drag listeners to
// };

//---------------------------END GUI STUFF--------------------------------------



Flox.getCtrlPts = function() {
	return model.getCtrlPts();
};

Flox.addFlow = function(flow) {
	
	// Give the control point a latLng
	var cPt = flow.getCtrlPt(),
		latLng;
	
	latLng = mapComponent.layerPtToLatLng([cPt.x, cPt.y]);
	cPt.lat = latLng.lat;
	cPt.lng = latLng.lng;

    model.addFlow(flow);
};

Flox.getPoints = function() {
	return model.getPoints();
};

Flox.getFlows = function() {
	return model.getFlows();
};

Flox.deleteAllFlows = function() {
	model.deleteAllFlows();
	refreshMap();
};

// FIXME there are often times more than one point at the same location.
Flox.deleteSelectedFeatures = function() {
	// Loop through points, deleting the selected ones. Will cause problems.
	var points = model.getPoints(),
		i, j;
	
	for (i = 0, j = points.length; i < j; i += 1) {
		if (points[i].selected) {
			// delete that shit
			// somehow.
			model.deletePoint(points[i]);
		}
	}
    refreshMap();
};

Flox.getFlowsIntersectingNodes = function() {
	var flows = model.getFlows(),
		intersectingFlows = [],
		i, j, flow;
		
	for(i = 0, j = flows.length; i < j; i += 1) {
		flow = flows[i];
		if (Flox.GeomUtils.flowIntersectsANode(flow)) {
			//console.log("found a flow intersecting a node!")
			intersectingFlows.push(flows[i]);
		}
	}
	return intersectingFlows;
};

Flox.flowIntersectsANode = function(flow) {
	return Flox.GeomUtils.flowIntersectsANode(flow);
};

Flox.moveFlowIntersectingANode = function(flow) {
	Flox.GeomUtils.moveFlowIntersectingANode(flow);
};

/**
 * Convert a latLng object into a Point object
 * @param {Object} latLng {lat: latitude, lng: longitude}
 */
Flox.latLngToPoint = function(latLng) {
	return new Flox.Point(latLng.lng, latLng.lat);
};

// A quick way of making a simple point object.
// Defines latLng AND xy!
Flox.Point = function(lat, lng, val, id) {
	this.lat = lat;
	this.lng = lng;
	if(val){
		this.value = val;
	} else {
		this.value = 1;
	}
	if(id) {
		this.id = id;
	}
	this.x = mapComponent.latLngToLayerPt([lat,lng]).x;
	this.y = mapComponent.latLngToLayerPt([lat,lng]).y;
};

Flox.rotatePoint = function(pt, origin, angle) {
	return Flox.GeomUtils.rotatePoint(pt, origin, angle);
};

Flox.getFlowDistanceFromStartPointPixel = function() {
	return model.getFlowDistanceFromStartPointPixel();
};

Flox.setFlowDistanceFromStartPointPixel = function (d) {
	model.setFlowDistanceFromStartPointPixel(d);
};

Flox.getFlowDistanceFromEndPointPixel = function() {
	return model.getFlowDistanceFromEndPointPixel();
};

Flox.setFlowDistanceFromEndPointPixel = function (d) {
	model.setDistanceFromEndPointPixel(d);
};

Flox.isDrawArrows = function () {
	return model.isDrawArrows();
};

Flox.configureArrows = function () {
	model.configureArrows();
};

// Happens when a map zoom begins. 
Flox.zoomstart = function() {
	
	var progress = document.getElementById("layoutProgressBar");
	
	console.log("zoom started");
	// Kill the layoutWorker!
	if(layoutWorker) {
		layoutWorker.terminate();
	}
	
	progress.value = 0;
	progress.style.visibility = "hidden";
};

Flox.getDrawSettings = function() {
	return model.getDrawSettings();
};

Flox.deselectAllFeatures = function() {
	console.log("deselecting all features");
	model.deselectAllFeatures();
	refreshMap();
};

Flox.isEditMode = function () {
	return editMode;
};

Flox.getFlowGrid = function () {
	return flowGrid;
};

Flox.getNodeGrid = function () {
	return nodeGrid;
};

Flox.runLayoutWorker = function () {
	runLayoutWorker();
};

Flox.isSkipEndPoints = function () {
	return skipEndPoints;
};

Flox.importCensusData = function () {
	importCensusData();
};

Flox.setFilteredFlows = function (n) {
	model.setFilteredFlows(n);
	model.updateCachedValues();
};

Flox.sortFlows = function (property) {
	model.sortFlows(property);
};

Flox.initFlox = function() {
	model = new FloxModel();
	mapComponent = new Flox.MapComponent_Leaflet();
	mapComponent.initMap();
	initGUI();
	// var p1 = {lat: 10, lng: 10},
		// p2 = {lat: 20, lng: 20},
		// p3 = {lat: 30, lng: 30},
		// p4 = {lat: 40, lng: 40},
		// xy1 = Flox.latLngToLayerPt(p1),
		// xy2 = Flox.latLngToLayerPt(p2),
		// xy3 = Flox.latLngToLayerPt(p3),
		// xy4 = Flox.latLngToLayerPt(p4),
		// flow1, flow2;
		// p1.x = xy1.x;
		// p1.y = xy1.y;
		// p2.x = xy2.x;
		// p2.y = xy2.y;
		// p3.x = xy3.x;
		// p3.y = xy3.y;
		// p4.x = xy4.x;
		// p4.y = xy4.y;
		// flow1 = new Flow(p1, p2, 10);
		// flow2 = new Flow(p3, p4, 10);
	// model.addFlow(flow1);
	// model.addFlow(flow2);
	
	mapComponent.drawFeatures();
};


}($, L, d3, Flow, window, document, undefined));
