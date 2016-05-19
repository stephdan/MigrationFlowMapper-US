
var Flox = (function() {

"use strict";

var mapComponent,
	model_master,
    drawRangeboxes = false,
    drawControlPoints = false,
    editMode = true,
    // drawIntermediateFlowPoints = false,
    layoutWorker,
    skipEndPoints = false,
    flowGrid = null,
	nodeGrid = null,
	
	filterSettings = {
		netFlows : true,
		inStateFlows: true,
		outerStateFlows: false
	},
	
	my = {};
    
function refreshMap(model_copy) {
	if(!model_copy) {
		throw new Error("refreshMap needs a model passed in");
	}
    mapComponent.drawFeatures(model_copy);
}

function initLayoutWorker(modelCopy, callback) {
	
	var flows,
		ctrlPts,
		flow, flowCPt, 
		i, j, latLng, progress;
		//progress = document.getElementById("layoutProgressBar");
		//progress.style.visibility = "visible";
	
	if (window.Worker) {
	
		if(layoutWorker) {
			layoutWorker.terminate();
		}
	
		// Web workers take a separate file. Note that the path is relative
		// to index.html, not Flox.js
		layoutWorker = new Worker("scripts/layoutWorker.js");
		
		// This happens when layoutWorker sends out a message
		layoutWorker.onmessage = function(e) {
			
			// progress.value = (e.data[1] / model.getIterations()) * 100;
			// if(((e.data[1] / model.getIterations()) * 100)===100) {
				// progress.style.visibility = "hidden";
			// }
			
			ctrlPts = e.data[0];			
			flows = modelCopy.getFlows();
			
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
				callback();
			}
		};	
	}
}

function runLayoutWorker(modelCopy, callback) {
	initLayoutWorker(modelCopy, callback);
	console.log("running layoutWorker");
	var modelJSON = modelCopy.toJSON();
	layoutWorker.postMessage(modelJSON);
}



function importCSV(path) {
    // clear the model
    model_master.deleteAllFlows();

    // import the new flows
    Flox.FlowImporter.importCSV(path);
    // FlowImporter redraws the map; if it was redrawn here, it would 
    // redraw before the CSV was read in all the way.
    // FIXME Could use a callback and draw them here.
}

/**
 * Sets up and calls each iteration of FlowLayouter.layoutAllFlows(weight)
 * with the appropriate weight.
 * Decreases the weight of each iteration. 
 * Calls moveFlowsIntersectingNodes() during second half of iterations.
 */
function layoutFlows(model) {

	//console.log("layoutFlows called");
	
	if (model.getFlows().length < 2) {
		console.log("there is less than 2 flows, not doing a layout");
		refreshMap(model);
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

	// Straighten the flows
	layouter.straightenFlows();
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
	//d3.select("#flowPointLayer").remove();
	//refreshMap(model);
	endTime = performance.now();
	console.log("Layout time in milliseconds: " + Math.round(endTime - startTime));
}


function importCensusData() {
	// clear the model
    model.deleteAllFlows();
	
	var nodePath = "data/census/state_latLng.csv",
		flowPath = "data/census/US_State_migration_2014_flows.csv";
	
	Flox.FlowImporter.importStateMigrationData(nodePath, flowPath);
	
	// move and zoom to the correct location
	//mapComponent.setView([39,-95], 4);
}

function importTelecomData() {
	importCSV("data/TeleGeographyMap_flows copy.csv");
	
	// move and zoom to the correct location
	mapComponent.setView([50,10], 4);
}


// PUBLIC =====================================================================

my.update = function() {
	mapComponent.update();
};


my.angleDif = function(startToCtrlAngle, fStartToCtrlAngle) {
	return Flox.GeomUtils.angleDif(startToCtrlAngle, fStartToCtrlAngle);
};

/**
 * Takes pixel coordinates, converts them to latLng, 
 * makes a Point, returns it.
 * lyrPt can be an array [x,y]
 */
my.pointFromLayerPt = function(lyrPt) {
	var latLng = mapComponent.layerPtToLatLng(lyrPt);
	return new Flox.Point(latLng.lng, latLng.lat);
};

/**
 * Convenience constructor for making a Flow when the location of
 * the control point is known. 
 * TODO Might not be optimal, since the default constructor
 * calculates a location for the cPt. 
 */
my.createFlowWithCPt = function(sPt, cPt, ePt, val) {
	var newFlow = new Flow(sPt, ePt, val);
	newFlow.setCtrlPt(cPt);
	return newFlow;
};

my.importCSV = function(path) {
    importCSV(path);
};


my.refreshMap = function(model_copy) {
    // redraw the flows
    refreshMap(model_copy);
};

my.getModel = function() {
    return model_master;
};

my.getDistanceBetweenPoints = function(p1, p2) {
    var squaredDist = Flox.GeomUtils.squaredDistanceBetweenPoints(p1, p2);
    return Math.sqrt(squaredDist);
};

my.latLngToLayerPt = function(latLng) {
    return mapComponent.latLngToLayerPt(latLng);
};

my.layerPtToLatLng = function(layerPt) {
    return mapComponent.layerPtToLatLng(layerPt);
};

my.layerPtToPoint = function(layerPt) {
    var latLng = mapComponent.layerPtToLatLng(layerPt);
    return new Flox.Point(latLng.lng, latLng.lat);
};

my.getDistanceToQuadraticBezierCurve = function (p0x, p0y, p1x, p1y, p2x, p2y, xy) {
	return Flox.GeomUtils.getDistanceToQuadraticBezierCurve(p0x, p0y, p1x, p1y, p2x, p2y, xy);
};

// Returns [x,y] of the midpoint between two points
my.midXYBetweenTwoPoints = function(p1, p2) {
    return Flox.GeomUtils.midXYBetweenTwoPoints(p1, p2);
};

// Returns a leaflet layer point between two points
my.midLayerPointBetweenTwoPoints = function(p1, p2) {
    var midPtCoords = Flox.GeomUtils.midXYBetweenTwoPoints(p1, p2);
    return L.point(midPtCoords[0], midPtCoords[1]);
};

my.linesIntersect = function(x1, y1, x2, y2, x3, y3, x4, y4) {
    return Flox.GeomUtils.linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4);
};

my.getLineLineIntersection = function(x1, y1, x2, y2, x3, y3, x4, y4) {
    return Flox.GeomUtils.getLineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4);
};

