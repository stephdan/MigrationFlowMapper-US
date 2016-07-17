(function(){
	
"use strict";

importScripts("Flox.js",
			  "Flow.js",
			  "FloxModel.js",
			  "ModelFilter.js",
			  "FlowLayouter.js");

var model;

function layoutFlows() {
	
	if (model.getFlows().length < 2) {
		console.log("there are fewer than 2 flows, not doing a layout");
		return;
	}
	
	var iterations = model.settings.NBR_ITERATIONS,
		initialLocks = model.getLocks(),
        //startTime = performance.now(),
        layouter, endTime,
        i, j, weight;
	
	layouter = new Flox.FlowLayouter(model);
	
	// Straighten the flows.
	//straightenFlows();
	layouter.straightenFlows();
	
	// Run the first half of iterations, without MFIN
    for (i = 0, j = Math.floor(iterations/2); i < j; i += 1) {
        weight = 1 - i/iterations;
        layouter.layoutAllFlows(weight);
        
        if(i % 5 === 0) {
			if(model.settings.liveDrawing) {
				postMessage([model.getCtrlPts(), (i/iterations * 100)]);
			} else {
				postMessage([false, (i/iterations * 100)]);
			}
        }
    }
	
	// Run second half of iterations, with MFIN
    for (i = Math.floor(iterations/2); i < iterations; i += 1) {
        weight = 1 - i/iterations;
        layouter.layoutAllFlows(weight);
        if(model.settings.moveFlowsIntersectingObstacles) {
			layouter.moveFlowsIntersectingNodes();
		}
		if(i % 5 === 0) {
			if(model.settings.liveDrawing) {
				postMessage([model.getCtrlPts(), (i/iterations * 100)]);
			} else {
				postMessage([false, (i/iterations * 100)]);
			}
        }	
    }
    
	model.applyLocks(initialLocks);
	//endTime = performance.now();
	//console.log("Layout time in milliseconds: " + Math.round(endTime - startTime));
	return model.getCtrlPts();
}


// This happens when layoutWorker receives a message
onmessage = function(e) {
	
	var newControlPoints;
	
	//model = buildModel(e);
	model = new Flox.Model()
	model.deserializeModelJSON(e.data);
	
	// Get new control point coordinates.
	newControlPoints = layoutFlows();
	
	// Send out new control point coordinates when all iterations are complete.
	postMessage([newControlPoints, 100]);
};


}());




