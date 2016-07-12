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
			
			if(settings.selectedCounty !== false) {
				console.log("A county is selected: " + settings.selectedCounty);
				// Import the county-to-county data for that state again. No
				// need to go all zoomy. 
				settings.selectedCounty = false;
				Flox.selectState(settings.selectedState);
				return;
			}
			
			if(settings.countyMode === true) {
				// It's in county mode. So get it out of county mode! And 
				// into state mode!
				settings.countyMode = false;
				settings.stateMode = true;
				
				// The button will show what happens when you click it. It
				// will turn back to county mode, so show the counies icon
				buttonIcon.attr("src", "resources/icons/buttons/counties_white.svg")
						  .attr("id", "counties");
				
				Flox.importStateToStateMigrationFlows();
				return;
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
					//Flox.enterClickAStateMode();
				}
				return;
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
			} else {
				settings.netFlows = false;
				buttonIcon.attr("src", "resources/icons/buttons/totalFLows_white.svg")
						  .attr("id", "totalFlows");
			}
			Flox.updateMap();
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
		var slidingPanel = $("#slidingPanel"),
			slidingPanelContent = $("#slidingPanelContent"),
			h = slidingPanelContent.outerHeight();
		if(slidingPanel.hasClass("collapsed")) {
			slidingPanel.removeClass("collapsed")
						.animate({
							bottom: "0px"
						}, 100);
		} else {
			slidingPanel.addClass("collapsed")
						.animate({
							bottom: -(h - 2) + "px"
						}, 100);
		}
	}

	function toggleLegendSlidingPanel() {
		var slidingPanel = $("#legendSlidingPanel");
		if(slidingPanel.hasClass("collapsed")) {
			slidingPanel.removeClass("collapsed")
						.animate({
							left: "0px"
						}, 100);
		} else {
			slidingPanel.addClass("collapsed")
						.animate({
							left: "-180px"
						}, 100);
		}
	}

	$("#slidingPanelTab").on("click", function() {
		// Change the height of if the slidingPanel
		toggleSlidingPanel();
		
	});

	$("#legendSlidingPanelTab").on("click", function() {
		toggleLegendSlidingPanel();
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

	function updateTitle() {
		var title = $("#titleText"),
			subtitle = $("#subtitleText"),
			settings = Flox.getFilterSettings(),
			netOrTotal = settings.netFlows ? "net" : "total";
		
		// state flows, but no state selected
		if(settings.stateMode && settings.selectedState === false) {
			title.html("State migration within the US, 2013");
			subtitle.html("Top 50 state-to-state " + netOrTotal + " flows");
		}
		
		// state flows, state selected
		if(settings.stateMode && settings.selectedState !== false) {
			title.html("State migration within the US, 2013");
			subtitle.html("Top 50 " + netOrTotal + " flows entering or leaving " + settings.selectedFeatureName);
		}
		
		// county flows, no county selected
		if(settings.countyMode && settings.selectedCounty === false) {
			title.html("County migration within the US, 2009 to 2013");
			
			if(settings.inStateFlows && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + " county flows for " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows && settings.outerStateFlows === false) {
				subtitle.html("Top 50 " + netOrTotal + " county flows within " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + " county flows entering or leaving " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows === false) {
				subtitle.html("No flows shown");
			}
		}

		// county flows, county selected
		if(settings.countyMode && settings.selectedCounty !== false) {
			title.html("County migration within the US, 2009 to 2013");
			
			if(settings.inStateFlows && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + " county flows entering or leaving " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows && settings.outerStateFlows === false) {
				subtitle.html("Top 50 " + netOrTotal + " county flows entering or leaving " 
								+ settings.selectedFeatureName + " to or from counties of the same state");
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + " county flows entering or leaving " 
								+ settings.selectedFeatureName + " to or from other states");
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows === false) {
				subtitle.html("No flows shown");
			}
		}
	}

// Hint Text ------------------------------------------------------------------

	$("#usStateFlowsButton").hover(function() {
		$("#hintText").text("Display state-to-state flows for the US");
	}, function() {
		my.setHintText();
	});

	$("#stateOrCountyFlowsButton").hover(function() {
		$("#hintText").text("Switch between state or county level flows");
	}, function() {
		my.setHintText();
	});

	$("#necklaceMapButton").hover(function() {
		$("#hintText").text("Show/hide flows going to/from other states");
	}, function() {
		my.setHintText();
	});

	$("#innerFlowsButton").hover(function() {
		$("#hintText").text("Show/hide flows entirely within the selected state");
	}, function() {
		my.setHintText();
	});

	$("#netOrTotalFlowsButton").hover(function() {
		$("#hintText").text("Switch between net or total flows");
	}, function() {
		my.setHintText();
	});

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
		$("#layoutProgress").width(progress + "%");
	};

	my.showLayoutProgressBar = function() {
		$("#layoutProgressBar").removeClass("hidden");
	};
	
	my.hideLayoutProgressBar = function() {
		$("#layoutProgressBar").addClass("hidden");
	};

	my.hidePanelButton = function(targetButtonID) {
		$("#" + targetButtonID).animate({
				"height": "0px",
				"width": "0px",
				"margin-right": "0px",
				"margin-left": "-2px",
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
				"height": "50px",
				"width": "60px",
				"margin-right": "2px",
				"margin-left": "2px",
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
	
	my.setHintText = function() {
		var settings = Flox.getFilterSettings(),
			hintText = $("#hintText");
		
		if(settings.selectedState === false) {
			// no state is selected
			hintText.text("Click a state to see flows for that state");
		} else {
			// A state IS selected
			// Is it in county mode?
			if(settings.countyMode) {
				hintText.text("Click a county, or click a different state")
			} else {
				// we're viewing flows to and from one state. 
				hintText.text("View county flows by clicking the counties menu button")
			}
		}
	};
	
	// Show and hide buttons and set button icons based on current model 
	// and filter settings.
	my.updateGUI = function() {
		var settings = Flox.getFilterSettings(),
			hideThese = [],
			showThese = [];
		
		if(settings.selectedCounty !== false || settings.stateMode) {
			// A county is selected . The state/county button should show counties.
			$("#stateOrCountyFlowsButton").find("img")
				.attr("src", "resources/icons/buttons/counties_white.svg")
				.attr("id", "counties");
		}
		
		if(settings.selectedState === false) {
			// no state is selected
			hideThese.push("usStateFlowsButton");
			hideThese.push("stateOrCountyFlowsButton");
		} else {
			showThese.push("usStateFlowsButton");
			showThese.push("stateOrCountyFlowsButton");
		}
		
		if(settings.selectedState && settings.countyMode) {
			showThese.push("necklaceMapButton");
		} else {
			hideThese.push("necklaceMapButton");
		}
		
		if(settings.selectedState !== false && settings.countyMode) {
			showThese.push("innerFlowsButton");	
		} else {
			hideThese.push("innerFlowsButton");
		}
		// if it's not hovering over a button, set the hint text
		// if ($('.panelButtonContainer:hover').length === 0) {
		    // my.setHintText();
		// }
		//my.setHintText();
		my.hidePanelButtons(hideThese);
		my.showPanelButtons(showThese);
		updateTitle();
	};

// DEBUG GUI STUFF ------------------------------------------------------------

$("#globalFlowWidthCheckbox").on("click", function() {
	console.log("checkbox clicked!");
	Flox.getModel().settings.useGlobalFlowWidth = this.checked;
	Flox.updateMap();
});



	return my;

}($));