my.isDrawRangeboxes = function() {
	return drawRangeboxes;
};

my.runLayoutWorker = function() {
	runLayoutWorker();
};

/**
 * Convert a latLng object into a Point object
 * @param {Object} latLng {lat: latitude, lng: longitude}
 */
my.latLngToPoint = function(latLng) {
	return new Flox.Point(latLng.lng, latLng.lat);
};

// A quick way of making a simple point object.
// Defines latLng AND xy!
my.Point = function(lat, lng, val, id) {
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
	
	var xy = mapComponent.latLngToLayerPt(this);
	
	if(xy) {
		this.x = mapComponent.latLngToLayerPt(this).x;
		this.y = mapComponent.latLngToLayerPt(this).y;
	}
	this.incomingFlows = [];
	this.outgoingFlows = [];
};

my.rotatePoint = function(pt, origin, angle) {
	return Flox.GeomUtils.rotate(pt, origin, angle);
};

my.runLayoutWorker = function () {
	runLayoutWorker();
};

my.importCensusData = function () {
	importCensusData();
};

my.loadTestFlows = function () {
	// make a few flows to test 
	importCSV("data/testFlows.csv");
};

my.importTotalCountyFlowData = function(stateFIPS) {
	var nodePath = "data/geometry/centroids_counties_all.csv",
		flowPath = "data/census/flows/" + stateFIPS + "_net.csv",
		maxFlowsModel, mergedModel, filteredModel;
		
	// erase all flows from the model.
	model_master.deleteAllFlows();
	
	// Set the mapScale in the model to the appropriate scale for this map.
	// This scale is used by the layouter!
	// Could it also be used by the renderer?
	// FIXME this is goofy
	model_master.setStateMapScale(stateFIPS);
	
	Flox.FlowImporter.importTotalCountyFlowData(stateFIPS, function(flows, countyNodes){
		
		// flows are the imported flows!
		model_master.initNodes(countyNodes);
		model_master.addFlows(flows);
		model_master.setDatasetName("FIPS" + stateFIPS);
		console.log("data imported");
		
		filteredModel = new Flox.ModelFilter(model_master).filterBySettings(filterSettings);
		
		mapComponent.configureNecklaceMap(stateFIPS, filteredModel, function() {
			
			//my.logFlows(maxFlowsModel);
			
			layoutFlows(filteredModel);
			refreshMap(filteredModel);
				
			// runLayoutWorker(model_copy, function() {
				// refreshMap(model_copy);
			// });
		});
		
	});
};

my.showMergedFlows = function() {
	// Make a copy of the model, pass that into the other things.
	var model_copy = new Flox.ModelFilter(model_master).copyModel();
	
	mapComponent.configureNecklaceMap(model_copy, function() {
		
		model_copy = new Flox.ModelFilter(model_copy).mergeOutOfStateFlows();
		
		layoutFlows(model_copy);			
		// runLayoutWorker(model_copy, function() {
			// refreshMap(model_copy);
		// });
	});
};


my.getMapScale = function () {
	return mapComponent.getMapScale();
};

my.rotateProjection = function(lat, lng, roll) {
	mapComponent.rotateProjection(lat, lng, roll);
};

my.showNetFlows = function() {
	var netFlowsModel;
	
	filterSettings.netFlows = true;
	
	// Get netFlowsModel	
	netFlowsModel = new Flox.ModelFilter(model_master).filterBySettings(filterSettings);
	
	mapComponent.configureNecklaceMap(netFlowsModel, function() {
			
			layoutFlows(netFlowsModel);	
			refreshMap(netFlowsModel);		
			// runLayoutWorker(netFlowsModel, function() {
				// refreshMap(netFlowsModel);
			// });
	});
};

my.showTotalFlows = function() {
	
	var totalFlowsModel;
	filterSettings.netFlows = false;
	
	totalFlowsModel = new Flox.ModelFilter(model_master).filterBySettings(filterSettings);
	
	mapComponent.configureNecklaceMap(totalFlowsModel, function() {
			
			layoutFlows(totalFlowsModel);	
			refreshMap(totalFlowsModel);		
			
				
			// runLayoutWorker(model_master, function() {
				// refreshMap(model_master);
			// });
	});
};


my.initFlox = function() {
	model_master = new Flox.Model();
	mapComponent = new Flox.MapComponent_d3();
	mapComponent.initMap();
	//mapComponent.drawFeatures();
	//initGUI(); // no GUI yet!
	
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
};


// DEBUG STUFF-------------------------------------

my.logFlows = function(model) {
	var flows = model.getAllFlows(),
	i, j, f;
	
	for (i = 0, j = flows.length; i < j; i += 1) {
		f = flows[i];
		console.log(f.getValue() + " : " 
		+  f.getStartPt().name + ", " + f.getStartPt().STUSPS + " to " 
		+  f.getEndPt().name + ", " + f.getEndPt().STUSPS);
	}
};

my.layoutFlows = function(m) {
	layoutFlows(m);
};

// END DEBUG STUFF-------------------------------------

return my;

}());
