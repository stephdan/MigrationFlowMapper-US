Flox.ModelFilter = function(model_master) {

	"use strict";

	if (!model_master) {
		throw new Error("Flox.ModelFilter is missing a Model");
	}

	var model_copy, // TODO need this?
		my = {}; // Public object
	
	/**
	 * Return a copy of the model that was passed in on instantiation. 
	 */
	function copyModel(m) {
		//console.log("copying model");
		var modelJSON = m.toJSON(), // FIXME only copies maxFlows?
		    modelCopy = new Flox.Model();
		modelCopy.deserializeModelJSON(modelJSON);
		return modelCopy;
	}
	
	/**
	 * Merge all flows going from a county to the same outer state.
	 * Merge all flows going from an outer state to the same county.
	 */
	function mergeOutOfStateTotalFlows() {
		var flows = model_copy.getAllFlows(),
		nodes = model_copy.getPoints(),
		i, j,
		outOfStateFlows = {},
		selectedStateFIPS = model_copy.settings.datasetName,
		countyFIPS,
		outerStateFIPS,
		ePt, sPt, f, direction, newFlow, flow, val;
		
		for(i = 0; i < nodes.length; i += 1) {
			nodes[i].incomingFlows = [];
			nodes[i].outgoingFlows = [];
		}
		
		// loop backwards through flows
		for (i = flows.length - 1; i >= 0; i -= 1) {
			f = flows[i];
			
			sPt = f.getStartPt();
			ePt = f.getEndPt();
			delete f.oppositeFlow; // just do it. Delete them all. They get 
			// remade later. 
			// If the start or end point are not inside the selected state
			if("FIPS" + sPt.STATEFP !== selectedStateFIPS || "FIPS" + ePt.STATEFP !== selectedStateFIPS) {
				
				// Is it the start or end point that is out of state?
				if ("FIPS" + sPt.STATEFP === selectedStateFIPS) { // end point is out of state.
					countyFIPS = sPt.id;
					outerStateFIPS = ePt.STATEFP;
					
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
					
					// This flow is going OUT to another state.
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
					
					// This flow is coming IN from another state.
					// Iff'n ain't thur, add incoming as a property
					// of the outer state of the county of outOfStateFlows,
					// and make f the value.
					if(!outOfStateFlows[countyFIPS][outerStateFIPS].hasOwnProperty("incoming")) {
						outOfStateFlows[countyFIPS][outerStateFIPS].incoming = f;
					} else { // Add the value of f to the appropriate incoming flow
						outOfStateFlows[countyFIPS][outerStateFIPS].incoming.addValue(f.getValue());
					}
				}

				// Delete f from flows.
				flows.splice(i, 1);
			}
			// This flow is entirely inside the selected state. Do nothing! It
			// will remain unchanged, and will stay inside flows.		
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

	// Get just the flows to or from a selected feature, which will be either
	// a state or a county.
	function getSelectedFeatureModel(filterSettings) {
		var incomingFlows = [], 
			outgoingFlows = [], 
			featureFlows,
			selectedFeatureID,
			nodes, node, i, j;
		
		// what is the selected feature?
		if(filterSettings.selectedCounty !== false) {
			// if a county is selected, it's a county.
			selectedFeatureID = filterSettings.selectedCounty;
		} else {
			selectedFeatureID = filterSettings.selectedState;
		}
		
		// Loop through the nodes, find the one with a matching FIPS.
		nodes = model_copy.getPoints();
		
		for(i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			if(Number(node.id) === Number(selectedFeatureID)) {
				
				// If we only want incoming or outgoing flows, take care of that
				// here.
				if (filterSettings.flowType === "incoming") {
					featureFlows = node.incomingFlows;
				} else if (filterSettings.flowType === "outgoing") {
					featureFlows = node.outgoingFlows;
				} else { 
					featureFlows = node.incomingFlows.concat(node.outgoingFlows);
				}
				break;
			}
		}
		model_copy.deleteAllFlows();
		model_copy.addFlows(featureFlows);
		
	}

	function getSelectedCountyModel(filterSettings) {
		var incomingFlows = [], 
			outgoingFlows = [], 
			countyFlows,
			nodes, node, i, j;
		
		// Loop through the nodes, find the one with a matching FIPS.
		nodes = model_copy.getPoints();
		
		for(i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			if(Number(node.id) === Number(filterSettings.selectedCounty)) {
				if(filterSettings.flowType === "incoming") {
					countyFlows = node.incomingFlows;
				} else if (filterSettings.flowType === "outgoing") {
					countyFlows = node.outgoingFlows;
				} else {
					countyFlows = node.incomingFlows.concat(node.outgoingFlows);
				}
				break;
			}
		}
		model_copy.deleteAllFlows();
		model_copy.addFlows(countyFlows);
	}

	function getSelectedStateModel(filterSettings) {
		var incomingFlows = [], 
			outgoingFlows = [], 
			stateFlows,
			nodes, node, i, j;
			
		nodes = model_copy.getPoints();
		
		for(i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			if(Number(node.id) === Number(filterSettings.selectedState)) {
				if(filterSettings.flowType === "incoming") {
					stateFlows = node.incomingFlows;
				} else if (filterSettings.flowType === "outgoing") {
					stateFlows = node.outgoingFlows;
				} else {
					stateFlows = node.incomingFlows.concat(node.outgoingFlows);
				}
				break;

			}
		}
		model_copy.deleteAllFlows();
		model_copy.addFlows(stateFlows);
	}

	my.getModelCopy = function() {
		return model_copy;
	};


	my.mergeOutOfStateTotalFlows = function() {
		return mergeOutOfStateTotalFlows();
	};

	


	function totalFlow(flow1, flow2) {
		// TODO make sure flow1 and flow2 exist
			
			// get the values
		var v1 = flow1.getValue(),
			v2 = flow2.getValue(),
		
			// Get the total value
			vTotal = v1 + v2,
			newFlow;
		
		// Make new flow. The start point is start point
		// of the bigger flow. Value is vTotal.
		if(v1 > v2) {
			newFlow = new Flox.Flow(flow1.getStartPt(), flow1.getEndPt(), vTotal);
			newFlow.AtoB = v1;
			newFlow.BtoA = v2;
		} else {
			newFlow = new Flox.Flow(flow2.getStartPt(), flow2.getEndPt(), vTotal);
			newFlow.AtoB = v2;
			newFlow.BtoA = v1;
		}
		return newFlow;
	}

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
		    nodes = model_copy.getPoints(),
		    
		// TODO is Map available in all recent browsers?
		    map = new Map(),
		    i,
		    flow,
		    id1,
		    id2;
	
		for(i = 0; i < nodes.length; i += 1) {
			nodes[i].outgoingFlows = [];
			nodes[i].incomingFlows = [];
		}
	
		// loop through flows
		for ( i = 0; i < flows.length; i += 1) {
			
			flow = flows[i];
			
			// If this flow has an opposite flow
			if ( typeof (flow.oppositeFlow) !== "undefined") {
				flow = netFlow(flow, flow.oppositeFlow);
				// flow can be null for some reason.
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
		netFlows = netFlows.concat(unopposedFlows);
		model_copy.deleteAllFlows();
		model_copy.addFlows(netFlows);

		return model_copy;
	};
	
	my.getTotalFlowsModel = function(settings) {
		// Get the flows from the original model
		var flows = model_copy.getAllFlows(),
		    totalFlows = [],
		    unopposedFlows = [],
		    map = new Map(),
		    i,
		    nodes = model_copy.getPoints(),
		    flow,
		    id1,
		    id2;

		// initialize the incoming and outgoing flows for each node, because
		// they are about to change. Nodes will no longer have incoming our 
		// outgoing flows, just a non-directional total flow.
		for(i = 0; i < nodes.length; i += 1) {
			nodes[i].outgoingFlows = [];
			nodes[i].incomingFlows = [];
		}
		
		for ( i = 0; i < flows.length; i += 1) {
			flow = flows[i];
			// Does it have an opposite flow?
			if ( typeof (flow.oppositeFlow) !== "undefined") {
				
				// A nice function for taking two flows and making a total flows.
				flow = totalFlow(flow, flow.oppositeFlow);
				
				if (flow !== null) {
					id1 = Number(flow.getStartPt().id);
					id2 = Number(flow.getEndPt().id);
					map.set(Math.min(id1, id2) + "_" + Math.max(id1, id2), flow);
				}
			} else { // flow doesn't have an opposite flow.
				// Still need tooltip info tho. 
				flow.AtoB = flow.getValue();
				flow.BtoA = 0;
				unopposedFlows.push(flow);
			}
		}
		
		// TODO polyfill for Array.from
		totalFlows = Array.from(map.values());
		totalFlows = totalFlows.concat(unopposedFlows);
		model_copy.deleteAllFlows();
		model_copy.addFlows(totalFlows);

		return model_copy;
	};
		
	/**
	 * Return a model containing only flows with start and end points
	 * within the selected state. 
	 */
	my.removeInStateFlows = function (){
		var selectedState = model_copy.settings.datasetName,
			flows = model_copy.getFlows(), nodes,
			f, i, j;
		
		for(i = flows.length - 1;  i >= 0; i -= 1) {
			// Slice out flows that have nodes only inside the state.
			f = flows[i];
			if("FIPS" + f.getStartPt().STATEFP === selectedState && 
			     "FIPS" + f.getEndPt().STATEFP === selectedState) {
				flows.splice(i, 1);
			}
		}
		model_copy.deleteAllFlows();
		model_copy.addFlows(flows);
	};
	
	my.removeOuterStateFlows = function() {
		var selectedState = model_copy.settings.datasetName, // FIXME use settings.selectedstate
			flows = model_copy.getFlows(), 
			f, i, j, nodes;
			
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
	
	/**
	 * Perform multiple filter operations according to specified settings.
 * @param {Object} settings
	 */
	my.filterBySettings = function(filterSettings) {		
		var startTime, endTime, 
			theModel = model_master,
			masterNodes = model_master.getPoints(),
			filteredNodes;
		
		model_copy = copyModel(model_master); // Copy the master model.
		
		// The flows need to be merged in different ways if we want net or
		// total flows. Nothing needs to happen otherwise. 
		if(filterSettings.flowType === "net") {
			my.getNetFlowsModel();
		} else if (filterSettings.flowType === "total"){ 
			my.getTotalFlowsModel(filterSettings);
		}
		model_copy.updateCachedValues();
		
		// If a single feature is selected, filter out all other flows.
		// If a county is selected, get just the flows for that county.
		// It's tricker determining if a single state is selected. Need to know
		// if it's in state mode or not as well. If no, then we're seeing
		// county flows and don't want to filter anything.
		// The case of flowType==="incoming" or "outgoing" is handled in
		if(filterSettings.selectedCounty !== false || 
		   (filterSettings.selectedState  !== false && filterSettings.stateMode)) {
			getSelectedFeatureModel(filterSettings);
		}
		
	
		
		if(!filterSettings.outerStateFlows && !filterSettings.stateMode) {
			my.removeOuterStateFlows();
		}
		
		if(filterSettings.inStateFlows === false && filterSettings.countyMode) {
			// filter out in state flows
			my.removeInStateFlows();
		}		
		
		// This is maybe the only time flows are sorted 
		model_copy.sortFlows();
		
		return model_copy;
	};
	
	my.getSelectedCountyModel = function(countyFIPS, filterSettings) {
		getSelectedCountyModel(countyFIPS, filterSettings);
		my.filterBySettings(filterSettings);
		
		return model_copy;
	};
	
	return my;
};















