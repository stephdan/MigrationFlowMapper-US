/*
 * Author: Daniel Stephen, daniel.macc.stephen@gmail.com
 * Date: September, 2016
 * This code was created as part of my masters thesis at Oregon State University.
 * Please contant me before using any code from this application.
 * 
 * The following code is for an interactive flow map depicting US county-to-
 * county migration. It uses a new algorithmic method of arranging flow curves
 * in a manner that adheres to cartographic principles for origin-destination
 * flow maps that improve readability and aesthetics. 
 * 
 * The following Javascript libaries are used in the creation of this map:
 * 
 *    D3.js
 *    TopoJSON.js
 *    jQuery
 *    Bootstrap
 *    simple_statistics.js
 * 
 * The code is written in a similar pattern to the one described here:
 *    http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
 */

/*
 * "Flox" is the primary namespace for the application, and includes several 
 * sub-modules, including:
 *    Flox.Model
 *    Flox.ModelFilter
 *    Flox.MapComponent_d3
 *    Flox.GUI
 *    Flox.GeomUtils
 *    Flox.FlowImporter
 *    Flox.Flow
 *    Flox.FlowLayouter
 *    Flox.ColorUtils
 * 
 * The code is written similar to the pattern described here:
 *     http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
 */
var Flox = (function() {

"use strict";
var mapComponent,
    layoutWorker,
    filterWorker,
    importWorker,
    model_master,
	startTimeAll, 
	endTimeAll,
	numberOfDisplayedFlows,
	currentFilteredModel,
	fipsLookupTable,
	
	// This flag becomes and stays false after the starting animation.
	starting = true, 
	
	/**
	 * These settings determine which flows are shown on the map when 
	 *  Flox.updateMap is called. They're changed through the GUI.
	 */
	filterSettings = {
		flowType: "net", // can be net or total
		inStateFlows: true, // show county flows inside selected state
		outerStateFlows: true, // show county flows traveling outside selected state
		selectedCounty: false, // A county is selected
		selectedState: false, // A state is selected
		countyMode: false, // County-level flows are being viewed
		stateMode: false, // state-level flows are being viewed
		selectedFeatureName: false // the name of the selected feature. False
		// if nothing is selected
	},
	my = {}; // public object


// A lookup table of US state 2-digit FIPS codes and the state names.
fipsLookupTable = {
	"01": "Alabama",//AL
	"02": "Alaska",	//AK
	"04": "Arizona",//AZ
	"05": "Arkansas",//AR
	"06": "California",//CA
	"08": "Colorado",//CO
	"09": "Connecticut",//CT
	"10": "Delaware",//DE
	"11": "District of Columbia",//DC
	"12": "Florida",//FL
	"13": "Georgia",//GA
	"15": "Hawaii",	//HI
	"16": "Idaho",//ID
	"17": "Illinois",//IL
	"18": "Indiana",//IN
	"19": "Iowa",//IA
	"20": "Kansas",//KS
	"21": "Kentucky",//KY
	"22": "Louisiana",//LA
	"23": "Maine",//ME
	"24": "Maryland",//MD
	"25": "Massachusetts",//MA
	"26": "Michigan",//MI
	"27": "Minnesota",//MN
	"28": "Mississippi",//MS
	"29": "Missouri",//MO
	"30": "Montana"	,//MT
	"31": "Nebraska",//NE
	"32": "Nevada",//NV
	"33": "New Hampshire",//NH
	"34": "New Jersey",//NJ
	"35": "New Mexico",//NM
	"36": "New York",//NY
	"37": "North Carolina",	//NC
	"38": "North Dakota",//ND
	"39": "Ohio",//OH
	"40": "Oklahoma",	//OK
	"41": "Oregon",	//OR
	"42": "Pennsylvania",//PA
	"44": "Rhode Island",//RI
	"45": "South Carolina",//SC
	"46": "South Dakota",//SD
	"47": "Tennessee",//TN
	"48": "Texas",//TX
	"49": "Utah",//UT
	"50": "Vermont",//VT
	"51": "Virginia",//VA
	"53": "Washington",//WA
	"54": "West Virginia",//WV
	"55": "Wisconsin",//WI
	"56": "Wyoming",//WY
	"60": "American Samoa",//AS
	"64": "Federated States of Micronesia",//FM
	"66": "Guam",//GU
	"68": "Marshall Islands",//MH
	"69": "Commonwealth of the Northern Mariana Islands",//MP
	"70": "Palau",//PW
	"72": "Puerto Rico",//PR
	"74": "U.S. Minor Outlying Islands",//UM
	"78": "U.S. Virgin Islands"//VI
}

/**
 * Draw the features in the passed-in model to the map.
 */
function refreshMap(model_copy) {
	if(!model_copy) {
		throw new Error("refreshMap needs a model passed in");
	}
    mapComponent.drawFeatures(model_copy);
}


/**
 * START WEBWORKER STUFF -------------------------------------------------------
 * 
 * This app makes use of webworkers to prevent the browser from freezing while
 * the flow map layout is being performed. 
 */

/**
 * End all existing webworker processes. 
 */
function terminateWorkers() {
	if (importWorker) {importWorker.terminate();}
	if (filterWorker) {filterWorker.terminate();}
	if (layoutWorker) {layoutWorker.terminate();}
}

// TODO If the browser can't do webworkers, then webworkers shouldn't be used.
/**
 * Initialize the webworker that performes the layout iterations.
 */
function initLayoutWorker(modelCopy, callback) {
	var flows,
		ctrlPts,
		flow, flowCPt, 
		i, j, latLng, progress;
		
	// If webworkers are compatible with this browser...
	if (window.Worker) {
		// If a layouter worker currently exists, terminate it. 
		if(layoutWorker) {layoutWorker.terminate();}
		
		// Web workers take a separate file. Note that the path is relative
		// to index.html, not Flox.js
		layoutWorker = new Worker("scripts/layoutWorker.js");
		
		// This happens when layoutWorker sends out a message
		layoutWorker.onmessage = function(e) {
			var progress;		
			
			// Update the progress bar based on the current iteration.
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
					// ANSWER: nope. But I don't think it happens anywhere else.
					latLng = mapComponent.layerPtToLatLng([ctrlPts[i].x, ctrlPts[i].y]);
					flowCPt.lat = latLng.lat;
					flowCPt.lng = latLng.lng;
				}
				
				// Run the callback function, which includes refreshMap() 
				callback();
			}
			// If it's the last iteration, hide the progress bar.
			if(e.data[1] === 100) {
				Flox.GUI.hideLayoutProgressBar();
			}
		};	
	}
}

