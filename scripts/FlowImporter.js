
Flox.FlowImporter = (function(d3) {
	"use strict";
	
	var my = {};
	
	
	function findNodeID (nodes, id) {
		
		var i, j;
		
		// Loop through the nodes. 
		// If node.id matches id, return the node!
		for (i = 0, j = nodes.length; i < j; i += 1) {
			if (nodes[i].id === id) {
				return nodes[i];
			}
		}
		return false; // It's not in there!
	}
	
	
	/**
	 * Imports a CSV file into the model
	 * 
     * @param {string} path File path to CSV.
	 */
    my.importCSV = function(path) {

		// d3 has a convenient csv importer funtion
        d3.csv(path, function(data) {

			var i, j, sLat, sLng, eLat, eLng, value, startPt, endPt, sVal, eVal;
			
            for (i = 0, j = data.length; i < j; i += 1) {
                // For every line, build a flow
                sLng = Number(data[i].lng0);
                sLat = Number(data[i].lat0);
                sVal = Number(data[i].val0);
                eLng = Number(data[i].lng1);
                eLat = Number(data[i].lat1);
                eVal = Number(data[i].val1);
                value = Number(data[i].value);

                startPt = new Flox.Point(sLat, sLng, sVal);
                endPt = new Flox.Point(eLat, eLng, eVal);

                Flox.addFlow(new Flow(startPt, endPt, value));
            }

            // Refresh the map. This will wait until the .csv is fully loaded. 
            // This is because it is placed within the d3.csv() function. 
            // If FloxController called refreshmap, it would run before
            // the CSV is fully loaded. D3 creates this delay here. 
            Flox.sortFlows();
            
            Flox.setFilteredFlows();
            
            Flox.layoutFlows();
            
            Flox.refreshMap();
        });
    };
    
	my.importStateMigrationData = function(nodePath, flowPath) {
		// Arrays to store the stuff
		var nodes = [],
			flows = [];
		
		// The node data is easy. 
		d3.csv(nodePath, function(nodeData){
			
			var i, lat, lng, id, val, propt, startPt, endPt, nodes = [];
			
			for (i = 0; i < nodeData.length; i += 1) {
				if (!nodeData[i].value) {
					val = 1;
				} else {
					val = nodeData[i].val;
				}
				nodes.push(new Flox.Point(Number(nodeData[i].latitude), 
										  Number(nodeData[i].longitude), 
										  1,
										  nodeData[i].id));
			}
			
			//console.log(nodes);	
			
			d3.csv(flowPath, function(flowData) {
				
				var endID, startID, flow, j;
				
				// For each row in the table...
				for (j = 0; j < flowData.length; j += 1) {
					
					// destination is the id of the endPt
					endID = flowData[j].destination;
					
					// Find the node with the same ID
					endPt = findNodeID(nodes, endID);
					
					// For each column in the table...
					for (startID in flowData[j]) {
						
						// if originID matches one if the ids in nodes
						startPt = findNodeID(nodes, startID);
						
						if (startPt && endID !== startID) {
							
							// get the value!
							val = Number(flowData[j][startID]);
							
							// Make a flow out of the start point and end point!
							//flows.push(new Flow(startPt, endPt, val));
							if(val > 0) {
								Flox.addFlow(new Flow(startPt, endPt, val));
							}
						}
					}
				}
				
				Flox.sortFlows();
				
				Flox.setFilteredFlows();
				
				Flox.layoutFlows();
				
				Flox.refreshMap();
				//console.log(flows);
				//return flows;
				
				// Add the flows to the model and render them!
				
				
			});
			
			
		});
	};
    
    
	return my;
}(d3));