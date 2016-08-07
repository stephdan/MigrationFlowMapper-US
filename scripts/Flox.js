
var Flox = (function() {

"use strict";

var mapComponent,
    layoutWorker,
    filterWorker,
    importWorker,
    model_master,
	
	filterSettings = {
		flowType: "net",
		inStateFlows: true,
		outerStateFlows: true,
		selectedCounty: false,
		selectedState: false,
		countyMode: false,
		stateMode: false,
		selectedFeatureName: false
	},
	startTimeAll, 
	endTimeAll,
	my = {};

function refreshMap(model_copy) {
	if(!model_copy) {
		throw new Error("refreshMap needs a model passed in");
	}
    mapComponent.drawFeatures(model_copy);
}

function terminateWorkers() {
	if (importWorker) {importWorker.terminate();}
	if (filterWorker) {filterWorker.terminate();}
	if (layoutWorker) {layoutWorker.terminate();}
}

// TODO If the browser can't do webworkers, then webworkers shouldn't be used.
function initLayoutWorker(modelCopy, callback) {
	var flows,
		ctrlPts,
		flow, flowCPt, 
		i, j, latLng, progress;
	// If webworkers are compatible with this browser...
	if (window.Worker) {
		// If a layouter worker currently exists, call terminate on it. 
		// If it was in the middle of something, it'll stop and do this
		// instead. If it wasn't doing anything, then this won't matter.
		if(layoutWorker) {layoutWorker.terminate();}
		
		// Web workers take a separate file. Note that the path is relative
		// to index.html, not Flox.js
		layoutWorker = new Worker("scripts/layoutWorker.js");
		
		// This happens when layoutWorker sends out a message
		layoutWorker.onmessage = function(e) {
			var progress;
			
			// progress is 50 plus 
			
			
			// Update the progress bar.
			Flox.GUI.updateLayoutProgressBar(50 + (e.data[1]/2));
			
			// Get the new control points
			ctrlPts = e.data[0];
			
			// grab the flows from the same model that was fed to the webworker.	
			flows = modelCopy.getLargestFlows();
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
				callback();
			}
			if(e.data[1] === 100) {
				Flox.GUI.hideLayoutProgressBar();
			}
		};	
	}
}

function runLayoutWorker(modelCopy, callback) {
	initLayoutWorker(modelCopy, callback);
	// Need the model json to only be for top 50 flows.	
	var largestFlowsModel = new Flox.Model(),
		modelJSON;
	largestFlowsModel.updateSettings(modelCopy.settings);
	largestFlowsModel.addFlows(modelCopy.getLargestFlows());
	modelJSON = largestFlowsModel.toJSON();
	// Pass the layoutWorker the modelJSON. It will then perform the layout.
	layoutWorker.postMessage(modelJSON);
}

function initFilterWorker(callback) {
	if (window.Worker) {
		if (filterWorker) {filterWorker.terminate();}
		filterWorker = new Worker("scripts/filterWorker.js");
		filterWorker.onmessage = function(e) {
			var filteredModel = new Flox.Model();
			filteredModel.deserializeModelJSON(e.data);	
			callback(filteredModel);
		};
	}	
}

function runFilterWorker(callback) {
	var modelJSON = model_master.toJSON();
	modelJSON.filterSettings = filterSettings;
	initFilterWorker(callback);
	filterWorker.postMessage(modelJSON);
}

function initImportWorker(callback) {
	if(window.Worker) {
		if (importWorker) {importWorker.terminate();}
		importWorker = new Worker("importWorker.js");
		importWorker.onmessage = function(e) {	
			// update progress bar
			Flox.GUI.updateLayoutProgressBar(30);
			
			// Send the imported data to whoever called runImportWorker
			callback(e.data);
		}
	}	
}

function runImportWorker(stuffImportWorkerNeeds, callback) {
	Flox.GUI.showLayoutProgressBar();
	Flox.GUI.updateLayoutProgressBar(10);
	initImportWorker(callback);

	// post a message to the import worker
	importWorker.postMessage(stuffImportWorkerNeeds);
}

/**
 * Sets up and calls each iteration of FlowLayouter.layoutAllFlows(weight)
 * with the appropriate weight.
 * Decreases the weight of each iteration. 
 * Calls moveFlowsIntersectingNodes() during second half of iterations.
 * NOTE: this is run only if webworkers are not enabled or available
 */
function layoutFlows(model) {
	
	console.log("Laying out " + model.getFlows().length + " flows...");
	
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
	
	console.log("Running layout iterations, please wait...")
	
	// Run the first half of iterations, without MFIN
    for (i = 0, j = Math.floor(iterations/2); i < j; i += 1) {
		//console.log("Layout Iteration " + (i + 1));
        weight = 1 - i/iterations;
        layouter.layoutAllFlows(weight);
    }
    
    console.log("Half of layout interations complete, keep waiting...")
    
    // Run second half of iterations, with MFIN
    for (i = Math.floor(iterations/2); i < iterations; i += 1) {
		//console.log("Layout Iteration " + (i + 1));
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

function importStateToStateMigrationFlows(keepSelectedState) {
	// clear the model
	terminateWorkers();
    model_master.deleteAllFlows();
    mapComponent.hideAllCountyBorders();
    mapComponent.removeAllFlows();
    mapComponent.removeNecklaceMap();
    mapComponent.zoomToFullExtent();
	// filterSettings.stateMode = true;
	// filterSettings.countyMode = false;
	model_master.settings.scaleMultiplier = 4; // FIXME hardcoded
	model_master.settings.datasetName = "states";
	
	if(!keepSelectedState) {
		filterSettings.selectedState = false;
	}
	
	var flowPath = "data/census/US_state_migration_2013_flows.csv",
		stuffImportWorkerNeeds = {};
	
	
	stuffImportWorkerNeeds.flowPath = flowPath;
	stuffImportWorkerNeeds.settings = model_master.settings;
	
	if(window.Worker && model_master.settings.useWebworkers) {
		runImportWorker(stuffImportWorkerNeeds, function(d) {
			model_master.deserializeModelJSON(d);
			my.updateMap();
		});
	} else {
		console.log("Browser cannot use webworkers. UI will be locked during computations.");
		console.log("Importing state-to-state flows...");
		Flox.FlowImporter.importStateToStateMigrationFlows(flowPath, function(flows, stateNodes) {
			model_master.initNodes(stateNodes);
			model_master.addFlows(flows);
			my.updateMap();
		});
	}
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

my.assignXYToNodes = function(nodes) {
	var i, node, xy;
	for(i = 0; i < nodes.length; i += 1) {
		node = nodes[i];
		xy = mapComponent.latLngToLayerPt(node);
		if(xy) {
			node.x = xy.x;
			node.y = xy.y;
		} else {
			console.log("Couldn't project one of the nodes, ID :" + node.id);
		}
	}
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
	this.incomingFlows = [];
	this.outgoingFlows = [];
};

my.rotatePoint = function(pt, origin, angle) {
	return Flox.GeomUtils.rotate(pt, origin, angle);
};

my.runLayoutWorker = function () {
	runLayoutWorker();
};

my.importStateToStateMigrationFlows = function (keepSelectedState) {
	importStateToStateMigrationFlows(keepSelectedState);
};

my.importTotalCountyFlowData = function(stateFIPS) {		
	terminateWorkers();
	
	var stuffImportWorkerNeeds = {};
	
	// erase all flows from the model.
	model_master.deleteAllFlows();

	
	filterSettings.selectedState = stateFIPS;
	
	// Set the mapScale in the model to the appropriate scale for this map.
	// This scale is used by the layouter!
	// Could it also be used by the renderer?
	// FIXME this is goofy
	model_master.setScaleMultiplierByState(stateFIPS);
	model_master.settings.datasetName = "FIPS" + Number(stateFIPS);
	
	if(window.Worker && model_master.settings.useWebworkers) {
		stuffImportWorkerNeeds.settings = model_master.settings;
		stuffImportWorkerNeeds.stateFIPS = stateFIPS;
		
		runImportWorker(stuffImportWorkerNeeds, function(d) {
			model_master.deserializeModelJSON(d);
			my.updateMap();
		});
	} else {
		console.log("Browser cannot use webworkers. UI will be locked during computations.");
		console.log("Importing county flows...");
		Flox.FlowImporter.importTotalCountyFlowData(stateFIPS, function(flows, countyNodes){
			model_master.initNodes(countyNodes);
			model_master.addFlows(flows);
			my.updateMap();	
		});
	}
	
	
	
	
	
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
my.filterBySettings = function(m, settings) {
	var filteredModel;
	//my.logFlows(model_master);
	filteredModel = new Flox.ModelFilter(m).filterBySettings(settings);
	
	return filteredModel;  
};

/**
 * Filters, performs layout, and displays the model according to current settings.
 */
my.updateMap = function() {
	// There should be no workers running right now.
	terminateWorkers();
	mapComponent.clearAllMapFeatures();
	
	Flox.GUI.showLayoutProgressBar();
	// Good time to assign xy coordinates to nodes.
	my.assignXYToNodes(model_master.getPoints());

	// This if statement is here for debug just to make it easier to turn
	// off webworkers in order to run performace tests. 
	// TODO Eventually, it might be nice to have the ability to not use 
	// webworkers if the browser is not compatible with them. 
	// FIXME Something is broken when not using webworkers. 
	Flox.GUI.updateGUI();
	if(window.Worker && model_master.settings.useWebworkers) {
		Flox.GUI.updateLayoutProgressBar(35);
		runFilterWorker(function(filteredModel) {
			Flox.GUI.updateLayoutProgressBar(50);
			// configure the needed variables to get only above average flows.
			filteredModel.setAboveAverageFlowCount();
			if(filterSettings.stateMode === false &&
				filterSettings.selectedState !== false) {
				mapComponent.configureNecklaceMap(filteredModel);
			}
			mapComponent.enableTooltip();
			runLayoutWorker(filteredModel, function() {
				
				refreshMap(filteredModel);
			});	
		});
	} else {
		
		// TODO throw up a "please wait" sign
		var filteredModel, 
			largestFlowsModel = new Flox.Model(), i, oldFlows, newFlows, oldCPt, 
			newCPt;
		filteredModel = my.filterBySettings(model_master, filterSettings);
		if(filterSettings.stateMode === false) {
			mapComponent.configureNecklaceMap(filteredModel);
		}
		largestFlowsModel.updateSettings(filteredModel.settings);
		largestFlowsModel.addFlows(filteredModel.getLargestFlows());
		
		layoutFlows(largestFlowsModel);
		
		oldFlows = filteredModel.getLargestFlows();
		newFlows = largestFlowsModel.getFlows();
		
		// change the locations of the control points in the filtered model.
		for(i = 0; i < newFlows.length; i += 1) {
			oldCPt = oldFlows[i].getCtrlPt();
			newCPt = newFlows[i].getCtrlPt();
			oldCPt.x = newCPt.x;
			oldCPt.y = newCPt.y;
		}
		// TODO take down the "please wait" sign
		refreshMap(largestFlowsModel);
	}
};

// my.getFilterSettings = function() {
	// return filterSettings;
// };

/**
 * Loops over the filterSettings, changing the ones specified in settings.
 * @param {Object} settings - Key value pair(s) of filterSettings to change.
 */
// my.setFilterSettings = function(settings) {
	// var prop;
	// for (prop in settings) {
		// if(settings.hasOwnProperty(prop)) {
			// if (filterSettings.hasOwnProperty(prop)) {
				// filterSettings[prop] = settings[prop];
			// }
		// }
	// }
// };

my.getFlowType = function() {
	return filterSettings.flowType;
};

my.setFlowType = function(newSetting){
	var possibleSettings = ["net", "total", "incoming", "outgoing"];
	if(possibleSettings.indexOf(newSetting) < 0) {
		throw new Error("Not a possible setting for flowType: " + newSetting);
	}
	
	filterSettings.flowType = newSetting;
	
	if(newSetting === "total"){
		model_master.settings.drawArrows = false;
	} else {
		model_master.settings.drawArrows = true;
	}
};

// state is false if no state is selected
my.getSelectedState = function() {
	return filterSettings.selectedState;
};

// state is false if no state is selected
my.setSelectedState = function(state) {
	var flowType;
	// if state is false, we gotta do some stuff. 
	if(state === false) {
		flowType = my.getFlowType();
		if(flowType === "incoming" || flowType === "outgoing") {
			my.setFlowType("total");
		}
	}
	
	filterSettings.selectedState = state;
	Flox.GUI.updateFlowTypeRadioButtons();
};

my.getSelectedCounty = function() {
	return filterSettings.selectedCounty;
};

my.setSelectedCounty = function(county) {
	var flowType;
	if(county === false) {
		flowType = my.getFlowType();
		if(flowType === "incoming" || flowType === "outgoing") {
			my.setFlowType("total");
		}
	}
	filterSettings.selectedCounty = county;
	
	Flox.GUI.updateFlowTypeRadioButtons();
	
};

my.getSelectedFeatureName = function() {
	return filterSettings.selectedFeatureName;
};

my.setSelectedFeatureName = function(newSelectedFeatureName) {
	filterSettings.selectedFeatureName = newSelectedFeatureName;
};

my.isCountyMode = function() {
	return filterSettings.countyMode;
};

my.setCountyMode = function(boo) {
	filterSettings.countyMode = boo;
};

my.isStateMode = function() {
	return filterSettings.stateMode;
};

my.setStateMode = function(boo) {
	filterSettings.stateMode = boo;
};

my.selectState = function(stateFIPS) {
	mapComponent.selectState(stateFIPS);
};

my.isOuterStateFlows = function() {
	return filterSettings.outerStateFlows;
};

my.setOuterStateFlows = function(boo) {
	filterSettings.outerStateFlows = boo;
};

my.isInStateFlows = function() {
	return filterSettings.inStateFlows;
};

my.setInStateFlows = function(boo) {
	filterSettings.inStateFlows = boo;
};



my.enterClickAStateMode = function() {
	// Turn all the polygons gray
	mapComponent.reset();
	mapComponent.resetStateFillColor();
};

my.initFlox = function() {

	Flox.GUI.updateGUI();
	model_master = new Flox.Model();
	mapComponent = new Flox.MapComponent_d3();
	mapComponent.initMap();
	
	filterSettings.stateMode = true;
	
	importStateToStateMigrationFlows();
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

my.getNodeCoordinates = function() {
	var nodes = model_master.getPoints(),
		coords = [], i;
		
	for (i = 0; i < nodes.length; i += 1) {
		coords.push([nodes[i].x, nodes[i].y]);
	}
	return coords;
 };

my.getPopulationDensityColor = function() {
	return mapComponent.getPopulationDensityColor();
};

my.enableTooltip = function() {
	mapComponent.enableTooltip();
};

my.disableTooltip = function() {
	mapComponent.disableTooltip();
};

// END DEBUG STUFF-------------------------------------

return my;

}());
