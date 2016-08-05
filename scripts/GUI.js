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
			settings.selectedState = false;
			settings.selectedCounty = false;
			settings.stateMode = true;
			settings.countyMode = false;
			Flox.importStateToStateMigrationFlows();
			// Could this instead call updateMap?
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
				// into state mode, but showing only flows for the selected
				// state
				settings.countyMode = false;
				settings.stateMode = true;
				
				// The button will show what happens when you click it. It
				// will turn back to county mode, so show the counies icon
				buttonIcon.attr("src", "resources/icons/buttons/counties_white.svg")
						  .attr("id", "counties");
				
				Flox.importStateToStateMigrationFlows(true);
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
	
	// boo : true if turning ON, false if turning OFF.
	function toggleButtonIcon(buttonID, boo) {
		console.log("toggling " + buttonID + " " + boo);
		buttonID = buttonID[0] === "#" ? buttonID : "#" + buttonID;
		var buttonIcon = $(buttonID).find("img"),
			max_height = boo ? "100%" : "70%",
			opacity = boo ? 1 : 0.3;
		buttonIcon.animate({
			"max-height": max_height,
			"opacity": opacity
		}, 200);
	}
	
	// Make sure the buttons match the current settings.
	function updateFlowTypeRadioButtons(){
		console.log("updating buttons!");
		var settings = Flox.getFilterSettings(),
			flowType = settings.flowType,
			settingList = ["net", "total", "incoming", "outgoing"],
			i;
		for(i = 0; i < settingList.length; i += 1) {
			if(flowType === settingList[i]) {
				toggleButtonIcon(settingList[i] + "FlowsButton", true);
			} else {
				toggleButtonIcon(settingList[i] + "FlowsButton", false);
			}
		}
	}
	
	$("#necklaceMapButton").click(
		function() {
			var buttonIcon = $(this).find("img"),
				settings = Flox.getFilterSettings(); 
			if(settings.outerStateFlows === true) {
				settings.outerStateFlows = false;
				toggleButtonIcon("necklaceMapButton", false);
				if(settings.inStateFlows === false) {
					settings.inStateFlows = true;
					toggleButtonIcon("innerFlowsButton", true);
				}
			} else {
				settings.outerStateFlows = true;
				toggleButtonIcon("necklaceMapButton", true);
			}
			
			// Only do something if it's not in state mode
			if(settings.stateMode === false) {
				Flox.updateMap();
			}
		}
	);
	
	// $("#innerFlowsButton").click(
		// function() {
			// var buttonIcon = $(this).find("img"),
				// settings = Flox.getFilterSettings();
			// if(settings.inStateFlows === true) {
				// toggleButtonIcon("innerFlowsButton", false);
				// if(settings.outerStateFlows === false) {
					// settings.outerStateFlows = true;
					// toggleButtonIcon("necklaceMapButton", true);
				// }
			// } else {
				// toggleButtonIcon("innerFlowsButton", true);
			// }
			// settings.inStateFlows = !settings.inStateFlows;
			// if(settings.stateMode === false) {
				// Flox.updateMap();
			// }
		// }
	// );
	
	
	
	$("#incomingFlowsButton").click(
		function() {
			var settings = Flox.getFilterSettings();
			
			if(settings.flowType !== "incoming") {
				settings.flowType = "incoming";
			}
			updateFlowTypeRadioButtons();
			
			// Only updateMap if a state or county is selected
			if(settings.selectedCounty !== false || settings.selectedState !== false) {
				Flox.updateMap();
			}
		}
	);
	
	$("#outgoingFlowsButton").click(
		function() {
			var settings = Flox.getFilterSettings();
			
			if(settings.flowType !== "outgoing") {
				settings.flowType = "outgoing";
			}
			updateFlowTypeRadioButtons();

			// Only updateMap if a state or county is selected
			if(settings.selectedCounty !== false || settings.selectedState !== false) {
				Flox.updateMap();
			}
		}
	);
	
	$("#netFlowsButton").click(
		function() {
			var settings = Flox.getFilterSettings();
			
			if(settings.flowType !== "net") {
				settings.flowType = "net";
			}
			updateFlowTypeRadioButtons();
			Flox.updateMap();
		}
	);
	
	$("#totalFlowsButton").click(
		function() {
			var settings = Flox.getFilterSettings();
			
			if(settings.flowType !== "total") {
				settings.flowType = "total";
			}
			updateFlowTypeRadioButtons();
			Flox.updateMap();
		}
	);
	
	// $("#netOrTotalFlowsButton").click(
		// function() {
			// var buttonIcon = $(this).find("img"),
				// settings = Flox.getFilterSettings();
			// if(settings.netFlows === false) {
				// settings.netFlows = true;
				// buttonIcon.attr("src", "resources/icons/buttons/netFlows_white.svg")
						  // .attr("id", "netFlows");
			// } else {
				// settings.netFlows = false;
				// buttonIcon.attr("src", "resources/icons/buttons/totalFlows_white.svg")
						  // .attr("id", "totalFlows");
			// }
			// Flox.updateMap();
		// }
	// );
	
	
	
	// This works.
	// TODO is this obsolete?
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
							bottom: -(h - 28) + "px"
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

	// TopX + filter + description + location
	function updateTitleBetter () {
		var subtitle = $("#subtitleText"),
			settings = Flox.getFilterSettings(),
			topX,
			filter,
			description,
			location;
			
		// How many flows are being shown?
		topX = "Top 50 ";
		
		// What kind of flows? How are they filtered?
		// Either incoming, outgoing, net, or total.
		// They can only be incoming or outgoing if a state or county is selected,
		// AND they aren't net or total.
		// It might be better to have a filter setting like "flowType"
		// That would be the least ambiguous. I'm trying not to change
		// the filter module here. But maybe I should. 
			
			
	}
	
	
	
	function updateTitle() {
		var subtitle = $("#subtitleText"),
			settings = Flox.getFilterSettings(),
			netOrTotal = settings.netFlows ? "net" : "total",
			enteringOrLeaving = "for";
		
		if(settings.incoming===false) {
			enteringOrLeaving = "leaving";
		}
		if(settings.outgoing===false) {
			enteringOrLeaving = "entering";
		}
		
		// state flows, but no state selected
		if(settings.stateMode && settings.selectedState === false) {
			subtitle.html("Top 50 state-to-state " + netOrTotal + " flows");
		}
		
		// state flows, state selected
		if(settings.stateMode && settings.selectedState !== false) {
			subtitle.html("Top 50 " + netOrTotal + " flows " + enteringOrLeaving + " " + settings.selectedFeatureName);
		}
		
		// county flows, no county selected
		if(settings.countyMode && settings.selectedCounty === false) {
			
			if(settings.inStateFlows && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + " flows for " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows && settings.outerStateFlows === false) {
				subtitle.html("Top 50 " + netOrTotal + " flows within " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + enteringOrLeaving + " " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows === false) {
				subtitle.html("No flows shown");
			}
		}

		// county flows, county selected
		if(settings.countyMode && settings.selectedCounty !== false) {
			
			if(settings.inStateFlows && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + " flows " + enteringOrLeaving + " " + settings.selectedFeatureName);
			}
			
			if(settings.inStateFlows && settings.outerStateFlows === false) {
				subtitle.html("Top 50 " + netOrTotal + " flows " + enteringOrLeaving + " " 
								+ settings.selectedFeatureName + " to or from counties of the same state");
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows) {
				subtitle.html("Top 50 " + netOrTotal + " county flows " + enteringOrLeaving + " " 
								+ settings.selectedFeatureName + " to or from other states");
			}
			
			if(settings.inStateFlows === false && settings.outerStateFlows === false) {
				subtitle.html("No flows shown");
			}
		}
	}

	// Set the button icons based on current filter settings.
	// There is only 1 button that needs this update right now, but
	// there could be more later (who knows where this is going!).
	function updateButtonIcons() {
		// make sure the county/state flows button is showing the correct icon.
		var stateOrCountyFlowsButtonIcon = $("#stateOrCountyFlowsButton").find("img"),
			settings = Flox.getFilterSettings();
		
		// There is really only one case where this button isn't being updated
		// properly, and that's when...I forget. 
		// Oh, when a state is clicked while viewing a county flow. 
		// When a state is clicked, it'll always go into multi-county viewing
		// mode. So, a state is selected, but no county is selected.
		if(settings.countyMode && settings.selectedCounty === false) {
			// should look like a solid state.
			stateOrCountyFlowsButtonIcon.attr("src", "resources/icons/buttons/state_white.svg")
						  .attr("id", "state");
		}
	}

	// Change the hint text when hovering over buttons
	$(".panelButtonContainer").hover(function() {
		// get the id of this.
		var hintText;
		switch($(this).attr("id")){
			case "usStateFlowsButton":
				hintText = "Display state-to-state flows for the US";
				break;
			case "stateOrCountyFlowsButton":
				hintText = "Switch between state or county level flows";
				break;
			case "necklaceMapButton":
				hintText = "Show/hide flows going to/from other states";
				break;
			case "innerFlowsButton":
				hintText = "Show/hide flows entirely within the selected state";
				break;
			case "incomingFlowsButton":
				hintText = "Show/hide incoming flows";
				break;
			case "outgoingFlowsButton":
				hintText = "Show/hide outgoing flows";
				break;
			case "netOrTotalFlowsButton":
				hintText = "Switch between net or total flows";
				break;
		}
		$("#hintText").text(hintText);
	}, function(){
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
		console.log("updateGUI called");
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
		
		if((settings.stateMode && settings.selectedState !== false) ||
			(settings.countyMode && settings.selectedCounty !== false)) {
			showThese.push("incomingFlowsButton");
			showThese.push("outgoingFlowsButton");
		} else {
			hideThese.push("incomingFlowsButton");
			hideThese.push("outgoingFlowsButton");
		}
		
		// if it's not hovering over a button, set the hint text
		// if ($('.panelButtonContainer:hover').length === 0) {
		    // my.setHintText();
		// }
		//my.setHintText();
		updateButtonIcons();
		my.hidePanelButtons(hideThese);
		my.showPanelButtons(showThese);
		//updateTitle();
	};

// DEBUG GUI STUFF ------------------------------------------------------------

$("#globalFlowWidthCheckbox").on("click", function() {
	console.log("checkbox clicked!");
	Flox.getModel().settings.useGlobalFlowWidth = this.checked;
	Flox.updateMap();
});

$("#mfooCheckbox").on("click", function() {
	console.log(this.checked);
	Flox.getModel().settings.moveFlowsIntersectingObstacles = this.checked;
	Flox.updateMap();
});

$("#moveFlowsOffArrowheads").on("click", function() {
	console.log(this.checked);
	Flox.getModel().settings.moveFlowsOffArrowheads = this.checked;
	Flox.updateMap();
});

$("#moveFlowsOffNodes").on("click", function() {
	console.log(this.checked);
	Flox.getModel().settings.moveFlowsOffNodes = this.checked;
	Flox.updateMap();
});

	return my;

}($));
