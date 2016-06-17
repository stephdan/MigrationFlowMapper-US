
var Flox = (function() {

"use strict";

var mapComponent,
    drawRangeboxes = false,
    drawControlPoints = false,
    editMode = true,
    // drawIntermediateFlowPoints = false,
    layoutWorker,
    filterWorker,
    skipEndPoints = false,
    flowGrid = null,
	nodeGrid = null,
	
	filterSettings = {
		
		netFlows : true,
		
		inStateFlows: true,
		outerStateFlows: false,
		countyIncoming: true,
		countyOutgoing: true,
		
		selectedCounty: false,
		selectedState: false,
		
		countyMode: false,
		stateMode: false
		
	},
	
	model_master,
	derivedModels = {},
	startTimeAll, endTimeAll,
	my = {};
    


    
function refreshMap(model_copy) {
	if(!model_copy) {
		throw new Error("refreshMap needs a model passed in");
	}
    mapComponent.drawFeatures(model_copy);
}

// TODO If the browser can't do webworkers, then webworkers shouldn't be used.
function initLayoutWorker(modelCopy, callback) {

	Flox.GUI.updateLayoutProgressBar(0);
	Flox.GUI.showLayoutProgressBar();
	
	var flows,
		ctrlPts,
		flow, flowCPt, 
		i, j, latLng, progress;
		//progress = document.getElementById("layoutProgressBar");
		//progress.style.visibility = "visible";
	
	// If webworkers are compatible with this browser...
	if (window.Worker) {
	
		// If a layouter worker currently exists, call terminate on it. 
		// If it was in the middle of something, it'll stop and do this
		// instead. If it wasn't doing anything, then this won't matter.
		if(layoutWorker) {
			layoutWorker.terminate();
		}
	
		// Web workers take a separate file. Note that the path is relative
		// to index.html, not Flox.js
		layoutWorker = new Worker("scripts/layoutWorker.js");
		
		// This happens when layoutWorker sends out a message
		layoutWorker.onmessage = function(e) {
			
			// TODO
			// Update the progress bar.
			Flox.GUI.updateLayoutProgressBar(e.data[1]);
			
			// Get the new control points
			ctrlPts = e.data[0];
			
			// grab the flows from the same model that was fed to the webworker.	
			flows = modelCopy.getFlows();
			
			// Update the map if the worker is returning new control point
			// locations (which it won't if it's just giving a progress update)
			if(ctrlPts) {
				
				for (i = 0, j = flows.length; i < j; i += 1) {
					flowCPt = flows[i].getCtrlPt();
					flowCPt.x = ctrlPts[i].x;
					flowCPt.y = ctrlPts[i].y;
					
					// Also update the latLngs of the cPts
					// TODO is this needed?
					latLng = mapComponent.layerPtToLatLng([ctrlPts[i].x, ctrlPts[i].y]);
					
					flowCPt.lat = latLng.lat;
					flowCPt.lng = latLng.lng;
				}
				// Run the callback function, which is typically refreshMap();
				Flox.GUI.updateLayoutProgressBar(100);
				Flox.GUI.hideLayoutProgressBar();
				callback();
			}
			
			//Flox.GUI.hideLayoutProgressBar();
			
			
		};	
	}
}

function runLayoutWorker(modelCopy, callback) {
	initLayoutWorker(modelCopy, callback);
	var modelJSON = modelCopy.toJSON();
	// Pass the layoutWorker the model. It will then perform the layout.
	layoutWorker.postMessage(modelJSON);
}

function initFilterWorker() {
	
	if (window.Worker) {
		if(filterWorker) {
			filterWorker.terminate();
		}
		
		filterWorker = new Worker("scripts/filterWorker.js");
		
		filterWorker.onmessage = function(e) {
			// e is what the worker passes back. What will it be?
				// Is will be the filtered model in json form. 
			// What to do with it?
				// Send it to wherever it needs to go I guess.
		}
	}	
}


function runFilterWorker() {
	var modelJSON = model_master.toJSON();
	modelJSON.filterSettings = filterSettings;
	initFilterWorker();
	filterWorker.postMessage(modelJSON);
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
	
	if (model.getFlows().length < 2) {
		console.log("there are fewer than 2 flows, not doing a layout");
		refreshMap(model);
		return;
	}
	
    var iterations = model.settings.NBR_ITERATIONS,
		initialLocks = model.getLocks(),
        startTime = performance.now(),
        layouter, endTime,
        i, j, weight;
        
	layouter = new Flox.FlowLayouter(model);

	// Straighten the flows
	layouter.straightenFlows();
	
	// Run the first half of iterations, without MFIN
    for (i = 0, j = Math.floor(iterations/2); i < j; i += 1) {
        weight = 1 - i/iterations;
        layouter.layoutAllFlows(weight);
    }
    
    // Run second half of iterations, with MFIN
    for (i = Math.floor(iterations/2); i < iterations; i += 1) {
        weight = 1 - i/iterations;
        layouter.layoutAllFlows(weight);
        if(model.settings.moveFlowsIntersectingNodes) {
			layouter.moveFlowsIntersectingNodes();
		}
    }
    
	model.applyLocks(initialLocks);
	endTime = performance.now();
	console.log("Layout time in milliseconds: " + Math.round(endTime - startTime));
}

function importStateToStateMigrationFlows() {
	// clear the model
    model_master.deleteAllFlows();
    derivedModels = {};
    mapComponent.hideAllCountyBorders();
    mapComponent.removeAllFlows();
    mapComponent.removeNecklaceMap();
    mapComponent.zoomToFullExtent();
	filterSettings.stateMode = true;
	filterSettings.countyMode = false;
	model_master.settings.mapScale = 5; // FIXME hardcoded
	var nodePath = "data/census/state_latLng.csv",
		flowPath = "data/census/US_State_migration_2014_flows.csv";
	
	Flox.FlowImporter.importStateToStateMigrationFlows(flowPath, function(flows, stateNodes) {
		model_master.initNodes(stateNodes);
		model_master.addFlows(flows);
		//model_master.updateCachedValues();
		model_master.settings.datasetName = "states";
		my.updateMap();
	});
}

// This doesn't work without leaflet. 
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

my.importStateToStateMigrationFlows = function () {
	importStateToStateMigrationFlows();
};

my.loadTestFlows = function () {
	// make a few flows to test 
	importCSV("data/testFlows.csv");
};

my.importTotalCountyFlowData = function(stateFIPS) {		
	
	// erase all flows from the model.
	model_master.deleteAllFlows();
	
	filterSettings.selectedState = stateFIPS;
	
	derivedModels = {};
	// Set the mapScale in the model to the appropriate scale for this map.
	// This scale is used by the layouter!
	// Could it also be used by the renderer?
	// FIXME this is goofy
	model_master.setStateMapScale(stateFIPS);
	
	Flox.FlowImporter.importTotalCountyFlowData(stateFIPS, function(flows, countyNodes){
		
		// flows are the imported flows!
		model_master.initNodes(countyNodes);
		model_master.addFlows(flows);
		//model_master.updateCachedValues(); // this gets done after filtering
		model_master.settings.datasetName = "FIPS" + Number(stateFIPS);
		
		my.updateMap();	
		
	});
};

my.getMapScale = function () {
	return mapComponent.getMapScale();
};

my.rotateProjection = function(lat, lng, roll) {
	mapComponent.rotateProjection(lat, lng, roll);
};

/**
 * Filter the provided model according to the current filterSettings
 */
my.filterBySettings = function(m) {
	var filteredModel;
	//my.logFlows(model_master);
	filteredModel = new Flox.ModelFilter(m).filterBySettings(filterSettings);
	
	return filteredModel;  
};

/**
 * Filters, performs layout, and displays the model according to current settings.
 */
my.updateMap = function() {
	
	var filteredModel;
	//my.logFlows(model_master);
	filteredModel = my.filterBySettings(model_master);
	
	if(filterSettings.stateMode === false) {
		mapComponent.configureNecklaceMap(filteredModel);
	}
	
	//my.logFlows(filteredModel);
	//new Flox.FlowLayouter(filteredModel).straightenFlows();
	//layoutFlows(filteredModel);
	//refreshMap(filteredModel);
	runLayoutWorker(filteredModel, function() {
		refreshMap(filteredModel);
	});	
};

my.getFilterSettings = function() {
	return filterSettings;
};

/**
 * Loops over the filterSettings, changing the ones specified in settings.
 * @param {Object} settings - Key value pair(s) of filterSettings to change.
 */
my.setFilterSettings = function(settings) {
	var prop;
	for (prop in settings) {
		if(settings.hasOwnProperty(prop)) {
			if (filterSettings.hasOwnProperty(prop)) {
				filterSettings[prop] = settings[prop];
			}
		}
	}
};

my.setDerivedModels = function(newModels) {
	var param;
	
	for(param in newModels) {
		if(newModels.hasOwnProperty(param)) {
			if(!derivedModels.hasOwnProperty(param)) {
				derivedModels[param] = newModels[param];
			}
		}
	}
};

my.getDerivedModel = function(requestedModel) {
	if(derivedModels.hasOwnProperty(requestedModel)) {
		return derivedModels[requestedModel];
	} else {
		return false;
	}
};

/**
 * Returns the appropriate derived model based on the current filter settings.
 */
my.getActiveFullModel = function() {
	if(filterSettings.netFlows) {
		return derivedModels.netFlowsModel;
	}
	return derivedModels.totalFlowsModel;
};

my.getAllDerivedModels = function() {
	return derivedModels;
};

my.selectState = function(stateFIPS) {
	mapComponent.selectState(stateFIPS);
};


my.enterClickAStateMode = function() {
	// Turn all the polygons gray
	mapComponent.reset();
	mapComponent.resetStateFillColor();
};

my.initFlox = function() {
	
	var starterModel = new Flox.Model(), 
		jsonPath = "data/JSON/stateToStateFlowsLayout.json",
		flowPath = "data/census/US_State_migration_2014_flows.csv";
	
	model_master = new Flox.Model();
	mapComponent = new Flox.MapComponent_d3();
	mapComponent.initMap();
	
	filterSettings.stateMode = true;
	
	// Load the entire state-to-state dataset.
	// Wouldn't it be better to have some premade JSON of this model?
	// FIXME this is resulting in the start and end points being askew somehow.
	Flox.FlowImporter.importStateToStateMigrationFlows(flowPath, function(flows, stateNodes) {
		model_master.initNodes(stateNodes);
		model_master.addFlows(flows);
		model_master.updateCachedValues();
		model_master.settings.mapScale = 5;
		model_master.settings.datasetName = "states";
		my.filterBySettings(model_master);
		
		d3.json(jsonPath, function(d) {
			starterModel.deserializeModelJSON(d);
			
			starterModel.configureArrows();
			//layoutFlows(starterModel);
			mapComponent.drawFeatures(starterModel);
		});
	});
	//importStateToStateMigrationFlows();
};


// DEBUG STUFF-------------------------------------

my.logFlows = function(model) {
	model.sortFlows();
	var flows = model.getAllFlows(),
	i, j, f;
	
	for (i = 0, j = flows.length; i < j; i += 1) {
		f = flows[i];
		console.log(f.getValue() + " : " 
		+  f.getStartPt().name + ", " + f.getStartPt().STUSPS + " to " 
		+  f.getEndPt().name + ", " + f.getEndPt().STUSPS);
	}
};

my.logModel_master = function() {
	model_master.sortFlows();
	var flows = model_master.getAllFlows(),
	i, j, f;
	for (i = 0, j = flows.length; i < j; i += 1) {
		f = flows[i];
		console.log(f.getValue() + " : " 
		+  f.getStartPt().name + ", " + f.getStartPt().STUSPS + " to " 
		+  f.getEndPt().name + ", " + f.getEndPt().STUSPS);
	}
	
};

my.getObstacles = function(model) {
	var layouter = new Flox.FlowLayouter(model);
	return layouter.getObstacles();
};

my.layoutFlows = function(m) {
	layoutFlows(m);
};

my.startTimer = function() {
	startTimeAll = performance.now();
};

my.endTimer = function() {
	endTimeAll = performance.now();
	console.log("TOTAL time in milliseconds: " + Math.round(endTimeAll - startTimeAll));
};
// END DEBUG STUFF-------------------------------------

return my;

}());
