Flox.GUI = (function($){
	
	"use strict";
	
	var my = {};
	
	// Capture mouseup events to change the style of buttons when the user
	// mousedowns on a button, but then mouseups off the button.
	$(window).mouseup(function() {
		$(".panelButtonContainer").each(function(i) {
			if($(this).hasClass("mousedown")) {
				var buttonIcon;
				$(this).removeClass("mousedown");
				buttonIcon = $(this).find("img");
				buttonIcon.attr("src", "resources/icons/buttons/" + buttonIcon.attr("id") + "_white.svg");
			}
		});
	});
	
	$(".panelButtonContainer").hover(
		function() {
			var buttonIcon;
			$(this).addClass("hover");
		}, function() {
			$(this).removeClass("hover");
		}
	);
	
	$(".panelButtonContainer").mousedown(
		function() {
			var buttonIcon;
			$(this).addClass("mousedown");
			buttonIcon = $(this).find("img");
			buttonIcon.attr("src", "resources/icons/buttons/" + buttonIcon.attr("id") + "_black.svg");
		}
	);
	
	$(".panelButtonContainer").mouseup(
		function() {
			
			// If it has the class mousedown...
			if($(this).hasClass("mousedown")) {
				var buttonIcon;
				$(this).removeClass("mousedown");
				buttonIcon = $(this).find("img");
				buttonIcon.attr("src", "resources/icons/buttons/" + buttonIcon.attr("id") + "_white.svg");
			}
		}
	);
	
	$("#usStateFlowsButton").click(
		function() {
			var settings = Flox.getFilterSettings();
			Flox.importStateToStateMigrationFlows();
			settings.selectedState = false;
		}
	);
	
	$("#stateOrCountyFlowsButton").click(
		function() {
			var buttonIcon = $(this).find("img"),
				settings = Flox.getFilterSettings();
			
			if(settings.countyMode === true) {
				// It's in couny mode. So get it out of county mode! And 
				// into state mode!
				
				// The button will show what happens when you click it. It
				// will turn back to county mode, so show the counies icon
				buttonIcon.attr("src", "resources/icons/buttons/counties_white.svg")
						  .attr("id", "counties");
				
				Flox.importStateToStateMigrationFlows();
			} else if (settings.countyMode === false) {
				// It's not in county mode. Put it in county mode!
				settings.countyMode = true;
				settings.stateMode = false;
				// The button will show what happens when you click it. It
				// will turn back to county mode, so show the counies icon
				buttonIcon.attr("src", "resources/icons/buttons/state_white.svg")
						  .attr("id", "state");
						  
				// if a state is selected, show the county flows in that state.
				if(settings.selectedState !== false) {
					// This is weird. A state should already be selected here. 
					// But this initiates the zoom thing though. Which is nice.
					Flox.selectState(settings.selectedState);
					
				} else if (settings.selectedState === false) {
					// need to change the color of the states to gray...
					// No layout will occur. This is kindof a special case. 
					Flox.enterClickAStateMode();
				}
			}
		}
	);
	
	$("#necklaceMapButton").click(
		function() {
			var buttonIcon = $(this).find("img"),
				settings = Flox.getFilterSettings(); 
			if(settings.outerStateFlows === true) {
				settings.outerStateFlows = false;
				buttonIcon.animate({
						"max-height": "70%",
						"opacity": 0.3
					}, 200, function() {
				});
			} else {
				settings.outerStateFlows = true;
				buttonIcon.animate({
						"max-height": "100%",
						"opacity": 1
					}, 200, function() {
				});
			}
			
			// Only do something if it's not in state mode
			if(settings.stateMode === false) {
				Flox.updateMap();
			}
			// if($(this).hasClass("noNecklaceMaps")) {
				// $(this).removeClass("noNecklaceMaps");
				// buttonIcon.animate({
						// "max-height": "100%",
						// "opacity": 1
					// }, 200, function() {
				// });
			// } else {
				// $(this).addClass("noNecklaceMaps");
				// buttonIcon.animate({
						// "max-height": "70%",
						// "opacity": 0.3
					// }, 200, function() {
				// });
			// }
		}
	);
	
	$("#innerFlowsButton").click(
		function() {
			var buttonIcon = $(this).find("img"),
				settings = Flox.getFilterSettings();
			
			
			
			if(settings.inStateFlows === false) {
				buttonIcon.animate({
						"max-height": "100%",
						"opacity": 1
					}, 200, function() {
				});
			} else {
				buttonIcon.animate({
						"max-height": "70%",
						"opacity": 0.3
					}, 200, function() {
				});
			}
			settings.inStateFlows = !settings.inStateFlows;
			if(settings.stateMode === false) {
				Flox.updateMap();
			}
			
			// if($(this).hasClass("noInnerFlows")) {
				// $(this).removeClass("noInnerFlows");
				// buttonIcon.animate({
						// "max-height": "100%",
						// "opacity": 1
					// }, 200, function() {
				// });
			// } else {
				// $(this).addClass("noInnerFlows");
				// buttonIcon.animate({
						// "max-height": "70%",
						// "opacity": 0.3
					// }, 200, function() {
				// });
			// }
		}
	);
	
	// $("#incomingFlowsButton").click(
		// function() {
			// var buttonIcon = $(this).find("img");
			// if($(this).hasClass("noIncomingFlows")) {
				// $(this).removeClass("noIncomingFlows");
				// buttonIcon.animate({
						// "max-height": "100%",
						// "opacity": 1
					// }, 200, function() {
				// });
			// } else {
				// $(this).addClass("noIncomingFlows");
				// buttonIcon.animate({
						// "max-height": "70%",
						// "opacity": 0.3
					// }, 200, function() {
				// });
			// }
		// }
	// );
	
	// $("#outgoingFlowsButton").click(
		// function() {
			// var buttonIcon = $(this).find("img");
			// if($(this).hasClass("noOutgoingFlows")) {
				// $(this).removeClass("noOutgoingFlows");
				// buttonIcon.animate({
						// "max-height": "100%",
						// "opacity": 1
					// }, 200, function() {
				// });
			// } else {
				// $(this).addClass("noOutgoingFlows");
				// buttonIcon.animate({
						// "max-height": "70%",
						// "opacity": 0.3
					// }, 200, function() {
				// });
			// }
		// }
	// );
	
	$("#netOrTotalFlowsButton").click(
		function() {
			var buttonIcon = $(this).find("img"),
				settings = Flox.getFilterSettings();
			if(settings.netFlows === false) {
				settings.netFlows = true;
				buttonIcon.attr("src", "resources/icons/buttons/netFLows_white.svg")
						  .attr("id", "netFlows");
				Flox.updateMap();
			} else {
				settings.netFlows = false;
				buttonIcon.attr("src", "resources/icons/buttons/totalFLows_white.svg")
						  .attr("id", "totalFlows");
				Flox.updateMap();
			}
		}
	);
	
	// $("#stateFlowsRadioLabel").on("click", function() {
		// var settings = Flox.getFilterSettings();
		// if(settings.stateMode === false) {
			// // do stuff			
			// Flox.importStateToStateMigrationFlows();
		// }
	// });
// 	
	// $("#countyFlowsRadioLabel").on("click", function() {
		// var settings = Flox.getFilterSettings();
		// if(settings.countyMode === false) {
			// settings.stateMode = false;
			// settings.countyMode = true;
// 			
			// // if a state is selected, show the county flows in that state.
			// if(settings.selectedState !== false) {
				// Flox.selectState(settings.selectedState);
			// } else if (settings.selectedState === false) {
				// // need to change the color of the states to gray...
				// // No layout will occur. This is kindof a special case. 
				// Flox.enterClickAStateMode();
			// }
			// //Flox.importTotalCountyFlowData(settings.selectedState);
		// }
	// });
	
	// This works.
	// $("#netFlowRadioLabel").on("click", function() {
// 		
		// // Get the filter settings from Flox.
		// var settings = Flox.getFilterSettings();
// 		
		// // If netFlows is false, change to true, filter, layout, draw
		// if(settings.netFlows === false) {
			// settings.netFlows = true;
			// Flox.updateMap();
		// }
	// });
	
	// This works.
	// $("#totalFlowRadioLabel").on("click", function() {
// 		
		// // Get the filter settings from Flox.
		// var settings = Flox.getFilterSettings();
// 		
		// // If netFlows is false, change to true, filter, layout, draw
		// if(settings.netFlows === true) {
			// settings.netFlows = false;
			// Flox.updateMap();
		// }
	// });
	
	
	// This works.
	$("#inStateFlowsToggle").on("click", function() {
		
		var settings = Flox.getFilterSettings();
		settings.inStateFlows = !settings.inStateFlows;
		// Only do something if it's not in state mode
		if(settings.stateMode === false) {
			Flox.updateMap();
		}
	});

	$("#outOfStateFlowsToggle").on("click", function() {
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

	/**
	 * 
 * @param {Number} progress - 0 to 100, percentage complete
	 */
	my.updateLayoutProgressBar = function(progress) {
		var bar = $("#layoutProgress");
		bar.width(progress + "%");
	};

	my.showLayoutProgressBar = function() {
		$("#layoutProgressBar").removeClass("hidden");
	};
	
	my.hideLayoutProgressBar = function() {
		$("#layoutProgressBar").addClass("hidden");
	};

	// $('.panelButtonContainer').on('click', function() {
		// $(this).animate({
			// "height": "0px",
			// "width": "0px",
			// "margin": "-2px",
			// "opacity": 0
			// }, 300, function() { 
		// });
	// });

	

	my.hidePanelButton = function(targetButtonID) {
		$("#" + targetButtonID).animate({
				"height": "0px",
				"width": "0px",
				"margin": "-2px",
				"opacity": 0
			}, 300, function() {
		});
	};

	my.hidePanelButtons = function(buttonArray) {
		var i;
		for(i = 0; i < buttonArray.length; i += 1) {
			my.hidePanelButton(buttonArray[i]);
		}
	};

	my.showPanelButton = function(targetButtonID) {
		$("#" + targetButtonID).animate({
				"height": "30px",
				"width": "40px",
				"margin": "0px",
				"opacity": 1
			}, 300, function() {
		});
	};
	
	my.showPanelButtons = function(buttonArray) {
		var i;
		for(i = 0; i < buttonArray.length; i += 1) {
			my.showPanelButton(buttonArray[i]);
		}
	};

	return my;

}($));
