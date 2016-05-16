Flox.ModelFilter = function(m) {

	"use strict";

	if (!m) {
		throw new Error("Flox.ModelFilter is missing a Model");
	}

	var model_copy,
		my = {}; // Public object
	
	/**
	 * Return a copy of the model that was passed in on instantiation. 
	 */
	function copyModel() {
		console.log("copying model");
		var modelJSON = m.toJSON(), // FIXME only copies maxFlows?
		    modelCopy = new Flox.Model();

		modelCopy.deserializeModelJSON(modelJSON);

		return modelCopy;
	}

	// Create a copy of the provided model.
	model_copy = copyModel();

	/**
	 * Merge all flows going between the same county and state.
	 */
	function mergeOutOfStateNetFlows() {
		
		var flows = model_copy.getAllFlows(),
		i, j,
		outOfStateFlows = {},
		selectedStateSTUSPS = model_copy.getDatasetName(),
		countyFIPS,
		outerStateSTUSPS,
		ePt, sPt, f, direction, newFlow, flow, val;
		
		// loop backwards through flows
		for (i = flows.length - 1; i >= 0; i -= 1) {
			f = flows[i];
			sPt = f.getStartPt();
			ePt = f.getEndPt();
			// If the start or end point are not inside the selected state
			if(sPt.STUSPS !== selectedStateSTUSPS || ePt.STUSPS !== selectedStateSTUSPS) {
				// Add the county of the node that is in state to outOfStateFlows
				// Is it the start or end point that is out of state?
				if (sPt.STUSPS === selectedStateSTUSPS) {
					countyFIPS = sPt.id;
					outerStateSTUSPS = ePt.STUSPS;
					ePt.name = outerStateSTUSPS;
					direction = -1; 
				} else {
					countyFIPS = String(ePt.id);
					outerStateSTUSPS = sPt.STUSPS;
					sPt.name = outerStateSTUSPS;
					direction = 1;
				}
				// If it's not there already, add the in-state county fips of 
				// this flow as a property of outOfStateFlows
				if(!outOfStateFlows.hasOwnProperty(countyFIPS)) {
					outOfStateFlows[countyFIPS] = {};
				}
				// If it's not there already
				// add the state of the flow as a property of the county in 
				// outOfStateFlows, and set it's value to f, and change f's 
				// value to 0.
				if(!outOfStateFlows[countyFIPS].hasOwnProperty(outerStateSTUSPS)) {
					f.setValue(f.getValue() * direction);
					outOfStateFlows[countyFIPS][outerStateSTUSPS] = f;
				} else {
					// Add the total flow to that state for that county
					outOfStateFlows[countyFIPS][outerStateSTUSPS].addValue(f.getValue() * direction);
				}
				
				// DELETE this flow from flows
				flows.splice(i, 1);
			}
		}
		
		// TODO add polyfill for Object.keys
		// Loop through the properties of outOfStateFlows, which are are county
		// names
		Object.keys(outOfStateFlows).forEach(function(county, i) {
			// Loop through the properties of each county, which are state
			// abbreviations. Each state has a flow. Get that flow!
		    Object.keys(outOfStateFlows[county]).forEach(function(state, j) {
				flow = outOfStateFlows[county][state];
				val = flow.getValue();
				// The direction of the flow may be incorrect.
				// If val is negative && end point is NOT state, reverse it. 
				if(val < 0 && flow.getEndPt.STUSPS !== state) {
					flow.reverseFlow();
				}
				// If val is positive and end point IS state, reverse it.
				if(val > 0 && flow.getEndPt.STUSPS === state) {
					flow.reverseFlow();
				}
				// make sure the value is not negative.
				flow.setValue(Math.abs(flow.getValue()));
				// if the value is greater than zero, add it to flows.
				if(flow.getValue() > 0) {
					flows.push(flow);
				}
		    });
		});
				
		// Remove all flows from the old model?
		model_copy.deleteAllFlows();
		
		// add flows to the new model
		model_copy.addFlows(flows);
		
		// return the new model
		return model_copy;
	}
	
	/**
	 * Merge all flows going from a county to the same outer state.
	 * Merge all flows going from an outer state to the same county.
	 */
	function mergeOutOfStateTotalFlows() {
		var flows = model_copy.getAllFlows(),
		i, j,
		outOfStateFlows = {},
		selectedStateSTUSPS = model_copy.getDatasetName(),
		countyFIPS,
		outerStateSTUSPS,
		ePt, sPt, f, direction, newFlow, flow, val;
		
		// loop backwards through flows
		for (i = flows.length - 1; i >= 0; i -= 1) {
			f = flows[i];
			sPt = f.getStartPt();
			ePt = f.getEndPt();
			// If the start or end point are not inside the selected state
			if(sPt.STUSPS !== selectedStateSTUSPS || ePt.STUSPS !== selectedStateSTUSPS) {
				// Is it the start or end point that is out of state?
				if (sPt.STUSPS === selectedStateSTUSPS) { // end point is out of state.
					countyFIPS = sPt.id;
					outerStateSTUSPS = ePt.STUSPS;
					ePt.name = outerStateSTUSPS; 
					
					// If it's not there already, add the in-state county fips of 
					// this flow as a property of outOfStateFlows
					if(!outOfStateFlows.hasOwnProperty(countyFIPS)) {
						outOfStateFlows[countyFIPS] = {};
					}
					
					// If it's not there already, add the outer state as a
					// property of this county in outOfStateFlows
					if(!outOfStateFlows[countyFIPS].hasOwnProperty(outerStateSTUSPS)) {
						outOfStateFlows[countyFIPS][outerStateSTUSPS] = {};
					}
					
					// Iff'n ain't thur, add outgoing as a property
					// of the outer state of the county of outOfStateFlows,
					// and make f the value.
					if(!outOfStateFlows[countyFIPS][outerStateSTUSPS].hasOwnProperty("outgoing")) {
						outOfStateFlows[countyFIPS][outerStateSTUSPS].outgoing = f;
					} else { // Add the value of f to the appropriate outgoing flow
						outOfStateFlows[countyFIPS][outerStateSTUSPS].outgoing.addValue(f.getValue());
					}
					
				} else { // start point is out of state.
					countyFIPS = String(ePt.id);
					outerStateSTUSPS = sPt.STUSPS;
					sPt.name = outerStateSTUSPS;
					
					// If it's not there already, add the in-state county fips of 
					// this flow as a property of outOfStateFlows
					if(!outOfStateFlows.hasOwnProperty(countyFIPS)) {
						outOfStateFlows[countyFIPS] = {};
					}
					
					// If it's not there already, add the outer state as a
					// property of this county in outOfStateFlows
					if(!outOfStateFlows[countyFIPS].hasOwnProperty(outerStateSTUSPS)) {
						outOfStateFlows[countyFIPS][outerStateSTUSPS] = {};
					}
					
					// Iff'n ain't thur, add incoming as a property
					// of the outer state of the county of outOfStateFlows,
					// and make f the value.
					if(!outOfStateFlows[countyFIPS][outerStateSTUSPS].hasOwnProperty("incoming")) {
						outOfStateFlows[countyFIPS][outerStateSTUSPS].incoming = f;
					} else { // Add the value of f to the appropriate outgoing flow
						outOfStateFlows[countyFIPS][outerStateSTUSPS].incoming.addValue(f.getValue());
					}
				}

				// Delete f from flows.
				flows.splice(i, 1);
			}
			// This flow is entirely inside the selected state. Do nothing! It
			// will remain unchanged.			
		}
		
		// TODO add polyfill for Object.keys
		// Loop through the properties of outOfStateFlows, which are are county
		// names
		Object.keys(outOfStateFlows).forEach(function(county, i) {
			// Loop through the properties of each county, which are state
			// abbreviations.
		    Object.keys(outOfStateFlows[county]).forEach(function(state, j) {
				// loop through the properties of each state which are incoming
				// or outgoing. Each contains a flows. Get that flow!
				Object.keys(outOfStateFlows[county][state]).forEach(function(direction) {
					flow = outOfStateFlows[county][state][direction];
					// if the value is greater than zero, add it to flows.
					if(flow.getValue() > 0) {
						flows.push(flow);
					}					
				});
		    });
		});
				
		// Remove all flows from the old model?
		model_copy.deleteAllFlows();
		
		// add flows to the new model
		model_copy.addFlows(flows);
		
		// return the new model
		return model_copy;
	}


	// PUBLIC ---------------------------------------------------------------------

	my.getModelCopy = function() {
		return model_copy;
	};

	my.mergeOutOfStateNetFlows = function() {
		return mergeOutOfStateNetFlows();
	};

	my.mergeOutOfStateTotalFlows = function() {
		return mergeOutOfStateTotalFlows();
	};

	function netFlow(flow1, flow2) {
		// TODO make sure flow1 and flow2 exist
		var diff = flow1.getValue() - flow2.getValue();
		if (diff > 0) {// f1 is bigger
			return new Flox.Flow(flow1.getStartPt(), flow1.getEndPt(), diff);
		}
		if (diff < 0) {// f2 is bigger
			return new Flox.Flow(flow2.getStartPt(), flow2.getEndPt(), Math.abs(diff));
		}
		return null;
	}

	/**
	 * Return a model containing net flows derived from total flows.
	 */
	my.getNetFlowsModel = function() {
		// Get the flows from the original model
		var flows = model_copy.getAllFlows(),

		// VARS
		    netFlows = [],
		// TODO is Map available in all recent browsers?
		    map = new Map(),
		    i,
		    flow,
		    id1,
		    id2;

		for ( i = 0; i < flows.length; i += 1) {
			flow = flows[i];
			if ( typeof (flow.oppositeFlow) !== "undefined") {
				flow = netFlow(flow, flow.oppositeFlow);
				// flow is null if net flow is 0
				if (flow !== null) {
					id1 = Number(flow.getStartPt().id);
					id2 = Number(flow.getEndPt().id);
					map.set(Math.min(id1, id2) + "_" + Math.max(id1, id2), flow);
				}
			}
		}

		// TODO polyfill for Array.from
		netFlows = Array.from(map.values());

		model_copy.deleteAllFlows();
		model_copy.addFlows(netFlows);

		//Flox.logFlows(modelCopy);
		return model_copy;
	};
	
	/**
	 * Return a model containing only the flows that will be displayed.
	 */
	my.getMaxFlowsModel = function() {
		var maxFlows, i, j, n, allFlows;
	
		n = model_copy.getMaxFlows();
		
		allFlows = model_copy.getAllFlows();
		
		maxFlows = allFlows.slice(0, n);
		
		model_copy.deleteAllFlows();
		
		model_copy.addFlows(maxFlows);
		
		return model_copy;
	};
	
	/**
	 * Perform multiple filter operations according to specified settings.
 * @param {Object} settings
	 */
	my.filterBySettings = function(settings) {
		
		// Net flows if settings.netFlows
		if(settings.netFlows) {
			my.getNetFlowsModel();
			mergeOutOfStateNetFlows();
		} else {
			mergeOutOfStateTotalFlows();
		}
		
		// if(settings.inStateFlows) {
			// // filter out all flows connected to other states
		// } else if (settings.outStateFlows) {
			// // filter out all within-state flows
		// } else if (settings.inAndOutStateFlows) {
			// // Don't filter anything!
		// } else {
			// // default to filtering out all flows connectd to other states.
		// }
		
		
		// Filter out all but the biggest flows.
		my.getMaxFlowsModel();		
		
		return model_copy;
		
	};
	
	
	
	return my;
};















