Flox.GeomUtils = (function() {

	"use strict";

	var my = {}; // public object;




// Smallest enclosing circle algorithms ----------------------------------------

/* 
 * Smallest enclosing circle
 * 
 * Copyright (c) 2016 Project Nayuki
 * https://www.nayuki.io/page/smallest-enclosing-circle
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program (see COPYING.txt).
 * If not, see <http://www.gnu.org/licenses/>.
 */

/* 
 * Returns the smallest circle that encloses all the given points. Runs in expected O(n) time, randomized.
 * Input: A list of points, where each point is an object {x: float, y: float}, e.g. [{x:0,y:5}, {x:3.1,y:-2.7}].
 * Output: A circle object of the form {x: float, y: float, r: float}.
 * Note: If 0 points are given, null is returned. If 1 point is given, a circle of radius 0 is returned.
 */


/* Simple mathematical functions */

var EPSILON = 1e-12;

function distance(x0, y0, x1, y1) {
	return Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
}

function isInCircle(c, p) {
	return c !== null && distance(p.x, p.y, c.x, c.y) < c.r + EPSILON;
}

function makeDiameter(p0, p1) {
	return {
		x: (p0.x + p1.x) / 2,
		y: (p0.y + p1.y) / 2,
		r: distance(p0.x, p0.y, p1.x, p1.y) / 2
	};
}

// Returns twice the signed area of the triangle defined by (x0, y0), (x1, y1), (x2, y2)
function crossProduct(x0, y0, x1, y1, x2, y2) {
	return (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
}

// Two boundary points known
function makeCircleTwoPoints(points, p, q) {
	var temp = makeDiameter(p, q),
		containsAll = true,
		i;
	for (i = 0; i < points.length; i++)
		containsAll = containsAll && isInCircle(temp, points[i]);
	if (containsAll)
		return temp;
	
	var left = null;
	var right = null;
	for (i = 0; i < points.length; i++) {
		var r = points[i];
		var cross = crossProduct(p.x, p.y, q.x, q.y, r.x, r.y);
		var c = makeCircumcircle(p, q, r);
		if (c == null)
			continue;
		else if (cross > 0 && (left == null || crossProduct(p.x, p.y, q.x, q.y, c.x, c.y) > crossProduct(p.x, p.y, q.x, q.y, left.x, left.y)))
			left = c;
		else if (cross < 0 && (right == null || crossProduct(p.x, p.y, q.x, q.y, c.x, c.y) < crossProduct(p.x, p.y, q.x, q.y, right.x, right.y)))
			right = c;
	}
	return right === null || left !== null && left.r <= right.r ? left : right;
}

// One boundary point known
function makeCircleOnePoint(points, p) {
	var c = {x: p.x, y: p.y, r: 0},
		i, q;
	for (i = 0; i < points.length; i += 1) {
		q = points[i];
		if (!isInCircle(c, q)) {
			if (c.r === 0) {
				c = makeDiameter(p, q);
			} else {
				c = makeCircleTwoPoints(points.slice(0, i + 1), p, q);
			}
		}
	}
	return c;
}



function makeCircumcircle(p0, p1, p2) {
	// Mathematical algorithm from Wikipedia: Circumscribed circle
	var ax = p0.x, ay = p0.y;
	var bx = p1.x, by = p1.y;
	var cx = p2.x, cy = p2.y;
	var d = (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) * 2;
	if (d == 0)
		return null;
	var x = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
	var y = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
	return {x: x, y: y, r: distance(x, y, ax, ay)};
}

function makeCircle(points) {
	// Clone list to preserve the caller's data, do Durstenfeld shuffle
	var shuffled = points.slice(),
		i, j, temp,
		c = null,
		p;
	for (i = points.length - 1; i >= 0; i -= 1) {
		j = Math.floor(Math.random() * (i + 1));
		j = Math.max(Math.min(j, i), 0);
		temp = shuffled[i];
		shuffled[i] = shuffled[j];
		shuffled[j] = temp;
	}
	
	// Progressively add points to circle or recompute circle
	for (i = 0; i < shuffled.length; i += 1) {
		p = shuffled[i];
		if (c === null || !isInCircle(c, p)) {
			c = makeCircleOnePoint(shuffled.slice(0, i + 1), p);
		}
	}
	return c;
}

// End smallest enclosing circle algorithms ------------------------------------




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
	
	my.makeCircle = function(points) {
		return makeCircle(points);
	};

	return my;

}());