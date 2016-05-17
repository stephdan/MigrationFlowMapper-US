Flox.FlowImporter = ( function(d3) {
	"use strict";

	var my = {};

	function findNodeID(nodes, id) {

		var i, j;

		// Loop through the nodes.
		// If node.id matches id, return the node!
		for ( i = 0,
		j = nodes.length; i < j; i += 1) {
			if (nodes[i].id === id) {
				return nodes[i];
			}
		}
		//console.log("It's not in there!");
		return false;
		// It's not in there!
	}

	function importTotalCountyFlowData(flowPath, countyNodes, callback) {
		d3.csv(flowPath, function(flowData) {
			
			var aFIPS,
			    bFIPS,
			    flow,
			    flows = [],
			    i, j,
			    aPt,
			    bPt,
			    BtoA,
			    AtoB,
			    flowAB,
			    flowBA;

			// For each row in the table...
			for ( i = 0, j = flowData.length; i < j; i += 1) {
				
				aFIPS = flowData[i].placeA_FIPS; // FIPS of A node
				bFIPS = flowData[i].placeB_FIPS; // FIPS of B node

				aPt = findNodeID(countyNodes, aFIPS); // Get node A from countyNodes
				bPt = findNodeID(countyNodes, bFIPS); // Get node B from countyNodes
				
				if (aPt && bPt) { // If both points exist in county nodes...
					BtoA = Number(flowData[i].BtoA); // Get the value of BtoA flow
					AtoB = Number(flowData[i].AtoB); // Get the value of AtoB flow
					flowBA = new Flox.Flow(bPt, aPt, BtoA); // Make the BtoA flow
					flowAB = new Flox.Flow(aPt, bPt, AtoB); // make the AtoB flow
					
					// If the value of BA is bigger than 0...
					if(BtoA > 0) {
						//flowBA.oppositeFlow = flowAB; // Assign AB as opposite. But it could be 0!
						flows.push(flowBA);
					}
					
					if(AtoB > 0) {
						//flowAB.oppositeFlow = flowBA;
						flows.push(flowAB);
					}
				}
			}
			callback(flows);
		});
	}


// PUBLIC ---------------------------------------------------------------------


	/**
	 * Imports a CSV file into the model
	 *
	 * @param {string} path File path to CSV.
	 */
	my.importCSV = function(path) {

		// d3 has a convenient csv importer funtion
		d3.csv(path, function(data) {

			var i,
			    j,
			    sLat,
			    sLng,
			    eLat,
			    eLng,
			    value,
			    startPt,
			    endPt,
			    sVal,
			    eVal;

			for ( i = 0,
			j = data.length; i < j; i += 1) {
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

				Flox.addFlow(new Flox.Flow(startPt, endPt, value));
			}

			// Refresh the map. This will wait until the .csv is fully loaded.
			// This is because it is placed within the d3.csv() function.
			// If FloxController called refreshmap, it would run before
			// the CSV is fully loaded. D3 creates this delay here.
			Flox.sortFlows();

			Flox.setFilteredFlows();

			Flox.layoutFlows();

			Flox.refreshMap(); // FIXME this should happen in a callback.
		});
	};

	/**
	 * Imports a CSV file containing formatted US Census county centroids to
	 * be used as nodes for county-to-county flow data.
 * @param {Object} nodePath : Path to CSV
 * @param {Object} callback : Called after CSV is fully imported, with the 
 * imported nodes as an argument.
	 */
	my.importUSCensusCountyNodes = function(nodePath, callback) {
		d3.csv(nodePath, function(nodeData) {
			
			var i,
			    lat,
			    lng,
			    id,
			    val,
			    propt,
			    startPt,
			    endPt,
			    newPt,
			    nodes = [];

			for ( i = 0; i < nodeData.length; i += 1) {
				if (!nodeData[i].value) {
					val = 1;
				} else {
					val = nodeData[i].val;
				}

				newPt = new Flox.Point(Number(nodeData[i].latitude), Number(nodeData[i].longitude), 1, nodeData[i].FIPS);

				newPt.STUSPS = nodeData[i].STUSPS;
				newPt.name = nodeData[i].NAME;

				// new point migth not have an xy if the latLng is outside the
				// d3 projection boundary, which causes errors. Don't add it to 
				// nodes if so. Flows with these point's won't be added to the 
				// model.
				// FIXME Use a projection that enables showing everything.
				if (newPt.x && newPt.y) {
					nodes.push(newPt);
				} else {
					//console.log("Node " + newPt.id + " was omitted from the map");
				}
			}
			callback(nodes);
		});
	};

	/**
	 * Imports the US Census county to county flows for one state.
 * @param {Object} nodePath : Path to US County centroid CSV file.
 * @param {Object} flowPath : Path to Census flow data for a state.
 * @param {Object} callback : Called after all CSVs are loaded.
	 */
	my.importTotalCountyFlowData = function(nodePath, flowPath, callback) {		
		// Import nodes for all counties
		my.importUSCensusCountyNodes(nodePath, function(countyNodes) {
			// countyNodes is the imported nodes!
			importTotalCountyFlowData(flowPath, countyNodes, function(flows) {
				// flows are the imported flows!
				callback(flows);
			});
		});
	};



	my.importStateMigrationData = function(nodePath, flowPath) {
		// Arrays to store the stuff
		var nodes = [],
		    flows = [];

		// The node data is easy.
		d3.csv(nodePath, function(nodeData) {

			var i,
			    lat,
			    lng,
			    id,
			    val,
			    propt,
			    startPt,
			    endPt,
			    nodes = [];

			for ( i = 0; i < nodeData.length; i += 1) {
				if (!nodeData[i].value) {
					val = 1;
				} else {
					val = nodeData[i].val;
				}
				nodes.push(new Flox.Point(Number(nodeData[i].latitude), Number(nodeData[i].longitude), 1, nodeData[i].id));
			}

			//console.log(nodes);

			d3.csv(flowPath, function(flowData) {

				var endID,
				    startID,
				    flow,
				    j;

				// For each row in the table...
				for ( j = 0; j < flowData.length; j += 1) {

					// destination is the id of the endPt
					endID = flowData[j].destination;

					// Find the node with the same ID
					endPt = findNodeID(nodes, endID);

					// For each column in the table...
					for (startID in flowData[j]) {

						// if originID matches one if the ids in nodes
						startPt = findNodeID(nodes, startID);

						if (startPt && endPt && (startPt && endID !== startID)) {

							// get the value!
							val = Number(flowData[j][startID]);

							// Make a flow out of the start point and end point!
							//flows.push(new Flow(startPt, endPt, val));
							if (val > 0) {
								Flox.addFlow(new Flow(startPt, endPt, val));
							}
						}
					}
				}

				Flox.setUseNetFlows(true);

				Flox.layoutFlows();

				Flox.refreshMap(); // FIXME this should happen in a callback.
				//console.log(flows);
				//return flows;

				// Add the flows to the model and render them!

			});

		});
	};

	return my;
}(d3));
