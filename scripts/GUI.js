Flox.GUI = (function($){
	
	"use strict";
	
	var my = {};
	
	$("#stateFlowsRadioLabel").on("click", function() {

		var settings = Flox.getFilterSettings();
		if(settings.stateMode === false) {
			// do stuff			
			Flox.importStateToStateMigrationFlows();
		}
		console.log("state flows button clicked");
	});
	
	$("#countyFlowsRadioLabel").on("click", function() {
		var settings = Flox.getFilterSettings();
		if(settings.countyMode === false) {
			settings.stateMode = false;
			settings.countyMode = true;
			
			// if a state is selected, show the county flows in that state.
			if(settings.selectedState !== false) {
				Flox.selectState(settings.selectedState);
			} else if (settings.selectedState === false) {
				// need to change the color of the states to gray...
				// No layout will occur. This is kindof a special case. 
				console.log("CountyFlows was clicked while no state is selected");
				Flox.enterClickAStateMode();
			}

			//Flox.importTotalCountyFlowData(settings.selectedState);
		}
		console.log("county flows button clicked");
	});
	
	// This works.
	$("#netFlowRadioLabel").on("click", function() {
		console.log("net clicked!");
		
		// Get the filter settings from Flox.
		var settings = Flox.getFilterSettings();
		
		// If netFlows is false, change to true, filter, layout, draw
		if(settings.netFlows === false) {
			settings.netFlows = true;
			Flox.updateMap();
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
			Flox.updateMap();
		}
	});
	
	
	// This works.
	$("#inStateFlowsToggle").on("click", function() {
		console.log("inState clicked!");
		
		var settings = Flox.getFilterSettings();
		settings.inStateFlows = !settings.inStateFlows;
		// Only do something if it's not in state mode
		if(settings.stateMode === false) {
			Flox.updateMap();
		}
	});

	$("#outOfStateFlowsToggle").on("click", function() {
		console.log("outOfState clicked!");
		
		var settings = Flox.getFilterSettings();
		settings.outerStateFlows = !settings.outerStateFlows;
		// Only do something if it's not in state mode
		if(settings.stateMode === false) {
			Flox.updateMap();
		}
	});

	function toggleSlidingPanel() {
		var slidingPanel = $("#slidingPanel");
		if(slidingPanel.hasClass("collapsed")) {
			slidingPanel.removeClass("collapsed")
						.animate({
							height: 70
						}, 100);
		} else {
			slidingPanel.addClass("collapsed")
						.animate({
							height: 18
						}, 100);
		}
	}

	$("#slidingPanelTab").on("click", function() {
		// Change the height of if the slidingPanel
		toggleSlidingPanel();
		
	});

	function openSlidingPanel() {
		var slidingPanel = $("#slidingPanel");
		if(slidingPanel.hasClass("collapsed")) {
			slidingPanel.removeClass("collapsed")
						.animate({
							height: 70
						}, 100);
		}
	}

	function collapseSlidingPanel(){
		var slidingPanel = $("#slidingPanel");
		if (!slidingPanel.hasClass("collapsed")) {
			slidingPanel.addClass("collapsed")
						.animate({
							height: 18
						}, 100);
		}
	}

	my.openSlidingPanel = function() {
		openSlidingPanel();
	};
	
	my.collapseSlidingPanel = function() {
		collapseSlidingPanel();
	};

}($));