/**
 * modelCopy contains the flows that need to be layed out. 
 * The callback is called in onmessage of the layout worker. 
 */
function runLayoutWorker(modelCopy, callback) {
	initLayoutWorker(modelCopy, callback);
	
	var largestFlowsModel = new Flox.Model(), // create a blank model
		modelJSON;

	// copy settings from the current model to the blank one.
	largestFlowsModel.updateSettings(modelCopy.settings);
	
	// Copy the flows that will be displaed from the current model to the
	// blank one.
	largestFlowsModel.addFlows(modelCopy.getLargestFlows());
	
	// Convert new model to json
	modelJSON = largestFlowsModel.toJSON();
	
	// Pass the layoutWorker the modelJSON, which will then perform the layout.
	layoutWorker.postMessage(modelJSON);
}

function initFilterWorker(callback) {
	if (window.Worker) {
		if (filterWorker) {filterWorker.terminate();}
		filterWorker = new Worker("scripts/filterWorker.js");
		filterWorker.onmessage = function(e) {
			var filteredModel = new Flox.Model();
			filteredModel.deserializeModelJSON(e.data);	
			// send the filtered model back to wherever runFilterWorker was called
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
			
			// Send the imported data to wherever runImportWorker was called
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
 * END WEBWORKER STUFF --------------------------------------------------------
 */


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

/**
 * Import the state-to-state migration data.
 * Make keepSelectedState true if the currently selected state should 
 * stay selected. 
 */
function importStateToStateMigrationFlows(keepSelectedState) {
	
	var //flowPath = "data/census/US_state_migration_2013_flows.csv",
		flowPath = "data/census/stateToStateFlows.csv",
		stuffImportWorkerNeeds = {};
	
	// Clear the current model and map.
	terminateWorkers();
    model_master.deleteAllFlows();
    mapComponent.hideAllCountyBorders();
    mapComponent.removeAllFlows();
    mapComponent.removeNecklaceMap();
    
    // If the app is just being started, run the startup zoom animation.
    if(starting===false) {
		mapComponent.zoomToFullExtent();
    }
    
	// filterSettings.stateMode = true;
	// filterSettings.countyMode = false;
	model_master.settings.scaleMultiplier = 4; // FIXME hardcoded
	model_master.settings.datasetName = "states";
	
	if(!keepSelectedState) {
		my.setSelectedState(false);
	}
	
	stuffImportWorkerNeeds.flowPath = flowPath;
	stuffImportWorkerNeeds.settings = model_master.settings;
	
	// Import the flows
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

function importTotalCountyFlowData(stateFIPS) {		
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
}

// PUBLIC =====================================================================

my.angleDif = function(startToCtrlAngle, fStartToCtrlAngle) {
	return Flox.GeomUtils.angleDif(startToCtrlAngle, fStartToCtrlAngle);
};

/**
 * Converts pixel coordinates to latLng, 
 * makes a Point object, returns it.
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

// Returns the model_master, which contains all imported flows. 
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

/**
 * Project the lat and long of each node to the current map projection,
 * assigning each node
 */
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
	importTotalCountyFlowData(stateFIPS);
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
	
	// Assign xy coordinates to nodes.
	my.assignXYToNodes(model_master.getPoints());
	
	//model_master.setMaxFlowWidth();
	
	// This if statement is here for debug just to make it easier to turn
	// off webworkers in order to run performace tests. 
	// TODO Eventually, it might be nice to have the ability to not use 
	// webworkers if the browser is not compatible with them. 
	// FIXME Something is broken when not using webworkers. 
	
	if(window.Worker && model_master.settings.useWebworkers) {
		Flox.GUI.updateLayoutProgressBar(35);
		runFilterWorker(function(filteredModel) {
			Flox.GUI.updateLayoutProgressBar(50);
			// configure the needed variables to get only above average flows.
			filteredModel.setAboveAverageFlowCount();
			
			numberOfDisplayedFlows = filteredModel.getLargestFlows().length;
			currentFilteredModel = filteredModel;
			
			Flox.GUI.updateGUI();
			if(filterSettings.stateMode === false &&
				filterSettings.selectedState !== false) {
				mapComponent.configureNecklaceMap(filteredModel);
			}
			mapComponent.setChoroplethAndLegend(filteredModel);
			mapComponent.enableTooltip();
			
			if(starting) {
				starting = false;
				my.runInitialAnimation();
				setTimeout(function(){
					runLayoutWorker(filteredModel, function(){
						refreshMap(filteredModel);
					})
				}, 750)
			} else {
				if(model_master.settings.layoutFlows) {
					runLayoutWorker(filteredModel, function() {
						refreshMap(filteredModel);
					});	
				} else {
					var layouter = new Flox.FlowLayouter(filteredModel);
					layouter.straightenFlows();
					refreshMap(filteredModel);
				}
			}
		});
	} else {
		
		// TODO throw up a "please wait" sign
		var filteredModel, 
			largestFlowsModel = new Flox.Model(), i, oldFlows, newFlows, oldCPt, 
			newCPt;
		filteredModel = my.filterBySettings(model_master, filterSettings);
		
		numberOfDisplayedFlows = filteredModel.getLargestFlows().length;
		currentFilteredModel = filteredModel;
		
		Flox.GUI.updateGUI();
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

my.initFlox = function() {

	Flox.GUI.updateGUI();
	model_master = new Flox.Model();
	mapComponent = new Flox.MapComponent_d3();
	mapComponent.initMap();
	
	filterSettings.stateMode = true;
	
	importStateToStateMigrationFlows();
};

// This runs the startup animation. It's rather hacked in. Like other things.
my.runInitialAnimation = function() {
	$("#loadingMessage").addClass("hidden");
	$("#mouseBlocker").css("background", "none");
	mapComponent.zoomToFullExtent();
	setTimeout(function(){
		Flox.GUI.toggleLegendSlidingPanel();
		setTimeout(function(){
			Flox.GUI.toggleSlidingPanel();
			setTimeout(function(){
				Flox.GUI.toggleOptionsSlidingPanel();
				$("#mouseBlocker").css("pointer-events", "none");
			}, 50);
		}, 50);
	}, 750);
};

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

// Take a FIPS, return a state name.
my.lookupFIPS = function(FIPS) {
	// if the fips is a number, make it at string. Or just string it anyway.
	FIPS = String(FIPS);
	
	// If length of FIPS is 1, then it's a single-digit number. Add leading 0.
	if(FIPS.length === 1) {
		FIPS = "0" + FIPS;
	}
	
	if(!fipsLookupTable.hasOwnProperty(FIPS)) {
		throw new Error(FIPS + " is not a legit FIPS code");
	} 
	return fipsLookupTable[FIPS];
};

my.getSelectedStateName = function() {
	if(filterSettings.selectedState === false) {
		throw new Error("No state is selected");
	}
	return my.lookupFIPS(filterSettings.selectedState);
};

my.zoomToCircle = function(c) {
	mapComponent.zoomToCircle(c);
};

my.zoomToRectangle = function(rect) {
	mapComponent.zoomToRectangle(rect);
};

my.getNumberOfDisplayedFlows = function() {
	return numberOfDisplayedFlows;
};

my.getCurrentFilteredModel = function() {
	return currentFilteredModel;
};

my.getMapScale = function () {
	return mapComponent.getMapScale();
};

return my;

}());
