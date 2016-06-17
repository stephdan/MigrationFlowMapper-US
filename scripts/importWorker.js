(function(){
"use strict";

importScripts("Flox.js",
			  "Flow.js",
			  "FloxModel.js",
			  "../lib/d3.min.js",
			  "FlowImporter.js");	


onmessage = function(e) {
	
	// e.data will contain instructions for what to do.
	
	
	// Do stuff to make new flows and nodes
	var newModel, json;
	
	// Somehow those new flows and nodes need to be turned into JSON and passed
	// back out. Normally this is done via a model, which contains the stuff
	// to do that. You could still do that! You could make a new model, add
	// the new flows and nodes to it, and then serialize them. Probably not
	// the quickest way, but it is a way!
	
	newModel = new Flox.Model();
	newModel.updateSettings(e.data.settings);
	
	if(e.data.settings.datasetName === "states") {
		Flox.FlowImporter.importStateToStateMigrationFlows(e.data.flowPath, function(flows, stateNodes) {
			newModel.initNodes(stateNodes);
			newModel.addFlows(flows);
			json = newModel.toJSON();
			postMessage(json);
		});
	} else {
		// It's county to county data. But for which state?
		Flox.FlowImporter.importTotalCountyFlowData(e.data.stateFIPS, function(flows, countyNodes){
			// flows are the imported flows!
			newModel.initNodes(countyNodes);
			newModel.addFlows(flows);
			json = newModel.toJSON();
			postMessage(json);
		});
	}
	
};

	
}());