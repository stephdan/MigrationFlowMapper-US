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
			Flox.setSelectedState(false);
			Flox.setSelectedCounty(false);
			Flox.setStateMode(true);
			Flox.setCountyMode(false);
			Flox.importStateToStateMigrationFlows();
			// Could this instead call updateMap?
		}
	);
	
	// TODO this is kindof a mess
	$("#stateOrCountyFlowsButton").click(
		function() {
			var buttonIcon = $(this).find("img");
			
			if(Flox.getSelectedCounty() !== false) {
				console.log("A county is selected: " + Flox.getSelectedCounty());
				// Import the county-to-county data for that state again. No
				// need to go all zoomy. 
				Flox.setSelectedCounty(false);
				Flox.selectState(Flox.getSelectedState());
				return;
			}
			
			if(Flox.isCountyMode()) {
				// It's in county mode. So get it out of county mode! And 
				// into state mode, but showing only flows for the selected
				// state
				Flox.setCountyMode(false);
				Flox.setStateMode(true);
				
				// The button will show what happens when you click it. It
				// will turn back to county mode, so show the counies icon
				buttonIcon.attr("src", "resources/icons/buttons/counties_white.svg")
						  .attr("id", "counties");
				
				Flox.importStateToStateMigrationFlows(true);
				return;
			} else if (Flox.isCountyMode() === false) {
				// It's not in county mode. Put it in county mode!
				Flox.setCountyMode(true);
				Flox.setStateMode(false);
				
				// The button will show what happens when you click it. It
				// will turn back to county mode, so show the counies icon
				buttonIcon.attr("src", "resources/icons/buttons/state_white.svg")
						  .attr("id", "state");
						  
				// if a state is selected, show the county flows in that state.
				if(Flox.getSelectedState() !== false) {
					// This is weird. A state should already be selected here. 
					// But this initiates the zoom thing though. Which is nice.
					Flox.selectState(Flox.getSelectedState());
					
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
		//console.log("toggling " + buttonID + " " + boo);
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
		var flowType = Flox.getFlowType(),
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
	
	my.updateFlowTypeRadioButtons = function() {
		updateFlowTypeRadioButtons();
	};
	
	$("#necklaceMapButton").click(
		function() {
			var buttonIcon = $(this).find("img");		
			if (Flox.isOuterStateFlows()) {
				Flox.setOuterStateFlows(false);
				toggleButtonIcon("necklaceMapButton", false);
				if(Flox.isInStateFlows() === false) {
					Flox.setInStateFlows(true);
					toggleButtonIcon("innerFlowsButton", true);
				}
				// Change the hint text
				$("#hintText").text("Show flows to or from other states");
				
			} else {
				Flox.setOuterStateFlows(true);
				toggleButtonIcon("necklaceMapButton", true);
				$("#hintText").text("Hide flows to or from other states");
			}
			
			// Only do something if it's not in state mode
			if(Flox.isStateMode() === false) {
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
			if(Flox.getFlowType() !== "incoming") {
				Flox.setFlowType("incoming");
			}
			updateFlowTypeRadioButtons();
			// Only updateMap if a state or county is selected
			if(Flox.getSelectedCounty() !== false || Flox.getSelectedState() !== false) {
				Flox.updateMap();
			}
		}
	);
	
	$("#outgoingFlowsButton").click(
		function() {
			if(Flox.getFlowType() !== "outgoing") {
				Flox.setFlowType("outgoing");
			}
			updateFlowTypeRadioButtons();

			// Only updateMap if a state or county is selected
			if(Flox.getSelectedCounty() !== false || Flox.getSelectedState() !== false) {
				Flox.updateMap();
			}
		}
	);
	
	$("#netFlowsButton").click(
		function() {
			if(Flox.getFlowType() !== "net") {
				Flox.setFlowType("net");
			}
			updateFlowTypeRadioButtons();
			Flox.updateMap();
		}
	);
	
	$("#totalFlowsButton").click(
		function() {
			if(Flox.getFlowType() !== "total") {
				Flox.setFlowType("total");
			}
			updateFlowTypeRadioButtons();
			Flox.updateMap();
		}
	);
	
	
	
	
	// This works.
	// TODO is this obsolete?
	$("#inStateFlowsToggle").on("click", function() {
		if(Flox.isInStateFlows()) {
			Flox.setInStateFlows(false);
		} else {
			Flox.setInStateFlows(true);
		}
		// Only do something if it's not in state mode
		if(Flox.isStateMode() === false) {
			Flox.updateMap();
		}
	});

	$("#outOfStateFlowsToggle").on("click", function() {		
		if(Flox.isOuterStateFlows()) {
			Flox.setOuterStateFlows(false);
		} else {
			Flox.setOuterStateFlows(true);
		}
		// Only do something if it's not in state mode
		if(Flox.isStateMode() === false) {
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
							bottom: -(h - 32) + "px"
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
							left: "-200px"
						}, 100);
		}
	}
	
	function toggleOptionsSlidingPanel() {
		var slidingPanel = $("#optionsSlidingPanel");
		if(slidingPanel.hasClass("collapsed")) {
			slidingPanel.removeClass("collapsed")
						.animate({
							right: "0px"
						}, 100);
		} else {
			slidingPanel.addClass("collapsed")
						.animate({
							right: "-163px"
						}, 100);
		}
	}
	
	my.toggleSlidingPanel = function() {
		toggleSlidingPanel();
	};
	my.toggleLegendSlidingPanel = function() {
		toggleLegendSlidingPanel();
	};
	my.toggleOptionsSlidingPanel = function() {
		toggleOptionsSlidingPanel();
	};

	$("#slidingPanelTab").on("click", function() {
		// Change the height of if the slidingPanel
		toggleSlidingPanel();
	});

	$("#legendSlidingPanelTab").on("click", function() {
		toggleLegendSlidingPanel();
	});
	
	$("#optionsSlidingPanelTab").on("click", function() {
		toggleOptionsSlidingPanel();
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

	function setSubtitle(newSubtitle) {
		var subtitle = $("#subtitleText"),
			panel = $("#slidingPanelContent"),
			panelWidth = panel.width(),
			panelPadding = panel.outerWidth() - panelWidth,
			fontSize = 16;
		
		//subtitle.hide();
		
		subtitle.css("font-size", fontSize);
		subtitle.text(newSubtitle);
		while (subtitle.width() >=  panelWidth) {
			fontSize -= 0.2;
			subtitle.css("font-size", fontSize);
		}
		
		//subtitle.show();
	}

	// TopX + filter + description + location
	function updateSubtitle() {
		var subtitle = $("#subtitleText"),
			flowCount,
			stateOrCounty,
			flowType,
			preposition,
			location,
			specialCase = "",
			newText,
			nFlows = Flox.getNumberOfDisplayedFlows();
			
		// How many flows are being shown?
		if(Flox.getModel()) {
			if(nFlows === Flox.getCurrentFilteredModel().getFlows().length) {
				flowCount = "All " + nFlows + " ";
			} else {
				flowCount = "Top " + Flox.getModel().settings.maxFlows + " ";
			}
		} else {
			flowCount = "Top "
		}
		
		
		// state-level or county-level
		stateOrCounty = Flox.isStateMode() ? "state-level " : "county-level "
		
		// Incoming, outgoing, net, total?
		flowType = Flox.getFlowType() + " flows "
		
		// for, within, between?
		// for, if a specific state or county is selected
		// within, if it's in county mode, and necklace maps are turned off
		// between, if neither of the above
		if (Flox.getSelectedCounty() !== false) {
			preposition = "for ";
			if(Flox.isOuterStateFlows() === false) {
				specialCase = " just within " + Flox.getSelectedStateName();
			}
		} else if (Flox.getSelectedState() !== false) {
			if (Flox.isCountyMode() && Flox.isOuterStateFlows() === false) {
				preposition = "just within ";
			} else {
				preposition = "for ";
			}
		} else {
			preposition = "between ";
		}
		
		// what place?
		// all US states, if there is no selected state or county
		// countyName, if a county is selected
		// stateName, if a state is selected and no county is selected
		if(Flox.getSelectedCounty() !== false) {
			location = Flox.getSelectedFeatureName();
			if(specialCase === "") {
				location = location + ", " + Flox.getSelectedStateName();
			}
		} else if (Flox.getSelectedState() !== false) {
			location = Flox.getSelectedFeatureName();
		} else {
			location = " US states";
		}
		newText = flowCount + stateOrCounty + flowType + preposition + location + specialCase;
		setSubtitle(newText);
		
		//subtitle.html(flowCount + stateOrCounty + flowType + preposition + location + specialCase);
	}
	
	
	// TODO This is about to become obsolete. It was kindof a shitty and
	// confusing way of going about this. And it's broken now! It's here just 
	// for reference while I make a better one.
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
		
		// Go ahead and update the flow type radio buttons here. 
		updateFlowTypeRadioButtons();
		
		// make sure the county/state flows button is showing the correct icon.
		var stateOrCountyFlowsButtonIcon = $("#stateOrCountyFlowsButton").find("img");
		
		if(Flox.isCountyMode() && Flox.getSelectedCounty() === false) {
			// should look like a solid state.
			stateOrCountyFlowsButtonIcon.attr("src", "resources/icons/buttons/state_white.svg")
						  .attr("id", "state");
		}
	}

	// Change the hint text when hovering over buttons
	$(".panelButtonContainer").mousemove(function(e) {
		// get the id of this.
		var hintText;
		switch($(this).attr("id")){
			case "usStateFlowsButton":
				hintText = "Display state-to-state flows for the entire US";
				break;
			case "stateOrCountyFlowsButton":
				if(Flox.isCountyMode()) {
					if(Flox.getSelectedCounty() !== false) {
						// A county is selected.
						hintText = "Show flows for all counties in the selected state";
					} else {
						hintText = "Show state-level flows for the selected state";
					}
				} else {
					hintText = "Show county-level flows for the selected state";
				}
				break;
			case "necklaceMapButton":
				if(Flox.isOuterStateFlows()){
					hintText = "Hide flows to or from other states";
				} else {
					hintText = "Show flows to or from other states";
				}
			
				
				break;
			case "innerFlowsButton":
				hintText = "Show/hide flows entirely within the selected state";
				break;
			case "incomingFlowsButton":
				hintText = "Show incoming flows";
				break;
			case "outgoingFlowsButton":
				hintText = "Show outgoing flows";
				break;
			case "netFlowsButton":
				hintText = "Show net flows";
				break;
			case "totalFlowsButton":
				hintText = "Show total flows";
				break;
		}
		$("#hintText").text(hintText);
	});

	$(".panelButtonContainer").mouseout(function() {
		my.setHintText();
	});

	/**
	 * 
 * @param {Number} progress - 0 to 100, percentage complete
	 */
	my.updateLayoutProgressBar = function(progress) {
		$("#newProgress").width(progress + "%");
	};

	my.showLayoutProgressBar = function() {
		$("#newProgressBar").removeClass("hidden");
	};
	
	my.hideLayoutProgressBar = function() {
		setTimeout(function(){
			$("#newProgressBar").addClass("hidden");
			$("#newProgress").width("0%");
		}, 100);
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

	my.showPanelButton = function(targetButtonID) {
		var rightMargin = "2px";
		if(targetButtonID === "stateOrCountyFlowsButton" ||
		   targetButtonID === "necklaceMapButton") {
			rightMargin = "20px";
		}
		
		$("#" + targetButtonID).animate({
				"height": "50px",
				"width": "60px",
				"margin-right": rightMargin,
				"margin-left": "2px",
				"opacity": 1
			}, 300, function() {
		});
	};
	
	my.hidePanelButtons = function(buttonArray) {
		var i;
		for(i = 0; i < buttonArray.length; i += 1) {
			my.hidePanelButton(buttonArray[i]);
		}
	};
	
	my.showPanelButtons = function(buttonArray) {
		var i;
		for(i = 0; i < buttonArray.length; i += 1) {
			my.showPanelButton(buttonArray[i]);
		}
	};
	
	my.setHintText = function() {
		var hintText = $("#hintText");
		
		if(Flox.getSelectedState() === false) {
			// no state is selected
			hintText.text("Click a state to see flows for that state");
		} else {
			// A state IS selected
			// Is it in county mode?
			if(Flox.isCountyMode()) {
				hintText.text("Click a different county or state to view different flows");
			} else {
				// we're viewing flows to and from one state. 
				hintText.text("View county-level flows by clicking the counties button below");
			}
		}
	};
	
	// Show and hide buttons and set button icons based on current model 
	// and filter settings.
	my.updateGUI = function() {
		var hideThese = [],
			showThese = [],
			selectedCounty = Flox.getSelectedCounty(),
			selectedState = Flox.getSelectedState(),
			stateMode = Flox.isStateMode(),
			countyMode = Flox.isCountyMode();
			
		
		if(selectedCounty !== false || stateMode) {
			// A county is selected . The state/county button should show counties.
			$("#stateOrCountyFlowsButton").find("img")
				.attr("src", "resources/icons/buttons/counties_white.svg")
				.attr("id", "counties");
		}
		
		if(selectedState === false) {
			// no state is selected
			hideThese.push("usStateFlowsButton");
			hideThese.push("stateOrCountyFlowsButton");
		} else {
			showThese.push("usStateFlowsButton");
			showThese.push("stateOrCountyFlowsButton");
		}
		
		if(selectedState && countyMode) {
			showThese.push("necklaceMapButton");
		} else {
			hideThese.push("necklaceMapButton");
		}
		
		if(selectedState !== false && countyMode) {
			showThese.push("innerFlowsButton");	
		} else {
			hideThese.push("innerFlowsButton");
		}	
		
		if((stateMode && selectedState !== false) ||
			(countyMode && selectedCounty !== false)) {
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
		updateSubtitle();
		my.setHintText();
	};

// DEBUG GUI STUFF ------------------------------------------------------------
$("#minFlowDensity").on("click", function() {
	Flox.getModel().settings.maxFlows = 10;
	Flox.updateMap();
});
$("#lowFlowDensity").on("click", function() {
	Flox.getModel().settings.maxFlows = 25;
	Flox.updateMap();
});
$("#midFlowDensity").on("click", function() {
	Flox.getModel().settings.maxFlows = 50;
	Flox.updateMap();
});
$("#highFlowDensity").on("click", function() {
	Flox.getModel().settings.maxFlows = 75;
	Flox.updateMap();
});
$("#maxFlowDensity").on("click", function() {
	Flox.getModel().settings.maxFlows = 100;
	Flox.updateMap();
});

$("#globalFlowWidthCheckbox").on("click", function() {
	console.log("checkbox clicked!");
	Flox.getModel().settings.useGlobalFlowWidth = !this.checked;
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
