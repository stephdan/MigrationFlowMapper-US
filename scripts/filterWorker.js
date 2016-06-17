(function(){
"use strict";

importScripts("Flox.js",
			  "Flow.js",
			  "FloxModel.js",
			  "ModelFilter.js");	


onmessage = function(e) {
	
	var model,
		filteredModel,
		filteredModelJSON;
	
	// e is json, you need to turn that into a model.
	model = new Flox.Model();
	model.deserializeModelJSON(e.data);
	
	filteredModel = Flox.filterBySettings(model, e.data.filterSettings);
	
	filteredModelJSON = filteredModel.toJSON();
	
	// pass back out a filtered model
	postMessage(filteredModelJSON);
	
};

	
}());
