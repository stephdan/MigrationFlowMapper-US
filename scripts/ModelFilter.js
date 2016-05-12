Flox.ModelFilter = function(model) {

	"use strict";

	if(!model) {
		throw new Error("Flox.ModelFilter is missing a Model");
	}

	// Public object
	var my = {};

	function copyModel() {

		var modelJSON = model.toJSON(), // FIXME only copies maxFlows?
		    modelCopy = new Flox.Model();

		modelCopy.deserializeModelJSON(modelJSON);

		return modelCopy;
	}

// PUBLIC ---------------------------------------------------------------------
	
	my.getNetFlowsModel = function() {
		var modelCopy = copyModel(),
		flows = modelCopy.getAllFlows(),
		
		netFlows = [],
		i, j, f1, f2, diff, hasOpposingFlow, flow;

		console.log(flows);
		// Loop backwards through flows
		for (i = flows.length - 1; i >= 0; i -= 1) {
			
			hasOpposingFlow = false;
			
			f1 = flows[i];
			
			if(f1) {
				// Loop forwards through flows, stopping at flows[i - 1];
				for (j = 0; j < i; j += 1) {
					
					if(flows[j]) {
						f2 = flows[j];
						if(f1.getStartPt() === f2.getEndPt() && f1.getEndPt() === f2.getStartPt()) {
							// These are two way flows!
							hasOpposingFlow = true;
							
							console.log("found opposing flow!");
							
							diff = f1.getValue() - f2.getValue();
							
							if (diff > 0) { // f1 is bigger
								netFlows.push(new Flox.Flow(f1.getStartPt(), f1.getEndPt(), diff));
							}
							
							if (diff < 0) { // f2 is bigger
								netFlows.push(new Flox.Flow(f2.getStartPt(), f2.getEndPt(), Math.abs(diff)));
							}
							
							if (diff === 0) {
								console.log("Hurray! Opposing flows have equal values!");
							}
							
							flows[j] = false; // so f2 isn't added when encountered again
							// in the reverse loop.
						}
					}
				}
				if(!hasOpposingFlow) {
					netFlows.push(flows[i]);
				}
			}
		}
		
		modelCopy.deleteAllFlows();
		modelCopy.addFlows(netFlows);
		
		return modelCopy;
	};
	return my;
};
