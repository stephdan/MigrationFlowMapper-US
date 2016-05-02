Flox.RangeboxEnforcer = (function() {
	"use strict";
	
	// Public object
	var my = {};
    
    function computeRangebox(flow) {

        var baseDist, baseAzimuth, startPt,
			bPt, boxHeight, b1, b2, b3, b4;
			
        baseDist = flow.getBaselineLength();
		baseAzimuth = flow.getBaselineAzimuth();
		startPt = flow.getStartPt();
		
		bPt = {x: startPt.x + baseDist, y: startPt.y};
		
		boxHeight = Flox.getFlowRangeboxHeight();
		b1 = Flox.rotatePoint({x: startPt.x, y: startPt.y + (baseDist * boxHeight)}, startPt, baseAzimuth);
		b2 = Flox.rotatePoint({x: bPt.x,     y: bPt.y     + (baseDist * boxHeight)}, startPt, baseAzimuth);
		b3 = Flox.rotatePoint({x: startPt.x, y: startPt.y - (baseDist * boxHeight)}, startPt, baseAzimuth);
		b4 = Flox.rotatePoint({x: bPt.x,     y: bPt.y     - (baseDist * boxHeight)}, startPt, baseAzimuth);

        return [b1, b2, b3, b4];
    }
    
    // return a Point
    function enforceRangebox(flow) {

        var cPt = flow.getCtrlPt(),
			refPt = flow.getBaselineMidPoint(),
			box = computeRangebox(flow);

        if (Flox.linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[0].x, box[0].y,
                box[1].x, box[1].y )) {
            return Flox.getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[0].x, box[0].y,
                    box[1].x, box[1].y);
        }

        if (Flox.linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[2].x, box[2].y,
                box[3].x, box[3].y )) {
            return Flox.getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[2].x, box[2].y,
                    box[3].x, box[3].y);
        }

        if (Flox.linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[0].x, box[0].y,
                box[2].x, box[2].y )) {

            return Flox.getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[0].x, box[0].y,
                    box[2].x, box[2].y);
        }

        if (Flox.linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[1].x, box[1].y,
                box[3].x, box[3].y )) {

            return Flox.getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[1].x, box[1].y,
                    box[3].x, box[3].y);
        }

        // If no intersection was found, return the original cPt.
        return cPt;
    }
    
// PUBLIC =====================================================================

    my.enforceRangebox = function(flow) {
        return enforceRangebox(flow);
    };

    my.computeRangebox = function(flow) {
        return computeRangebox(flow);
    };

	return my;

})();