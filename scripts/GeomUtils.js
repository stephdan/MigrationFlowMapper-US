Flox.GeomUtils = (function() {

	"use strict";

	var my = {}; // public object;

	function rotatePoint(pt, origin, angle){
		var tempX = pt.x - origin.x,
            tempY = pt.y - origin.y,
            cos = Math.cos(angle),
            sin = Math.sin(angle),
            newX = tempX * cos - tempY * sin,
            newY = tempX * sin + tempY * cos;
            
        return {x: newX + origin.x, y: newY + origin.y};
	}


	// p1: Point object
	// p2: Point object
	// TODO It would be better maybe if GeomUtils was passed coordinates, not
	// Point objects. This would require changing several functions. Might be
    // more trouble than it's worth though. 
	function squaredDistanceBetweenPoints(p1, p2) {
		var dx = p1.x - p2.x,
		dy = p1.y - p2.y;
        return dx * dx + dy * dy;
	}

	// Returns an array containing the coordinates [x,y] of the mid point 
	// between the provided points.
	// p1: Point object
	// p2: Point object
	function midXYBetweenTwoPoints(p1, p2) {
		return [ (p1.x + p2.x) / 2 , (p1.y + p2.y) / 2 ];
	}

	function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {

		// Return false if either of the lines have zero length
		if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
            return false;
        }

        // Fastest method, based on Franklin Antonio's "Faster Line Segment Intersection" topic "in Graphics Gems III" book (http://www.graphicsgems.org/)
        var ax = x2 - x1,
			ay = y2 - y1,
			bx = x3 - x4,
			by = y3 - y4,
			cx = x1 - x3,
			cy = y1 - y3,
			alphaNumerator = by * cx - bx * cy,
			commonDenominator = ay * bx - ax * by,
			betaNumerator = ax * cy - ay * cx,
			y3LessY1 = y3 - y1,
			collinearityTestForP3;

        if (commonDenominator > 0) {
            if (alphaNumerator < 0 || alphaNumerator > commonDenominator) {
                return false;
            }
        } else if (commonDenominator < 0) {
            if (alphaNumerator > 0 || alphaNumerator < commonDenominator) {
                return false;
            }
        }
        if (commonDenominator > 0) {
            if (betaNumerator < 0 || betaNumerator > commonDenominator) {
                return false;
            }
        } else if (commonDenominator < 0) {
            if (betaNumerator > 0 || betaNumerator < commonDenominator) {
                return false;
            }
        }
        if (commonDenominator === 0) {
            // This code wasn't in Franklin Antonio's method. It was added by Keith Woodward.
            // The lines are parallel.
            // Check if they're collinear.

            collinearityTestForP3 = x1 * (y2 - y3) + x2 * (y3LessY1) + x3 * (y1 - y2);   // see http://mathworld.wolfram.com/Collinear.html
            // If p3 is collinear with p1 and p2 then p4 will also be collinear, since p1-p2 is parallel with p3-p4
            if (collinearityTestForP3 === 0) {
                // The lines are collinear. Now check if they overlap.
                if ((x1 >= x3 && x1 <= x4) || (x1 <= x3 && x1 >= x4)
                        || (x2 >= x3 && x2 <= x4) || (x2 <= x3 && x2 >= x4)
                        || (x3 >= x1 && x3 <= x2) || (x3 <= x1 && x3 >= x2)) {
                    if ((y1 >= y3 && y1 <= y4) || (y1 <= y3 && y1 >= y4)
                            || (y2 >= y3 && y2 <= y4) || (y2 <= y3 && y2 >= y4)
                            || (y3 >= y1 && y3 <= y2) || (y3 <= y1 && y3 >= y2)) {
                        return true;
                    }
                }
            }
            return false;
        }
        return true;
	}

	function det(a,b,c,d) {
		return a * d - b * c;
	}

	function getLineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
		var det1And2 = det(x1, y1, x2, y2),
			det3And4 =det(x3, y3, x4, y4),
			x1LessX2 = x1 - x2,
			y1LessY2 = y1 - y2,
			x3LessX4 = x3 - x4,
			y3LessY4 = y3 - y4,
			det1Less2And3Less4 = det(x1LessX2, y1LessY2, x3LessX4, y3LessY4),
			x, y;
			
        if (det1Less2And3Less4 === 0) {
            // the denominator is zero so the lines are parallel and there's either no solution (or multiple solutions if the lines overlap) so return null.
            return null;
        }
        x1 = (det(det1And2, x1LessX2,
                det3And4, x3LessX4) / det1Less2And3Less4);
        y1 = (det(det1And2, y1LessY2,
                det3And4, y3LessY4) / det1Less2And3Less4);
        
        
        return {x: x1, y: y1};
	}
	
	function collinear(x1, y1, x2, y2, x3, y3) {
        return Math.abs((y1 - y2) * (x1 - x3) - (y1 - y3) * (x1 - x2)) <= 1e-9;
    }
    
	function getDistanceToLineSegmentSquare(x, y, x1, y1, x2, y2) {
        var A = x - x1,
			B = y - y1,
			C = x2 - x1,
			D = y2 - y1,
			
			dot = A * C + B * D,
			len_sq = C * C + D * D,
			param = -1,
			xx, yy, dx, dy;
			
        if (len_sq !== 0) {
            param = dot / len_sq;
        }

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        dx = x - xx;
        dy = y - yy;
        return dx * dx + dy * dy;
    }
	
	function cuberoot(x) {
        if (x < 0.0) {
            return -Math.pow(-x, 1.0 / 3.0);
        }
        return Math.pow(x, 1.0 / 3.0);
    }
	
	function solveCubic(a, b, c, r) {
        var p = b - a * a / 3.0,
			q = a * (2.0 * a * a - 9.0 * b) / 27.0 + c,
			p3 = p * p * p,
			d = q * q + 4.0 * p3 / 27.0,
			offset = -a / 3.0,
			z, u, v, m, n;
		
        if (d >= 0) { // Single solution
            z = Math.sqrt(d);
            u = (-q + z) / 2.0;
            v = (-q - z) / 2.0;
            u = cuberoot(u);
            v = cuberoot(v);
            r[0] = offset + u + v;
            return 1;
        }
        u = Math.sqrt(-p / 3);
        v = Math.acos(-Math.sqrt(-27.0 / p3) * q / 2.0) / 3.0;
        m = Math.cos(v); 
        n = Math.sin(v) * 1.732050808;
        r[0] = offset + u * (m + m);
        r[1] = offset - u * (n + m);
        r[2] = offset + u * (n - m);
        return 3;
    }
	
	function getDistanceToQuadraticBezierCurveSq(p0x, p0y, p1x, p1y, p2x, p2y, xy) {
		
		if (collinear(p0x, p0y, p1x, p1y, p2x, p2y)) {
            return getDistanceToLineSegmentSquare(xy[0], xy[1], p0x, p0y, p2x, p2y);
        }

        var dx1 = p0x - xy[0],
			dy1 = p0y - xy[1],
			d0sq = dx1 * dx1 + dy1 * dy1,
			dx2 = p2x - xy[0],
			dy2 = p2y - xy[1],
			d2sq = dx2 * dx2 + dy2 * dy2,
			minDistSq = Math.min(d0sq, d2sq),
			
			ax = p0x - 2.0 * p1x + p2x,
			ay = p0y - 2.0 * p1y + p2y,
			bx = 2.0 * (p1x - p0x),
			by = 2.0 * (p1y - p0y),
			cx = p0x,
			cy = p0y,
			
			k3 = 2.0 * (ax * ax + ay * ay),
			k2 = 3.0 * (ax * bx + ay * by),
			k1 = bx * bx + by * by + 2.0 * ((cx - xy[0]) * ax + (cy - xy[1]) * ay),
			k0 = (cx - xy[0]) * bx + (cy - xy[1]) * by,
			
			// FIXME allocating this array each time might not be efficient
			res = [],
			n = solveCubic(k2 / k3, k1 / k3, k0 / k3, res),
			i, t,
			
			k1_t, w0, w1, w2, posx, posy, dx, dy, distSq;
        for (i = 0; i < n; i += 1) {
            t = res[i];
            if (t >= 0.0 && t <= 1.0) {
                k1_t = 1.0 - t;
                w0 = k1_t * k1_t;
                w1 = 2.0 * t * k1_t;
                w2 = t * t;
                // point on Bézier curve
                posx = w0 * p0x + w1 * p1x + w2 * p2x;
                posy = w0 * p0y + w1 * p1y + w2 * p2y;

                dx = posx - xy[0];
                dy = posy - xy[1];
                distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = dx * dx + dy * dy;
                    xy[0] = posx;
                    xy[1] = posy;
                }
            }
        }

        return minDistSq;
	}

	function getDistanceToQuadraticBezierCurve(p0x, p0y, p1x, p1y, p2x, p2y, xy) {
		var dSq = getDistanceToQuadraticBezierCurveSq(p0x, p0y, p1x, p1y, p2x, p2y, xy);
        return Math.sqrt(dSq);
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
		
// PUBLIC ======================================================================
	
	my.squaredDistanceBetweenPoints = function(p1, p2){
		return squaredDistanceBetweenPoints(p1, p2);
	};
	
	my.midPointBetweenTwoPoints = function(p1, p2) {
		return midXYBetweenTwoPoints(p1, p2);
	};
	
	my.linesIntersect = function(x1, y1, x2, y2, x3, y3, x4, y4) {
		return linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4);
	};
	
	my.getLineLineIntersection = function(x1, y1, x2, y2, x3, y3, x4, y4) {
		return getLineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4);
	};

	my.getDistanceToQuadraticBezierCurve = function(p0x, p0y, p1x, p1y, p2x, p2y, xy) {
		return getDistanceToQuadraticBezierCurve(p0x, p0y, p1x, p1y, p2x, p2y, xy);
	};
	
	my.rotatePoint = function (pt, origin, angle) {
		return rotatePoint(pt, origin, angle);
	};

	return my;

}());