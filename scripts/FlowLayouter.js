// Receives flows, gives them a curve.
// Aka, assigns coordinates to the control points of Flow objects.
// Needs the current map to calculate pixel coordinates.
Flox.FlowLayouter = function (model) {
   
	"use strict";
   
	var	Force, my = {};

    /**
     * A force vector. 
     * @param {Number} fx x direction of this Force
     * @param {Number} fy y direction of this Force
     */
    Force = function(fx, fy) {
        this.fx = fx;
        this.fy = fy;
    };
    /**
     * Return the length of this Force
     */
    Force.prototype.getLength = function() {
        return Math.sqrt(this.fx * this.fx + this.fy * this.fy);
    };
    /**
     * Scale the Force by the provided scale
     */
    Force.prototype.scale = function(scale) {
        this.fx *= scale;
        this.fy *= scale;
    };
    Force.prototype.normalize = function() {
        var l = Math.sqrt(this.fx * this.fx + this.fy * this.fy);
        this.fx /= l;
        this.fy /= l;
    };
    /**
     * Add a Force to this Force.
     * @param {Object} f The force to add.
     */
    Force.prototype.addForce = function(f) {
        this.fx += f.fx;
        this.fy += f.fy;
    };

	/**
	 * Configures the arrows so they will be scaled according to a model with
	 * more flows in it than the maxFlows model passed into drawFeatures. This
	 * allows arrows to be drawn the correct size when viewing individual
	 * county flows. 
	 */
	function configureArrows() {
		var flows, flow, arrowSettings, i, j;
		// get the flows from the model that was passed into FlowLayouter...
		flows = model.getFlows();
		for(i = 0, j = flows.length; i < j; i += 1) {
			flow = flows[i];
			// ...but get the settings from activeModel
			arrowSettings = model.getArrowSettings(flow);
			flow.configureArrow(arrowSettings);
		}
	}

	function angleDif(a1, a2) {
		var val = a1 - a2;
	    if (val > Math.PI) {
	    val -= 2 * Math.PI;
	    }
	    if (val < -Math.PI) {
	        val += 2 * Math.PI;
	    }
	    return val;
	}

    function geometricSeriesPower(a2, exp) {
		
		var a4, a8;
		
		if(exp === 0) {
			return Math.sqrt(a2);
		}
		
        if (exp === 1) {
            return a2;
        }
        a4 = a2 * a2;
        if (exp <= 2) {
            return a4;
        }
        a8 = a4 * a4;
        if (exp <= 3) {
            return a8;
        }
        return a8 * a8;
    }

    /**
     * Add two forces together
     * @param {Object} f1  A Force
     * @param {Object} f2  Another Force
     */
    function addForces(f1, f2) {
        return new Force(f1.fx + f2.fx, f1.fy + f2.fy);
    }

    function boxesOverlap(a, b) {
		if (a.max.x < b.min.x) {return false;} // a is left of b
		if (a.min.x > b.max.x) {return false;} // a is right of b
		if (a.max.y < b.min.y) {return false;}// a is above b
		if (a.min.y > b.max.y) {return false;} // a is below b
		return true; // boxes overlap
    }
    
    function getLongestAxisDistanceBetweenFlowBoundingBoxes(flow1, flow2) {
	
		var dx, dy, 
			box1 = flow1.getCachedBoundingBox(), 
			box2 = flow2.getCachedBoundingBox();
		
		// Do the boxes overlap or touch?
		// This doesn't work
		if (boxesOverlap(box1, box2)) {
			return 0;
		}
		
		if (box1.max.x < box2.min.x) { // box1 is left of box2
			dx = box2.min.x - box1.max.x;
		} else { // box1 is right of box2
			dx = box1.min.x - box2.max.x;
		}
		
		if (box1.max.y < box2.min.y) { // box1 is above box2
			dy = box2.min.y - box1.max.y;
		} else { // box1 is below box2
			dy = box1.min.y - box2.max.y; // can be negative
		}
		
		if (dx > dy) {
			return dx;
		}
		return dy;
	}
    
	/**
	 * Computes the force of all intermediat flow points on the map against a 
	 * target point.
	 * @param targetPoint Forces upon this point will be computed.
	 * @param targetFlow Flow containing the targetPoint
	 */
	function computeForceOnPoint(targetPoint, targetFlow, flowSubset) {
	   
	   // var flows = model.getFlows(), // Get the flows
	    
	        // Get the distance weight exponent
		var distWeightExponent = model.settings.distanceWeightExponent,
			fxTotal = 0, // total force along the x axis
			fyTotal = 0, // total force along the y axis
			wTotal = 0, // sum of the weight of all forces
			i, j, k, flow, points, point, ptID, xDist, yDist, lSq, w, 
			fxFinal, fyFinal, flowDist, flowDistW, threshold,
			skipEndPoints, beginPtID, endPtID;
	
	    // Iterate through the flows. The forces of each flow on the target 
	    // is calculated and added to the total force.
	    for (i = 0, j = flowSubset.length; i< j; i += 1){
	        
	        flow = flowSubset[i];
	        
	        //console.log("shortest distance between bb's: " + flowDist);
	        // set flowDistW. If this number is really small, that means the bounding
	        // boxes are far apart.
	        // If this number is LARGE, than the boxes are close together, yes?
	        // TODO this is kindof messy and I don't really know if I'm doing it right.
	        // On hold until further experimentation is done.
			//flowDistW = 1/geometricSeriesPower(flowDist * flowDist, distWeightExponent);
		
			// TODO the threshold is a constant that needs reviewing. 	        
	        
            // get the points along this flow
			points = flow.getCachedLineSegments();

			// skipEndPoints = Flox.isSkipEndPoints();
// 
			// if (skipEndPoints) {
				// beginPtID = 1;
				// endPtID = 1;
			// } else {
				beginPtID = 0;
				endPtID = 0;
			// }

            // Iterate through the points
            for (ptID = beginPtID, k = points.length - endPtID; ptID < k; ptID += 1) {
                point = points[ptID];

                xDist = targetPoint.x - point.x; // x dist from node to target
                yDist = targetPoint.y - point.y; // y dist from node to target

                // square of euclidean distance from node to target
                lSq = xDist * xDist + yDist * yDist;

                // avoid division by zero
                if (lSq!==0) {
                    // inverse distance weighting
	                w = 1 / geometricSeriesPower(lSq, distWeightExponent);
					
	                // Apply the distance weight to each force
	                xDist *= w;
	                yDist *= w;
	
	                // Add the forces to the totals
	                fxTotal += xDist;
	                fyTotal += yDist;
	                wTotal += w;
                }  
            }
	    }
	
	// Calculate the final force of all nodes on the target point
		if(wTotal!==0) {
			fxFinal = fxTotal; // wTotal;
			fyFinal = fyTotal; // wTotal;
		} else {
			fxFinal = 0;
			fyFinal = 0;
		}
		
	    if(isNaN(fxFinal) || isNaN(fyFinal)) {
			throw new Error("NaN in computeForceOnPoint()!");
	    }
	    return new Force(fxFinal, fyFinal);
	}

	function computeAntiTorsionForce(flow) {
        var basePt = flow.getBaselineMidPoint(),
            cPt = flow.getCtrlPt(),
            dx = basePt.x - cPt.x,
            dy = basePt.y - cPt.y,
            l = Math.sqrt(dx * dx + dy * dy),
            alpha = Math.atan2(dy, dx),
            baselineAzimuth = flow.getBaselineAzimuth(),
            diffToBaseNormal = Math.PI / 2 - baselineAzimuth + alpha,
            torsionF, antiTorsionW, torsionFx, torsionFy;
 
        // Avoid NaN
        if (diffToBaseNormal === Infinity){
			diffToBaseNormal = 0;
        }

        torsionF = Math.sin(diffToBaseNormal) * l;
        antiTorsionW = model.settings.antiTorsionWeight;
        torsionFx = Math.cos(baselineAzimuth) * torsionF * antiTorsionW;
        torsionFy = Math.sin(baselineAzimuth) * torsionF * antiTorsionW;
        return new Force(torsionFx, torsionFy);
    }

/**
	 * Calculates the stiffness of the spring baed on the distance between the
	 * start and end nodes. The closer together the nodes are, the stiffer the
	 * spring usually is.
 * @param {Object} flowBaseLength  Base length of the target flow.
 * @param {Object} maxFlowLength  Longest base length of all flows.
	 */
    function computeSpringConstant(flowBaseLength, maxFlowLength) {

        var relativeFlowLength = flowBaseLength / maxFlowLength,
        flowSpringConstant = (-model.settings.minFlowLengthSpringConstant
                + model.settings.maxFlowLengthSpringConstant) * relativeFlowLength
                + model.settings.minFlowLengthSpringConstant;
        return flowSpringConstant;
    }

	function computeSpringForce (startPt, endPt, springConstant) {
        // Calculates the length of the spring.  The spring is a vector connecting
        // the two points. 
        
        var sX = startPt.x,
			sY = startPt.y,
			eX = endPt.x,
			eY = endPt.y,
			springLengthX = startPt.x - endPt.x, // x-length of the spring
			springLengthY = startPt.y - endPt.y, // y-length of the spring
			springForceX = springConstant * springLengthX,
			springForceY = springConstant * springLengthY;

		// If either force is NaN, flap.
		if (isNaN(springForceX)) {
			springForceX = 0;
		}

		if (isNaN(springForceY)) {
			springForceY = 0;
		}

        return new Force(springForceX, springForceY);
    }
	
	function isEven(i) {
        return ((i % 2) === 0);
    }
	
	function computeNodeForceOnFlow(flow) {
		
		var nodeWeight = model.settings.nodeWeight,
			distWeightExponent = model.settings.distanceWeightExponent,
			xy = {},
			wTotal = 0,
			fxTotal = 0,
			fyTotal = 0,
			nodes = model.getPoints(),
			i, j, node, dx, dy, idw, fxFinal, fyFinal,
			pointOnCurve,
			thingTest, d;
        
        for (i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];

            // If the node is the start or end point of the current flow
            if ((node !== flow.getStartPt() && node !== flow.getEndPt())) {
				// find nearest point on target flow
	            xy.x = node.x;
	            xy.y = node.y;
	            
	            //pointOnCurve = flow.distance(xy);
	            //dx = (pointOnCurve.x - node.x);
	            //dy = (pointOnCurve.y - node.y);
	
				d = flow.distance(xy); // This changes the values inside xy
				
				dx = (xy.x - node.x); // If xy hadn't been changed, these two
				dy = (xy.y - node.y); // values would be 0!
	
	            // compute IDW from distance
	            // avoid division by zero
	            if (d !== 0) {
	                // TODO this could use a different method designed for nodes in
		            // order to get a different distance weight.
		            thingTest = geometricSeriesPower(d * d, distWeightExponent);
		            
		            idw = 1 / geometricSeriesPower(d * d, distWeightExponent);
		            fxTotal += dx * idw;
		            fyTotal += dy * idw;
		            wTotal += idw;
	            }
            }  
        }

        fxFinal = fxTotal / wTotal;
        fyFinal = fyTotal / wTotal;

		if(isNaN(fxFinal)) {
			fxFinal = 0;
		}
		
		if(isNaN(fyFinal)) {
			fyFinal = 0;
		}
		

        // Multiply by the value of the GUI slider for node weight.
        fxFinal *= nodeWeight;
        fyFinal *= nodeWeight;

        return new Force(fxFinal, fyFinal);
	}
	
	// flow: the target flow
    // maxFlowLength: The longest distance between endpoints of all Flows.
    // TODO missing node on flow forces
    function computeForceOnFlow(targetFlow, maxFlowLength) {      

        var basePt = targetFlow.getBaselineMidPoint(),
			cPt = targetFlow.getCtrlPt(),
			flowBaseLength = targetFlow.getBaselineLength(),
			flowPoints = targetFlow.getCachedLineSegments(),
			externalF = new Force(0,0),
			lengthOfForceVectorsSum = 0,
			forceRatio, antiTorsionF, flowSpringConstant, springF, fx, fy,
			finalForce, nodeF,
			i, j, pt, f,
			flowSubset = [],
			flows, 
			flowDistance, // longest axis distance between flow bounding boxes
			flowDistW,
			distWeightExponent = model.settings.distanceWeightExponent,
			threshold = model.settings.flowDistanceThreshold;

		// Get the subset of flows that will exert force on targetFlow
		flows = model.getFlows();
		
		// TODO this was the experimental stuff with ignoring flows that are
		// far away. Not being done now. 
		// for (i = 0, j = flows.length; i < j; i += 1) {
// 			
			// if (flows[i] !== targetFlow) { // Don't add the targetFlow
// 			
				// flowDistance = getLongestAxisDistanceBetweenFlowBoundingBoxes(targetFlow, flows[i]);
				// //console.log("Longest distance between " + targetFlow.getId() + " and " + flows[i].getId() + ": " + flowDistance);	
// 				
				// flowDistW = 1/geometricSeriesPower(flowDistance * flowDistance, distWeightExponent);
				// //console.log("flowDistW: " + flowDistW);
// 				
				// // if flowDistW is high, that means they are close together. 
				// // If it's high enough, add the current flow to the subset
				// if (true){//(flowDistance > 0 && flowDistW > threshold) {
					// //console.log("close together!")
					// flowSubset.push(flows[i]);
				// }
			// }
		// }

        // Iterate through the points along targetFlow
        for (i=0, j = flowPoints.length; i < j; i += 1) {

            pt = flowPoints[i];

            f = computeForceOnPoint(pt, targetFlow, flows);

            // add f to totals
            externalF.addForce(f);
            lengthOfForceVectorsSum += f.getLength();
        }

        // Compute ratio between lengh of total vector and the summed length 
        // of the shorter forces. This is a measure of how peripheral the targetFlow 
        // is.
        forceRatio = externalF.getLength() / lengthOfForceVectorsSum;
		if (isNaN(forceRatio)) {
			forceRatio = 0;
		}

        externalF.fx /= flowPoints.length;
        externalF.fy /= flowPoints.length;

        // compute anti-torsion force of targetFlow
        // FIXME producing NaN
        antiTorsionF = computeAntiTorsionForce(targetFlow);

        // Compute spring force of targetFlow
        flowSpringConstant = computeSpringConstant(flowBaseLength, 
			maxFlowLength); 

        flowSpringConstant *= forceRatio * forceRatio 
                           * model.settings.peripheralStiffnessFactor + 1;
        
        springF = computeSpringForce(basePt, cPt, flowSpringConstant);

		nodeF = computeNodeForceOnFlow(targetFlow);

        // Add up the forces, return a new force
        fx = externalF.fx + springF.fy + antiTorsionF.fx + nodeF.fx;
        fy = externalF.fy + springF.fy + antiTorsionF.fy + nodeF.fy;
		
		finalForce = new Force(fx, fy);

        return finalForce;
    }


	function angularW(angleDiff){
		// FIXME hard-coded parameter
		var K = 4,
		    w = Math.exp(-K * angleDiff * angleDiff);
		return (angleDiff < 0) ? -w : w;
	}

	function computeAngularDistributionForce(flow) {
		
        var startPoint = flow.getStartPt(),
			endPoint = flow.getEndPt(),
			startToCtrlAngle = flow.startToCtrlAngle(),
			endToCtrlAngle = flow.endToCtrlAngle(),
			startAngleSum = 0,
			endAngleSum = 0,
			flows = model.getFlows(),
			i, j, f, fStart, fEnd, fStartToCtrlAngle, d, fEndToCtrlAngle,
			startVectorLength, endVectorLength, startDir, endDir,
			startTangentX, startTangentY, endTangentX, endTangentY,
			angularDistributionWeight, vectX, vectY, force, K, d1, d2,
			lmax, l;

        // Iterate over flows
        for (i = 0, j = flows.length; i < j; i += 1) {
            f = flows[i];
            if ( f !== flow) {
                fStart = f.getStartPt();
	            fEnd = f.getEndPt();
	
	            if (startPoint === fStart) {
	                fStartToCtrlAngle = f.startToCtrlAngle();
	                d = angleDif(startToCtrlAngle, fStartToCtrlAngle);
	                startAngleSum += angularW(d);
	            }
	
	            if (startPoint === fEnd) {
	                fEndToCtrlAngle = f.endToCtrlAngle();
	                d = angleDif(startToCtrlAngle, fEndToCtrlAngle);
	                startAngleSum += angularW(d);
	            }
	
	            if (endPoint === fStart) {
	                fStartToCtrlAngle = f.startToCtrlAngle();
	                d = angleDif(endToCtrlAngle, fStartToCtrlAngle);
	                endAngleSum += angularW(d);
	            }
	
	            if (endPoint === fEnd) {
	                fEndToCtrlAngle = f.endToCtrlAngle();
	                d = angleDif(endToCtrlAngle, fEndToCtrlAngle);
	                endAngleSum += angularW(d);
	            }
            }
        }

        startVectorLength = startAngleSum * flow.getDistanceBetweenStartPointAndControlPoint();
        endVectorLength = endAngleSum * flow.getDistanceBetweenEndPointAndControlPoint();

        // direction vectors between start/end points and the control point
        startDir = flow.getDirectionVectorFromStartPointToControlPoint();
        endDir = flow.getDirectionVectorFromEndPointToControlPoint();

        // vector tangent to the circle around the start point
        startTangentX = -startDir[1] * startVectorLength;
        startTangentY = startDir[0] * startVectorLength;

        // vector tangent to the circle around the end point
        endTangentX = -endDir[1] * endVectorLength;
        endTangentY = endDir[0] * endVectorLength;

        // sum the two vectors
        angularDistributionWeight = model.settings.angularDistributionWeight;
        vectX = startTangentX + endTangentX;
        vectY = startTangentY + endTangentY;
        force = new Force(vectX, vectY);

        // limit the lenght of the total vector
        // FIXME hard coded parameter
        K = 4;
        d1 = flow.getDistanceBetweenEndPointAndControlPoint();
        d2 = flow.getDistanceBetweenStartPointAndControlPoint();
        lmax = Math.min(d1, d2) / K;
        l = force.getLength();
        if (l > lmax) {
            force.scale(lmax / l);
        }

        // scale by weight
        force.scale(angularDistributionWeight);
        
        if(isNaN(force.fx)){
			console.log("NaN in computeAngularDistributionForce!");
        }
        
        if(isNaN(force.fy)){
			console.log("NaN in computeAngularDistributionForce!");
        }
        
        return force;
    }

	/**
	 * Performs s single iteration of the force-directed layout method.
     * @param weight Number from 0 to 1, determines strength of forces in 
	 * this iteration.
	 */
    function layoutAllFlows(weight) {
		
		var forces = [],
			flows = model.getFlows(),
			i, j, 
			maxFlowLength = model.settings.maxFlowLength,
			angularDistForces = [],
			flowID, flow, fnew, f, ctrlPt, angularDistWeight, angularDistForce,
			newCPtX, newCPtY, tempPoint,
			activeModel;
		
		for (i=0, j = flows.length; i < j; i += 1) {
            forces.push(new Force(0,0));
        }
		
        // If there are less than 2 flows, do nothing.
        if (flows.length===undefined || flows.length < 2) {
            console.log("There are fewer than 2 flows");
            return;
        }

        // Create points along flows
        model.cacheAllFlowLineSegments();
        model.cacheAllFlowBoundingBoxes();

		if(model.settings.drawArrows) {
			configureArrows();
		}

        // Angular distribution forces
        for (i = 0, j = flows.length; i < j; i += 1) {
			angularDistForces.push(new Force(0,0));
        }

        // Iterate through the Flows
        for (flowID = 0; flowID < flows.length; flowID += 1) {

            flow = flows[flowID];
            
            if(!flow.isLocked()) {
				// compute the force exerted by flows and nodes
	            fnew = computeForceOnFlow(flow, maxFlowLength); 
	
	            f = forces[flowID];

	            f.fx = fnew.fx;
	            f.fy = fnew.fy;
	
				angularDistForces[flowID] = computeAngularDistributionForce(flow);
            }   
        }

        // Apply forces onto control points of each flow
        // iterate over flows again
        for (i = 0, j = flows.length; i < j; i += 1) {
            flow = flows[i];
            if(!flow.isLocked()) {
                ctrlPt = flow.getCtrlPt();
	
	            f = forces[i];
	
	            // Add the forces to the control point of the flow
	            ctrlPt.x = ctrlPt.x + weight * f.fx;
	            ctrlPt.y = ctrlPt.y + weight * f.fy;
	
				// Angular distribution weight gets larger with each iteration.
	            angularDistWeight = weight * (1 - weight);
	            angularDistForce = angularDistForces[i];				

	            //ctrlPt.x = ctrlPt.x + angularDistWeight * angularDistForce.fx;
	            //ctrlPt.y = ctrlPt.y + angularDistWeight * angularDistForce.fy;
	
	            if(model.settings.enforceRangebox) {	                
	                flow.enforceRangebox(model.settings.flowRangeboxHeight);
	            }
	            
	            // reset the latLng of ctrlPt
	            ctrlPt.lat = undefined;
	            ctrlPt.lng = undefined;
            }
        }
    }  
	
    /**
     * Sets the control point of each flow to the middle of a straight line 
     * connecting the start and end points
     * 
     * @param onlySelected Boolean, true if only selected flows should be 
     * straightened
     */
    function straightenFlows(onlySelected) {
        var flows = model.getFlows(),
        i, j;
        for (i = 0, j = flows.length; i < j; i += 1) {			
			if(!onlySelected || (onlySelected && flows[i].isSelected())) {
				flows[i].straighten();
			}
        }
    }

	function getDistanceToLine(x, y, x0, y0, x1, y1) {
        var distToLine = (Math.abs((y0 - y1) * x + (x1 - x0) * y + (x0 * y1 - x1 * y0))
                / (Math.sqrt(((x1 - x0) * (x1 - x0)) + ((y1 - y0) * (y1 - y0)))));
        return isNaN(distToLine) ? 0 : distToLine;
    }
	
	function getDistanceFromCtrlPtToBaseline(flow) {
		// Collect needed points from the flow
        var cPt = flow.getCtrlPt(),
			sPt = flow.getStartPt(),
			ePt = flow.getEndPt();
        
		return getDistanceToLine(cPt.x, cPt.y, 
                                  sPt.x, sPt.y, 
                                  ePt.x, ePt.y);
	}

	function flowIntersectsNode(flow, node) {
		var flowStrokeWidth = model.getFlowStrokeWidth(flow),
			nodeRadius = node.r 
		                     + (model.settings.nodeTolerancePx 
		                     / model.settings.scaleMultiplier),
			threshDist =  nodeRadius + (flowStrokeWidth/2),
			// how far is the node from the flow?
			shortestDist = flow.distance({x: node.x, y: node.y});
		return (shortestDist < threshDist);
	}

	function getObstacles() {
		var nodes = model.getPoints(),
			arrows,
			nodeObstacles = [],
			arrowObstacles = [],
			returnObstacles = [],
			i, j, node, arrow, radius, 
			flows = model.getLargestFlows(), // Assumed these all have arrows
			flow;
			
		for(i = 0, j = nodes.length; i < j; i += 1) {
			node = nodes[i];
			// need the radius of node... Unless it's a necklace node.
			if(node.necklaceMapNode) { // it already has an r
				radius = node.r;
			} else {
				radius = model.getNodeRadius(node);
			}
			nodeObstacles.push({x: node.x, y: node.y, r: radius, node: node,
								type: "node"});
		}
		
		if(model.settings.drawArrows) {
			for(i = 0; i < flows.length; i += 1) {
				flow = flows[i];
				arrow = flow.getArrow();
				arrowObstacles.push({x: arrow.basePt.x, y: arrow.basePt.y, 
									r: arrow.arrowLength,
									node: flow.getEndPt(),
									type: "arrow"});
			}
		}
		
		
		if(model.settings.moveFlowsOffNodes) {
			returnObstacles = returnObstacles.concat(nodeObstacles);
		}
		
		if(model.settings.moveFlowsOffArrowheads) {
			returnObstacles = returnObstacles.concat(arrowObstacles);
		}
		
		return returnObstacles;
	}

	function flowIntersectsObstacle(flow, obstacles) {
		var i, j, obs;
		for(i = 0, j = obstacles.length; i < j; i += 1) {
			obs = obstacles[i];
			if(obs.node !== flow.getEndPt() && obs.node !== flow.getStartPt()) {
				if(flowIntersectsNode(flow, obs)) {
					return true;
				}
			}
		}
		return false;
	}

	function longestDistanceSqToCorner(box, x, y) {
		var maxDistSq = 0,
			i, corner, dx, dy, distSq;
			
		for(i = 0; i < box.length; i += 1) {
			corner = box[i];
			dx = x - corner.x;
			dy = y - corner.y;
			distSq = dx * dx + dy * dy;
			if (distSq > maxDistSq) {
                maxDistSq = distSq;
            }
		}
		return maxDistSq;
	}

	function isPointInBox(box, x, y) {
		
	}

	function moveFlowIntersectingObstaclesSPIRAL(flow, obstacles) {
		var dist = model.settings.SPIRAL_SPACING_PX * model.settings.scaleMultiplier,
			cPt = flow.getCtrlPt(),
			originalX = cPt.x,
			originalY = cPt.y,
			angleRad = Math.PI,
			rangeboxHeight = model.settings.flowRangeboxHeight,
			rangebox = flow.computeRangebox(rangeboxHeight),
			maxSpiralRSq = longestDistanceSqToCorner(rangebox, cPt.x, cPt.y),
			spiralR, dx, dy;
		do {
            // radius of spiral for the current angle.
            // The distance between two windings is dist.
            spiralR = dist * angleRad / Math.PI / 2;

            // new control point location
            dx = Math.cos(angleRad) * spiralR;
            dy = Math.sin(angleRad) * spiralR;
            cPt.x = dx + originalX;
            cPt.y = dy + originalY;

            // increment rotation angle, such that the next point on the spiral 
            // has an approximate distance of dist to the current point
            angleRad += dist / spiralR;

            if (flow.isPointInRangebox(rangeboxHeight, cPt.x, cPt.y)
                    && flowIntersectsObstacle(flow, obstacles) === false) {
                // found a new position for the control point that does not 
                // result in an overlap with any obstacle
                return;
            }

        } // move along the spiral until the entire range box is covered
        while (spiralR * spiralR < maxSpiralRSq);

        // could not find a control point position that does not overlap an 
        // obstacle. Restore the original coordinates.
        cPt.x = originalX;
        cPt.y = originalY;
        
        console.log("Spiral Method did not find a solution");
	}

	function moveFlowIntersectingObstacles(flow, obstacles) {
		
		// Collect needed points from the flow
        var cPt = flow.getCtrlPt(),
			sPt = flow.getStartPt(),
			ePt = flow.getEndPt(),
			
			// Get the distance of startPt to endPt
			dx = ePt.x - sPt.x,
			dy = ePt.y - sPt.y,
			dist = Math.sqrt(dx * dx + dy * dy),
			rightPt, rightPtD, pt0D, 
			unitVectorX, unitVectorY,
			maxDist, startingXY, flipCount,
			distFromBaseline, 
			newX, newY,
			nodeObstacles = [],
			arrowObstacles = [],
			i, obs;
        
        // Create a point known to be on the right side of the line.
        if (dy > 0) {
            rightPt = {x: sPt.x+1, y: sPt.y}; //new Point(sPt.x + 1, sPt.y);
        } else if (dy < 0) {
            rightPt = {x: sPt.x-1, y: sPt.y};  //new Point(sPt.x - 1, sPt.y);
        } else {
            // dy is 0
            if (dx > 0) {
                rightPt = {x: sPt.x, y: sPt.y-1}; //new Point(sPt.x, sPt.y - 1);
            } else {
                rightPt = {x: sPt.x, y: sPt.y+1}; //new Point(sPt.x, sPt.y + 1);
            }
        }
        // Get the d value of rightPt. The d value will be positive if it's
        // on one side of the flow's baseline, and negative if it's on the 
        // other, but we don't know if the right side is positive or
        // negative. This will allow us to find out.
        rightPtD = (rightPt.x - sPt.x) * (ePt.y - sPt.y) 
                       - (rightPt.y - sPt.y) * (ePt.x - sPt.x);
		
		// Get the d value of the flow's control point.
        pt0D = (cPt.x - sPt.x) * (ePt.y - sPt.y) 
                   - (cPt.y - sPt.y) * (ePt.x - sPt.x);
		
        // Assign the perpendicular unitVector of the flow's baseline.
        // The values assigned to these will depend on whether the control
        // point is on the right or left side of the baseline.
        // if pt0D and rightPtD have the same polarity, than the control point
        // is on the right side! Set the unitVector accordingly.
        // If either d value is 0 (the point lies directly on top of the 
        // baseline) move the control point to the left arbitrarily.  
        if ((pt0D > 0 && rightPtD > 0) || (pt0D < 0 && rightPtD < 0)) {
            unitVectorX = dy / dist;
            unitVectorY = -dx / dist;
        } else if (pt0D === 0 || rightPtD === 0) {
            unitVectorX = -dy / dist;
            unitVectorY = dx / dist;
        } else {
            unitVectorX = -dy / dist;
            unitVectorY = dx / dist;
        }
        
        // save the starting coordinates of the cPt
        startingXY = { x : cPt.x, y : cPt.y };
        
        // Move cPt incrementally away from baseline until it intersects no 
        // nodes. After the cPt is maxDist from baseline, move cPt to baseline
        // (flip it) and go the other direction. After the third flip, stop.
        flipCount = 0;
        
        for(i = 0; i < obstacles.length; i += 1) {
			obs = obstacles[i];
			if(obs.type === "node") {
				nodeObstacles.push(obs);
			}
			if(obs.type === "arrow") {
				arrowObstacles.push(obs);
			}
        }
        
        if(flow.cannotBeMovedOffNodes) {
			obstacles = arrowObstacles;
        }
        
        while(flipCount < 3 && (flowIntersectsObstacle(flow, obstacles))) {
			distFromBaseline = getDistanceFromCtrlPtToBaseline(flow);
			if(distFromBaseline > dist * model.settings.flowRangeboxHeight) { // FIXME 2 could equal rangebox height
				// move cPt to baseline, reverse polarity
				cPt.x = flow.getBaselineMidPoint().x;
	            cPt.y = flow.getBaselineMidPoint().y;
	            unitVectorX *= -1;
	            unitVectorY *= -1;
	            flipCount += 1;
	            //continue;
			} else {
				// Add the unitVectors to the control point. Also, multiply the
		        // unitVectors by 2. This will cut the iterations in half without
		        // losing significant fidelity. 
		        newX = cPt.x + ((unitVectorX / model.settings.scaleMultiplier) * 2);
		        newY = cPt.y + ((unitVectorY / model.settings.scaleMultiplier) * 2);
		        cPt.x = newX;
		        cPt.y = newY;
	       }
        }
        
        // Try again, but with nust the nodes?
        // FIXME repeated code
        if(!flow.cannotBeMovedOffNodes) {
			while(flipCount < 5 && (flowIntersectsObstacle(flow, nodeObstacles))) {
				distFromBaseline = getDistanceFromCtrlPtToBaseline(flow);
				if(distFromBaseline > dist * model.settings.flowRangeboxHeight) {
					// move cPt to baseline, reverse polarity
					cPt.x = flow.getBaselineMidPoint().x;
		            cPt.y = flow.getBaselineMidPoint().y;
		            unitVectorX *= -1;
		            unitVectorY *= -1;
		            flipCount += 1;
		            //continue;
				} else {
					// Add the unitVectors to the control point. Also, multiply the
			        // unitVectors by 2. This will cut the iterations in half without
			        // losing significant fidelity. 
			        newX = cPt.x + ((unitVectorX / model.settings.scaleMultiplier) * 2);
			        newY = cPt.y + ((unitVectorY / model.settings.scaleMultiplier) * 2);
			        cPt.x = newX;
			        cPt.y = newY;
		       }
		    }
       } else {
       		flipCount = 5;
       }

        // If the flipcount is 3 or more, then no solution was found.
        // Move the cPt back to its original position. 
        if (flipCount >= 5) {
			console.log("Found a flow that was impossible to move off all obstacles.");
			cPt.x = startingXY.x;
	        cPt.y = startingXY.y;
	        flow.cannotBeMovedOffNodes = true;
        } else {
			flow.setLocked(true);
        }
	}

	function getFlowsOverlappingObstacles(obstacles) {
		var flows = model.getFlows(),
			intersectingFlows = [],
			i, j, flow, node, obstacle;
			
		for(i = 0; i < flows.length; i += 1) {
			flow = flows[i];
			for(j = 0; j < obstacles.length; j += 1) {
				obstacle = obstacles[j];
				node = obstacle.node;
				if(node !== flow.getStartPt() && node !== flow.getEndPt()) {
					if(flowIntersectsNode(flow, obstacle)) {
						intersectingFlows.push(flow);
					}
				}
			}
			// if (flowIntersectsANode(flow)) {
				// intersectingFlows.push(flows[i]);
			// }
		}
		return intersectingFlows;
	}

	function moveFlowsIntersectingNodes(){
		// Get flows that overlap a node. 
		var obstacles, flowsOverlappingObstacles, i, j;
		
		obstacles = getObstacles();
		
		flowsOverlappingObstacles = getFlowsOverlappingObstacles(obstacles);
		
		for(i = 0, j = flowsOverlappingObstacles.length; i < j; i += 1) {
			
			if(model.settings.useSpiralMethod) {
				// use the spiral methoid!
				moveFlowIntersectingObstaclesSPIRAL(flowsOverlappingObstacles[i], obstacles);
			} else {
				moveFlowIntersectingObstacles(flowsOverlappingObstacles[i], obstacles);
			}
		}		
	}

// PUBLIC ======================================================================

    my.createForce = function(fx, fy) {
        return new Force(fx, fy);
    };

    my.makeForce = function(fx,fy) {
        return new Force(fx, fy);
    };

    my.layoutAllFlows = function(weight) {
        layoutAllFlows(weight);
    };

    my.straightenFlows = function(boo) {
        straightenFlows(boo);
    };
    
    my.moveFlowsIntersectingNodes = function() {
		moveFlowsIntersectingNodes();
    };

	my.getObstacles = function() {
		return getObstacles();
	};

	return my;

};