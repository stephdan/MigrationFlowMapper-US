Flox.GUI = (function($){
	
	"use strict";
	
	// This works.
	$("#netFlowRadioLabel").on("click", function() {
		console.log("net clicked!");
		
		// Get the filter settings from Flox.
		var settings = Flox.getFilterSettings();
		
		// If netFlows is false, change to true, filter, layout, draw
		if(settings.netFlows === false) {
			settings.netFlows = true;
			Flox.filterBySettings();
		}
	});
	
	// This works.
	$("#totalFlowRadioLabel").on("click", function() {
		console.log("total clicked!");
		
		// Get the filter settings from Flox.
		var settings = Flox.getFilterSettings();
		
		// If netFlows is false, change to true, filter, layout, draw
		if(settings.netFlows === true) {
			settings.netFlows = false;
			Flox.filterBySettings();
		}
	});
	
	
	
	// This works.
	$("#inStateFlowsToggle").on("click", function() {
		console.log("inState clicked!");
		
		var settings = Flox.getFilterSettings();
		settings.inStateFlows = !settings.inStateFlows;
		Flox.filterBySettings();

	});

	$("#outOfStateFlowsToggle").on("click", function() {
		console.log("outOfState clicked!");
		
		var settings = Flox.getFilterSettings();
		settings.outerStateFlows = !settings.outerStateFlows;
		Flox.filterBySettings();

	});


}($));
