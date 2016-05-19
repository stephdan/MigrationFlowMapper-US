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
		selectedStateFIPS = model_copy.getDatasetName(),
		countyFIPS,
		outerStateFIPS,
		ePt, sPt, f, direction, newFlow, flow, val;
		
		// loop backwards through flows
		for (i = flows.length - 1; i >= 0; i -= 1) {
			f = flows[i];
			sPt = f.getStartPt();
			ePt = f.getEndPt();
			// If the start or end point are not inside the selected state
			if(sPt.STATEFP !== selectedStateFIPS || ePt.STATEFP !== selectedStateFIPS) {
				// Add the county of the node that is in state to outOfStateFlows
				// Is it the start or end point that is out of state?
				if (sPt.STATEFP === selectedStateFIPS) {
					countyFIPS = sPt.id;
					outerStateFIPS = ePt.STATEFP;
					ePt.name = outerStateFIPS;
					direction = -1; 
				} else {
					countyFIPS = String(ePt.id);
					outerStateFIPS = sPt.STATEFP;
					sPt.name = outerStateFIPS;
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
				if(!outOfStateFlows[countyFIPS].hasOwnProperty(outerStateFIPS)) {
					f.setValue(f.getValue() * direction);
					outOfStateFlows[countyFIPS][outerStateFIPS] = f;
				} else {
					// Add the total flow to that state for that county
					outOfStateFlows[countyFIPS][outerStateFIPS].addValue(f.getValue() * direction);
				}
				
				// DELETE this flow from flows
				flows.splice(i, 1);
			}
		}
		
		// TODO add polyfill for Object.keys
		// Loop through the properties of outOfStateFlows, which are are county
		// FIPS
		Object.keys(outOfStateFlows).forEach(function(county, i) {
			// Loop through the properties of each county, which are state
			// FIPS. Each state has a flow. Get that flow!
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
		selectedStateFIPS = model_copy.getDatasetName(),
		countyFIPS,
		outerStateFIPS,
		ePt, sPt, f, direction, newFlow, flow, val;
		
		// loop backwards through flows
		for (i = flows.length - 1; i >= 0; i -= 1) {
			f = flows[i];
			sPt = f.getStartPt();
			ePt = f.getEndPt();
			// If the start or end point are not inside the selected state
			if("FIPS" + sPt.STATEFP !== selectedStateFIPS || "FIPS" + ePt.STATEFP !== selectedStateFIPS) {
				// Is it the start or end point that is out of state?
				if ("FIPS" + sPt.STATEFP === selectedStateFIPS) { // end point is out of state.
					countyFIPS = sPt.id;
					outerStateFIPS = ePt.STATEFP;
					ePt.name = outerStateFIPS; 
					
					// If it's not there already, add the in-state county fips of 
					// this flow as a property of outOfStateFlows
					if(!outOfStateFlows.hasOwnProperty(countyFIPS)) {
						outOfStateFlows[countyFIPS] = {};
					}
					
					// If it's not there already, add the outer state as a
					// property of this county in outOfStateFlows
					if(!outOfStateFlows[countyFIPS].hasOwnProperty(outerStateFIPS)) {
						outOfStateFlows[countyFIPS][outerStateFIPS] = {};
					}
					
					// Iff'n ain't thur, add outgoing as a property
					// of the outer state of the county of outOfStateFlows,
					// and make f the value.
					if(!outOfStateFlows[countyFIPS][outerStateFIPS].hasOwnProperty("outgoing")) {
						outOfStateFlows[countyFIPS][outerStateFIPS].outgoing = f;
					} else { // Add the value of f to the appropriate outgoing flow
						outOfStateFlows[countyFIPS][outerStateFIPS].outgoing.addValue(f.getValue());
					}
					
				} else { // start point is out of state.
					countyFIPS = String(ePt.id);
					outerStateFIPS = sPt.STATEFP;
					sPt.name = outerStateFIPS;
					
					// If it's not there already, add the in-state county fips of 
					// this flow as a property of outOfStateFlows
					if(!outOfStateFlows.hasOwnProperty(countyFIPS)) {
						outOfStateFlows[countyFIPS] = {};
					}
					
					// If it's not there already, add the outer state as a
					// property of this county in outOfStateFlows
					if(!outOfStateFlows[countyFIPS].hasOwnProperty(outerStateFIPS)) {
						outOfStateFlows[countyFIPS][outerStateFIPS] = {};
					}
					
					// Iff'n ain't thur, add incoming as a property
					// of the outer state of the county of outOfStateFlows,
					// and make f the value.
					if(!outOfStateFlows[countyFIPS][outerStateFIPS].hasOwnProperty("incoming")) {
						outOfStateFlows[countyFIPS][outerStateFIPS].incoming = f;
					} else { // Add the value of f to the appropriate outgoing flow
						outOfStateFlows[countyFIPS][outerStateFIPS].incoming.addValue(f.getValue());
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
		// FIPS
		Object.keys(outOfStateFlows).forEach(function(county, i) {
			// Loop through the properties of each county, which are state
			// FIPS.
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
		    netFlows = [],
		    unopposedFlows = [],
		    
		// TODO is Map available in all recent browsers?
		    map = new Map(),
		    i,
		    flow,
		    id1,
		    id2;

		// FIXME If the flow doesn't have an opposing flow, it is deleted. It
		// should not be deleted. 
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
			} else { // flow doesn't have an opposite flow, and should be kept.
				unopposedFlows.push(flow);
			}
		}

		// TODO polyfill for Array.from
		netFlows = Array.from(map.values());
		netFlows.concat(unopposedFlows);
		model_copy.deleteAllFlows();
		model_copy.addFlows(netFlows);

		//Flox.logFlows(model_copy);
		return model_copy;
	};
	
	/**
	 * Return a model containing the n largest flows, where n is the value of 
	 * maxFlows in the model.
	 */
	my.getMaxFlowsModel = function() {
		var maxFlows, i, j, n, allFlows, allNodes;
	
		n = model_copy.getMaxFlows();
		
		model_copy.sortFlows();
		
		allFlows = model_copy.getAllFlows();
		allNodes = model_copy.getPoints();
		
		maxFlows = allFlows.slice(0, n);
		
		model_copy.deleteAllFlows();
		
		model_copy.initNodes(allNodes);
		model_copy.addFlows(maxFlows);
		
		model_copy.updateCachedValues();
		
		return model_copy;
	};
	
	/**
	 * Return a model containing only flows with start and end points
	 * within the selected state. 
	 */
	my.getInStateFlowsModel = function (){
		var selectedState = model_copy.getDatasetName(),
			flows = model_copy.getFlows(), 
			f, i, j;
		
		for(i = flows.length - 1;  i >= 0; i -= 1) {
			// Slice out flows that have a node outside the state?
			f = flows[i];
			if("FIPS" + f.getStartPt().STATEFP !== selectedState || 
			     "FIPS" + f.getEndPt().STATEFP !== selectedState) {
				flows.splice(i, 1);
			}
		}
		
		model_copy.deleteAllFlows();
		model_copy.addFlows(flows);
		
	};
	
	my.getOuterStateFlowsModel = function() {
		var selectedState = model_copy.getDatasetName(),
			flows = model_copy.getFlows(), 
			f, i, j;
			
		for(i = flows.length - 1;  i >= 0; i -= 1) {
			// Slice out flows that have a node outside the state?
			f = flows[i];
			if(f.getStartPt().STUSPS === selectedState && 
			     f.getEndPt().STUSPS === selectedState) {
				flows.splice(i, 1);
			}
		}
		
		model_copy.deleteAllFlows();
		model_copy.addFlows(flows);
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
		
		if(settings.inStateFlows) {
			// filter out all flows connected to other states
			my.getInStateFlowsModel();
		} else if (settings.outerStateFlows) {
			// Filter out all flows that are entirely in-state
			my.getOuterStateFlowsModel();
		}
		
		// Filter out all but the biggest flows.
		my.getMaxFlowsModel();		
		
		return model_copy;
	};
	
	return my;
};















