Flox.Flow = function(sPt, ePt, val, newID) {
	
	"use strict";
	
    var id,
		startPt = sPt, // The starting point of the flow
        endPt = ePt, // The ending point of the flow
        ctrlPt, // The control point of the Bezier curve of the flow
		value = val, // The flow's value determines the width 
	    locked = false,
	    selected = false,
	    lineSegments,
	    estimatedCurveLength,
	    arrow, // a series of points comprising the arrow geometry
	    boundingBox, // bounding box around startPt, endPt, and ctrlPt
	    my = {}; // public object

	if(newID) {
		id = newID;
	}

	// Find basePt, the midpoint along a line connecting startPt and endPt
    function computeBasePt() {
        var bx = (startPt.x + endPt.x ) / 2,
            by = (startPt.y + endPt.y ) / 2;
        return {x: bx, y: by};
    }
    
    // Initialize ctrlPt at the basepoint
    ctrlPt = computeBasePt();

    function getBaselineLength() {
        var dx = startPt.x - endPt.x,
            dy = startPt.y - endPt.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

	// Initialize the estimated curve length to the length of the baseline. 
	estimatedCurveLength = getBaselineLength();

    function getBaselineAzimuth() {
        var dx = endPt.x - startPt.x,
            dy = endPt.y - startPt.y;
        return Math.atan2(dy, dx);
    }

	/**
     * Returns the length of a simple line string defined by a series of points.
     *
     * @param lineString
     * @return The length.
     */
    function lineStringLength(lineString) {
		var l = 0,
			n = lineString.length,
            x0 = lineString[0],
            y0 = lineString[1],
            i, j, x1, y1, dx, dy;

        for (i = 2; i < n; i += 2) {
            x1 = lineString[i];
            y1 = lineString[i+1];
            dx = x0 - x1;
            dy = y0 - y1;
            l += Math.sqrt(dx * dx + dy * dy);
            x0 = x1;
            y0 = y1;
        }
        return l;
	}
	
	/**
     * Returns the location on the Bézier curve at parameter value t.
     *
     * @param t Parameter [0..1]
     * @return Location on curve.
     */
    function pointOnCurve(t) {
		if(t > 1 || t < 0) {
			throw new Error("pointOnCurve, argument t is not from 0 to 1");
		}
        var t2 = t * t,
            mt = 1 - t,
            mt2 = mt * mt,
            tx = startPt.x * mt2 + ctrlPt.x * 2 * mt * t + endPt.x * t2,
            ty = startPt.y * mt2 + ctrlPt.y * 2 * mt * t + endPt.y * t2;
        return {x: tx, y: ty};
    }

	// Gap is was was referred to as deCasteljauTolorance in jave Flox. 
	function toIrregularStraightLineSegments(gap) {

		var numberOfSegments = Math.floor(estimatedCurveLength/gap),
		    outPts = [],
		    i, j, ptLatLng, t, t2, mt, mt2, tx, ty;
		
		if (numberOfSegments <= 1) {
			// Just get the start and end points
			for (i = 0; i <= 1; i += 1){
				t = i;
				// point t on curve
				t2 = t * t;
	            mt = 1 - t;
	            mt2 = mt * mt;
				outPts.push(startPt.x * mt2 + ctrlPt.x * 2 * mt * t + endPt.x * t2);
				outPts.push(startPt.y * mt2 + ctrlPt.y * 2 * mt * t + endPt.y * t2);
				//return {x: tx, y: ty};
				
			}
		} else {
			for (i = 0; i <= numberOfSegments; i += 1) {
				t = i / numberOfSegments;
				// point t on curve
				t2 = t * t;
	            mt = 1 - t;
	            mt2 = mt * mt;
	            outPts.push(startPt.x * mt2 + ctrlPt.x * 2 * mt * t + endPt.x * t2);
				outPts.push(startPt.y * mt2 + ctrlPt.y * 2 * mt * t + endPt.y * t2);
			}
		}	
		estimatedCurveLength = lineStringLength(outPts);
		return outPts;
	}

	function toRegularStraightLineSegments(gap) {
		
		
		var regularPoints = [],
		    irregularPoints = toIrregularStraightLineSegments(gap),
		
			// compute distance between points in regular line string
			totalLength = lineStringLength(irregularPoints),
			// FIXME abusing the deCasteljauTol, which is not really the tolerance
			// for de Casteljau's algorithm (it is devided by 100).
			targetDist = totalLength / Math.round(totalLength / gap),
		
		
			startX = irregularPoints[0], // px coords!
			startY = irregularPoints[1], // px coords!
			length = 0, // for loop stuff
			nPoints = irregularPoints.length,
			i, inputPtX, inputPtY, endX, endY, dx, dy, l, rest,
			lastPtX, lastPtY; 
		
		// Add the first point to regularPoints
		regularPoints.push({x: startX, y: startY});
		
		for (i = 2; i < nPoints; i += 2) {
            inputPtX = irregularPoints[i];
            inputPtY = irregularPoints[i + 1];
            endX = inputPtX;
            endY = inputPtY;

            // normalized direction dx and dy
            dx = endX - startX;
            dy = endY - startY;
            l = Math.sqrt(dx * dx + dy * dy);
            dx /= l;
            dy /= l;
            rest = length;
            length += l;
            while (length >= targetDist) {
                // compute new point
                length -= targetDist;
                startX += dx * (targetDist - rest);
                startY += dy * (targetDist - rest);
                rest = 0;
                regularPoints.push({x: startX, y: startY});
            }
            startX = endX;
            startY = endY;
        }
        // add end point
        lastPtX = irregularPoints[irregularPoints.length - 2];
        lastPtY = irregularPoints[irregularPoints.length - 1];
        regularPoints.push({x: lastPtX, y: lastPtY});
        return regularPoints;
	}
	
	function cuberoot(x) {
        if (x < 0.0) {
            return -Math.pow(-x, 1.0 / 3.0);
        }
        return Math.pow(x, 1.0 / 3.0);
    }
	
	/**
     * Find roots in cubic equation of the form x^3 + a·x^2 + b·x + c = 0 From
     * http://www.pouet.net/topic.php?which=9119&page=1
     *
     * @param a
     * @param b
     * @param c
     * @param r Array that will receive solutions.
     * @return The number of solutions.
     */
    function solveCubic(a, b, c, r) {
        var p = b - a * a / 3.0,
			q = a * (2.0 * a * a - 9.0 * b) / 27.0 + c,
			p3 = p * p * p,
			d = q * q + 4.0 * p3 / 27.0,
			offset = -a / 3.0,
			z, y, v, m, u, n;
			
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
	
	/**
     * Calculates the square value of the shortest distance from a point to a
     * finite line. Copied from a stackoverflow forum post.
     * http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
     * segment.
     *
     * @param x X coordinate of point.
     * @param y Y coordinate of point.
     * @param x1 X coordinate of start point of line segment.
     * @param y1 Y coordinate of start point of line segment.
     * @param x2 X coordinate of end point of line segment.
     * @param y2 Y coordinate of end point of line segment.
     * @return Distance between point and line segment.
     */
    function getDistanceToLineSegmentSquare(x, y,
            x1, y1, x2, y2) {
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
	
	/**
     * Test whether three points align.
     *
     * @param x1
     * @param y1
     * @param x2
     * @param y2
     * @param x3
     * @param y3
     * @return
     */
    function collinear(x1, y1, x2, y2, x3, y3) {
        return Math.abs((y1 - y2) * (x1 - x3) - (y1 - y3) * (x1 - x2)) <= 0.000000001;
    }
	
	/**
     * Computes the square of the shortest distance between a point and any
     * point on a quadratic Bézier curve. Attention: xy parameter is changed.
     * Based on
     * http://blog.gludion.com/2009/08/distance-to-quadratic-bezier-curve.html
     * and http://www.pouet.net/topic.php?which=9119&page=2
     *
     * @param p0x Start point x
     * @param p0y Start point y
     * @param p1x Control point x
     * @param p1y Control point y
     * @param p2x End point x
     * @param p2y End point x
     * @param xy Point x and y on input; the closest point on the curve on
     * output.
     * @return The square distance between the point x/y and the quadratic
     * Bezier curve.
     */
    function getDistanceToQuadraticBezierCurveSq(p0x, p0y,
            p1x, p1y,
            p2x, p2y,
            xy, returnT) {

        if (collinear(p0x, p0y, p1x, p1y, p2x, p2y)) {
            return getDistanceToLineSegmentSquare(xy.x, xy.y, p0x, p0y, p2x, p2y);
        }

        var dx1 = p0x - xy.x,
			dy1 = p0y - xy.y,
			d0sq = dx1 * dx1 + dy1 * dy1,
			dx2 = p2x - xy.x,
			dy2 = p2y - xy.y,
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
			k1 = bx * bx + by * by + 2.0 * ((cx - xy.x) * ax + (cy - xy.y) * ay),
			k0 = (cx - xy.x) * bx + (cy - xy.y) * by,
			res = [],
			n = solveCubic(k2 / k3, k1 / k3, k0 / k3, res),
			i,t, k1_t, w0, w1, w2, posx, posy, dx, dy, distSq;
        for (i = 0; i < n; i += 1) {
            t = res[i]; // t parameter of nearest point on flow to xy. WANT.
            if(returnT) {
				return t;
            }
            if (t >= 0.0 && t <= 1.0) {
                k1_t = 1.0 - t;
                w0 = k1_t * k1_t;
                w1 = 2.0 * t * k1_t;
                w2 = t * t;
                // point on Bézier curve
                posx = w0 * p0x + w1 * p1x + w2 * p2x;
                posy = w0 * p0y + w1 * p1y + w2 * p2y;

                dx = posx - xy.x;
                dy = posy - xy.y;
                distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = dx * dx + dy * dy;
                    xy.x = posx;
                    xy.y = posy;
                }
            }
        }
        return minDistSq;
    }
	
	/**
     * Computes the shortest distance between a point and any point on a
     * quadratic Bézier curve. Attention: xy parameter is changed.
     *
     * @param p0x Start point x
     * @param p0y Start point y
     * @param p1x Control point x
     * @param p1y Control point y
     * @param p2x End point x
     * @param p2y End point x
     * @param xy Point x and y on input; the closest point on the curve on
     * output.
     * @return Distance between the point x/y and the quadratic Bezier curve.
     */
    function getDistanceToQuadraticBezierCurve(p0x, p0y,
            p1x, p1y,
            p2x, p2y,
            xy) {
        var dSq = getDistanceToQuadraticBezierCurveSq(p0x, p0y, p1x, p1y, p2x, p2y, xy);
        return Math.sqrt(dSq);
    }

	// Get distance from point xy to this Bezier curve.
	// xy is an object {x:xCoord, y:coord}
	function distance(xy) {
		//var curve = toBezier(),
		    //pointOnCurve = curve.project(xy);
		    
		// pointOnCurve is an object created by bezier.js
		// {x: x coord, y: y coord, d: distance from xy, t: t-parameter of point} 
        //return pointOnCurve;
        return getDistanceToQuadraticBezierCurve(startPt.x, startPt.y,
                ctrlPt.x, ctrlPt.y, endPt.x, endPt.y, xy);
	}

	/**
     * Returns the curve parameter where a circle with radius r around the 
     * start point intersects the Bézier curve.
     *
* @param r Radius of circle
* @return Parameter t [0..1] where the circle intersects the flow.
     */
    function getIntersectionTWithCircleAroundStartPoint(r) {
        if (r <= 0) {
            return 0;   // tx = 0: start of curve
        }
        var t = 0.5,
            t_step = 0.25,
            i, pt, dx, dy, d; // for loop stuff
            
        for (i = 0; i < 20; i += 1) {
            pt = pointOnCurve(t);
            dx = startPt.x - pt.x;
            dy = startPt.y - pt.y;
            d = Math.sqrt(dx * dx + dy * dy);
            if (d < r) {
                t += t_step;
            } else {
                t -= t_step;
            }
            t_step /= 2;
        }
        return t;
    }

	/**
	 * Returns the curve parameter where a circle with radius r around the end
     * point intersects the Bézier curve.
     * 
 * @param {Object} r Radius of circle
 * @return Parameter t [0..1] where the circle intersects the flow.
	 */
	function getIntersectionTWithCircleAroundEndPoint(r) {
		if (r <= 0) {
            return 1;   // tx = 1: end of curve
        }
        var t = 0.5,
            t_step = 0.25,
            i, pt, dx, dy, d; // for loop stuff
            
        for (i = 0; i < 20; i += 1) {
            pt = pointOnCurve(t);
            dx = endPt.x - pt.x;
            dy = endPt.y - pt.y;
            d = Math.sqrt(dx * dx + dy * dy);
            if (d < r) {
                t -= t_step;
            } else {
                t += t_step;
            }
            t_step /= 2;
        }
        return t;
	}
	
	function makeCopy() {
		var copy = new Flox.Flow(startPt, endPt, value);
		copy.setCtrlPt(ctrlPt);
		return copy;
	}
	
	/**
     * Split a flow into two new flows. The new flows have the same value,
     * selection and lock state as this flow. The split flows have new start,
     * end, and control points. The first flow has the same start clip area as
     * this flow. The second flow has the same end clip area as this flow.
     * 
     * Maths based on http://pomax.github.io/bezierinfo/#matrixsplit
     *
     * @param t Parametric position [0..1]
     * @return Two new flows if tx is > 0 and tx < 1. Otherwise two references
     * to this.
     */
    function split(t) {

		var startX1, startY1, ctrlX1, ctrlY1, endX1, endY1, start1, ctrl1, end1,
		startX2, startY2, ctrlX2, ctrlY2, endX2, endY2, start2, ctrl2, end2, 
		flow1, flow2, f;


		// FIXME Creating a copy is expensive. How can this flow return
		// itself? 'this' does not work, and has a notoriously fickle assignment
		// in javascript.
		if (t <= 0 || t >= 1) {
			f = makeCopy();
            return [f, f];
        }

		startX1 = startPt.x;
		startY1 = startPt.y;
		ctrlX1 = t * ctrlPt.x - (t - 1) * startPt.x;
		ctrlY1 = t * ctrlPt.y - (t - 1) * startPt.y;
		endX1 = t * t * endPt.x- 2 * t * (t - 1) * ctrlPt.x + (t - 1) * (t - 1) * startPt.x;
		endY1 = t * t * endPt.y - 2 * t * (t - 1) * ctrlPt.y + (t - 1) * (t - 1) * startPt.y;
		
		start1 = {x: startX1 , y: startY1};
		ctrl1 = {x: ctrlX1 , y: ctrlY1};
		end1 = {x: endX1 , y: endY1};
		
		startX2 = t * t * endPt.x - 2 * t * (t - 1) * ctrlPt.x + (t - 1) * (t - 1) * startPt.x;
		startY2 = t * t * endPt.y - 2 * t * (t - 1) * ctrlPt.y + (t - 1) * (t - 1) * startPt.y;
		ctrlX2 = t * endPt.x - (t - 1) * ctrlPt.x;
		ctrlY2 = t * endPt.y - (t - 1) * ctrlPt.y;
		endX2 = endPt.x;
		endY2 = endPt.y;
		
		start2 = {x: startX2, y: startY2};
		ctrl2 = {x: ctrlX2, y: ctrlY2};
		end2 = {x: endX2, y: endY2};
		
		flow1 = new Flox.Flow(start1, end1, value);
		flow1.setCtrlPt(ctrl1);
		
		flow2 = new Flox.Flow(start2, end2, value);
		flow2.setCtrlPt(ctrl2);
			
		
			
        flow1.setSelected(selected);
        flow1.setLocked(locked);
        //flow1.setStartClipArea(getStartClipArea());

        flow2.setSelected(selected);
        flow2.setLocked(locked);
        //flow2.setEndClipArea(getEndClipArea());

        return [flow1, flow2];
    }

	function rotatePoint(pt, origin, angle){
		var tempX = pt.x - origin.x,
            tempY = pt.y - origin.y,
            cos = Math.cos(angle),
            sin = Math.sin(angle),
            newX = tempX * cos - tempY * sin,
            newY = tempX * sin + tempY * cos;
            
        return {x: newX + origin.x, y: newY + origin.y};
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
			det3And4 = det(x3, y3, x4, y4),
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

	function computeRangebox(boxHeight) {

        var baseDist, baseAzimuth,
			bPt, b1, b2, b3, b4;
			
        baseDist = getBaselineLength();
		baseAzimuth = getBaselineAzimuth();
		
		bPt = {x: startPt.x + baseDist, y: startPt.y};
		
		b1 = rotatePoint({x: startPt.x, y: startPt.y + (baseDist * boxHeight)}, startPt, baseAzimuth);
		b2 = rotatePoint({x: bPt.x,     y: bPt.y     + (baseDist * boxHeight)}, startPt, baseAzimuth);
		b3 = rotatePoint({x: startPt.x, y: startPt.y - (baseDist * boxHeight)}, startPt, baseAzimuth);
		b4 = rotatePoint({x: bPt.x,     y: bPt.y     - (baseDist * boxHeight)}, startPt, baseAzimuth);

        return [b1, b2, b3, b4];
    }
    
    function isPointInRangebox(boxHeight, x, y) {
		var baseDist = getBaselineLength(),
			x1 = startPt.x,
			y1 = startPt.y,
			x2 = endPt.x,
			y2 = endPt.y,
			dx = x2 - x1,
			dy = y2 - y1,
			l = Math.sqrt(dx * dx + dy * dy),
			
			// unary vector along base line
			ux = dx / l,
			uy = dy / l,
	        // vector from start and end points of base line to corners
	        vx = -uy * baseDist * boxHeight,
	        vy = ux * baseDist * boxHeight,
	
	        // http://stackoverflow.com/questions/2752725/finding-whether-a-point-lies-inside-a-rectangle-or-not
	        Ax = x1 - vx,
	        Ay = y1 - vy,
	        Bx = x2 - vx,
	        By = y2 - vy,
	        Dx = x1 + vx,
	        Dy = y1 + vy,
	        bax = Bx - Ax,
	        bay = By - Ay,
	        dax = Dx - Ax,
	        day = Dy - Ay;
	        
	    if ((x - Ax) * bax + (y - Ay) * bay < 0.0) {
            return false;
        }
        if ((x - Bx) * bax + (y - By) * bay > 0.0) {
            return false;
        }
        if ((x - Ax) * dax + (y - Ay) * day < 0.0) {
            return false;
        }
        if ((x - Dx) * dax + (y - Dy) * day > 0.0) {
            return false;
        }
        return true;
    }
    
    // return a Point
    function getRangeboxEnforcedPt(boxHeight) {

        var cPt = ctrlPt,
			refPt = computeBasePt(),
			box = computeRangebox(boxHeight);

        if (linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[0].x, box[0].y,
                box[1].x, box[1].y )) {
            return getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[0].x, box[0].y,
                    box[1].x, box[1].y);
        }

        if (linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[2].x, box[2].y,
                box[3].x, box[3].y )) {
            return getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[2].x, box[2].y,
                    box[3].x, box[3].y);
        }

        if (linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[0].x, box[0].y,
                box[2].x, box[2].y )) {

            return getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[0].x, box[0].y,
                    box[2].x, box[2].y);
        }

        if (linesIntersect(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[1].x, box[1].y,
                box[3].x, box[3].y )) {

            return getLineLineIntersection(
                    refPt.x, refPt.y,
                    cPt.x, cPt.y,
                    box[1].x, box[1].y,
                    box[3].x, box[3].y);
        }

        // If no intersection was found, return the original cPt.
        return cPt;
    }

    function getBoundingBox(){
        var xMin, xMax, yMin, yMax, box;

		// Start and end points first
        if (startPt.x > endPt.x) {
            xMin = endPt.x;
            xMax = startPt.x;
        } else {
            xMin = startPt.x;
            xMax = endPt.x;
        }
        if (startPt.y > endPt.y) {
            yMin = endPt.y;
            yMax = startPt.y;
        } else {
            yMin = startPt.y;
            yMax = endPt.y;
        }

		// Now ctrlPt
		if (ctrlPt.x > xMax || ctrlPt.x < xMin) { // it's not between...
			if (ctrlPt.x > xMax) { // higher?
				xMax = ctrlPt.x;
			} else { // Must be lower. Or the same.
				xMin = ctrlPt.x;
			}
		}
		if (ctrlPt.y > yMax || ctrlPt.y < yMin) { // it's not between...
			if (ctrlPt.y > yMax) { // higher?
				yMax = ctrlPt.y;
			} else { // Must be lower. Or the same
				yMin = ctrlPt.y;
			}
		}
		
        // TODO This is probably not super-efficient, 
        // but it's easy to work with.
        return {
					min: {
						x: xMin,
						y: yMin
					},
					max: {
						x: xMax,
						y: yMax
					}
               };
    }

	// Clip the flow, or return a copy of this one. 
	// TODO is is possible to return this? this does weird stuff. 
	function getClippedFlow(startClipRadius, endClipRadius) {
		var flow = makeCopy(),
		startNodeT = 0,
		endNodeT = 1;
		
		if (endClipRadius > 0) {
			// compute t parameter for clipping with the circle around the end point
			endNodeT = flow.getIntersectionTWithCircleAroundEndPoint(endClipRadius);
		}
		
		flow = flow.split(endNodeT)[0];
		
		if (startClipRadius > 0) {
            // compute t parameter for clipping with the circle around the end point
            startNodeT = flow.getIntersectionTWithCircleAroundStartPoint(startClipRadius);
        }

        // cut off the start piece
        flow = flow.split(startNodeT)[1];
		
		return flow;
	}
	
	function computeAzimuth(startPt, endPt) {
		var dx = endPt.x - startPt.x,
			dy = endPt.y - startPt.y;
        return Math.atan2(dy, dx);
	}
	
	function transform(targetPt, dx, dy, angle) {
		var cos = Math.cos(angle),
			sin = Math.sin(angle),
			newX = targetPt.x * cos - targetPt.y * sin + dx;
			
        targetPt.y = targetPt.x * sin + targetPt.y * cos + dy;
        targetPt.x = newX;
	}
	
	function configureArrow(s) {

		var flowWidth, baseT, strokeDiff, smallWidthDiff, plusStroke, minusLength, 
			arrowLength, arrowWidth,
			endT,
			tipT,
			basePt,
			tipPt = {},
			corner1Pt = {},
			corner1cPt = {},
			corner2Pt = {},
			corner2cPt = {},
			azimuth;

		// Get the difference between this flow's stroke size and the biggest
        // stroke size.
		flowWidth = ((s.maxFlowWidth * value) / s.maxFlowValue) * s.scaleMultiplier;
			
		if(flowWidth < s.minFlowWidth * s.scaleMultiplier) {
			flowWidth = s.minFlowWidth * s.scaleMultiplier;
		}
		
		strokeDiff = (s.maxFlowWidth * s.scaleMultiplier) - flowWidth;
	
		// Get the difference between this flow's stroke size and the smallest
        // stroke size.
        smallWidthDiff = flowWidth - (s.minFlowWidth * s.scaleMultiplier);
	
		// Get a percentage of that difference based on valRatio
		plusStroke = strokeDiff * (s.arrowSizeRatio);
	
		// This much length will be subtracted from the lengths of arrowheads, 
        // proportionally to how relatively large they are compared to the 
        // smallest arrowhead. 
        // So the smallest arrowhead will have nothing subtracted, and the 
        // other arrowheads will have the difference between it and the smallest
        // arrowhead * model.getArrowLengthRatio (a number from 0 - 1) subtracted.
        minusLength = smallWidthDiff * (s.arrowLengthRatio);
        
        // Determine the distance of the tip of the arrow from the base.
        // Is scaled to the value of the flow, which itself is scaled by the 
        // scale factor of the model.
		arrowLength = (flowWidth + plusStroke - minusLength)
            * s.arrowLengthScaleFactor;
            
        // Determine the perpendicular distance of the corners of the arrow from 
        // a line drawn between the base and tip of the arrow.
        arrowWidth = (flowWidth + plusStroke)
                * s.arrowWidthScaleFactor;
                
        // Get the t value of the location on the flow where the base of the 
        // arrowhead will sit
		endT = getIntersectionTWithCircleAroundEndPoint(arrowLength + s.endClipRadius);
		tipT = getIntersectionTWithCircleAroundEndPoint(s.endClipRadius);

		// Set the base of the Arrow to the point on the curve determined above.
		basePt = pointOnCurve(endT);

        // Locate the various points that determine the shape and location of 
        // the Arrow. This pulls various parameters from the model that are 
        // themselves modified by the GUI to change the shape of the Arrows. 
        // Locate the tip
        tipPt.x = arrowLength;
        tipPt.y = 0;

        // Locate the first corner
        corner1Pt.x = arrowLength * s.arrowCornerPosition;
        corner1Pt.y = arrowWidth;

        // Locate the first control point
        corner1cPt.x = corner1Pt.x + ((tipPt.x - corner1Pt.x) * s.arrowEdgeCtrlLength);
        corner1cPt.y = arrowWidth * s.arrowEdgeCtrlWidth;

        // locate the second corner
        corner2Pt.x = arrowLength * s.arrowCornerPosition;
        corner2Pt.y = -arrowWidth;

        // locate the second control point
        corner2cPt.x = corner2Pt.x + ((tipPt.x - corner2Pt.x) * s.arrowEdgeCtrlLength);
        corner2cPt.y = -arrowWidth * s.arrowEdgeCtrlWidth;
        
		// Get the angle of the arrow, which is the angle from the basePt to
		// the end point of the flow. 
        azimuth = computeAzimuth(basePt, endPt);
				
		// Transform the arrow points. Increases the size of the arrow
		// and rotates it. 
		transform(tipPt, basePt.x, basePt.y, azimuth);
        transform(corner1Pt, basePt.x, basePt.y, azimuth);
        transform(corner2Pt, basePt.x, basePt.y, azimuth);
        transform(corner1cPt, basePt.x, basePt.y, azimuth);
        transform(corner2cPt, basePt.x, basePt.y, azimuth);
		
		// Split the flow at the base point of the Arrow, plus a little bit.
        // The little bit is to provide sufficient overlap of the flow with the
        // arrowhead to prevent gaps between the flow and arrowhead when the
        // arrowhead is drawn along more curved parts of the flow.
        // Also, the added bit is slightly bigger for very small arrows to 
        // avoid graphical artifacts wherein a space appears between SVG
        // elements that overlap by very small amounts. 
        // TODO This could be further modified to make up-turned arrow corners
        // look better. 
        if (arrowLength > 10) {
			baseT = endT + ((tipT - endT) * 0.1);
        } else if (arrowLength > 5) {
			baseT = endT + ((tipT - endT) * 0.2);
        } else if (arrowLength > 1){
			baseT = endT + ((tipT - endT) * 0.6);
		} else if (arrowLength > 0.5) {
			baseT = endT + ((tipT - endT) * 1);
		} else {
			baseT = endT + ((tipT - endT) * 5);
		}
        
        // Split the flow, add the first half to the arrow object.
		//arrow.outFlow = split(baseT)[0];
		
		arrow = [basePt, corner1Pt, corner1cPt, tipPt, corner2cPt, corner2Pt, split(baseT)[0]];
		
		arrow = {
			basePt: basePt,
			corner1Pt: corner1Pt,
			corner1cPt: corner1cPt,
			tipPt: tipPt,
			corner2cPt: corner2cPt,
			corner2Pt: corner2Pt,
			outFlow: split(baseT)[0],
			arrowLength: arrowLength
		};
	}
	
// PUBLIC =====================================================================

	my.configureArrow = function (arrowSettings) {
		configureArrow(arrowSettings);
	};
	
	my.getIntersectionTWithCircleAroundEndPoint = function(r) {
		return getIntersectionTWithCircleAroundEndPoint(r);
	};

	my.getIntersectionTWithCircleAroundStartPoint = function(r) {
		return getIntersectionTWithCircleAroundStartPoint(r);
	};

	my.split = function(t) {
		return split(t);
	};

	my.getClippedFlow = function(startClipRadius, endClipRadius) {
		return getClippedFlow(startClipRadius, endClipRadius);
	};

    my.getStartPt = function() {
        return startPt;
    };

    my.getEndPt = function() {
        return endPt;
    };

    my.setStartPt = function (sPt) {
        startPt = sPt;
    };

    my.setEndPt = function (ePt) {
        endPt = ePt;
    };

    my.getCtrlPt = function () {
        return ctrlPt;
    };

    my.setCtrlPt = function (cPt) {
        ctrlPt = cPt;
    };

    my.getValue = function () {
        return value;            
    };

    my.setValue = function (val) {
        value = val;
    };

    my.getBaselineAzimuth = function () {
        return getBaselineAzimuth();
    };

    my.getBaselineLength = function () {
        return getBaselineLength();
    };

    my.isLocked = function() {
        return locked;
    };

    my.setLocked = function(boo) {
        if(typeof(boo)!=="boolean") {
            throw new Error("Flow.setLocked(), non-boolean passed");
        } else {
            locked = boo;
        }
    };

    my.straighten = function() {
		var bPt = computeBasePt();
        ctrlPt.x = bPt.x;
        ctrlPt.y = bPt.y;
        ctrlPt.lat = undefined;
        ctrlPt.lng = undefined;
    };

    my.getBaselineMidPoint = function() {
        return computeBasePt();
    };

    my.startToCtrlAngle = function() {
        var dx = ctrlPt.x - startPt.x,
			dy = ctrlPt.y - startPt.y;
        return Math.atan2(dy, dx);
    };

    my.endToCtrlAngle = function() {
        var dx = ctrlPt.x - endPt.x,
			dy = ctrlPt.y - endPt.y;
        return Math.atan2(dy, dx);
    };

    my.getDistanceBetweenStartPointAndControlPoint = function() {
        var dx = ctrlPt.x - startPt.x,
			dy = ctrlPt.y - startPt.y;
        return Math.sqrt(dx * dx + dy * dy);
    };

    my.getDistanceBetweenEndPointAndControlPoint = function() {
        var dx = ctrlPt.x - endPt.x,
			dy = ctrlPt.y - endPt.y;
        return Math.sqrt(dx * dx + dy * dy);
    };

    my.getDirectionVectorFromStartPointToControlPoint = function() {
        var dx = ctrlPt.x - startPt.x,
			dy = ctrlPt.y - startPt.y,
			d = Math.sqrt(dx * dx + dy * dy),
			v = [dx / d, dy / d];
        
        if (isNaN(v[0])) {
			v[0] = 0;
        }
        
        if (isNaN(v[1])) {
			v[1] = 0;
        }
        return v;
    };

    my.getDirectionVectorFromEndPointToControlPoint = function() {
        var dx = ctrlPt.x - endPt.x,
			dy = ctrlPt.y - endPt.y,
			d = Math.sqrt(dx * dx + dy * dy),
			v = [dx / d, dy / d];
       
        if (isNaN(v[0])) {
			v[0] = 0;
        }
        
        if (isNaN(v[1])) {
			v[1] = 0;
        }
        
        return v;
    };
    
    my.isSelected = function() {
		return selected;
	};
    
    my.setSelected = function(boo) {
		selected = boo;
	};

	my.distance = function(xy) {
		return distance(xy);
	};
	
	my.toRegularStraightLineSegments = function(gap) {
		return toRegularStraightLineSegments(gap);
	};


	my.enforceRangebox = function (boxHeight) {
		var pt = getRangeboxEnforcedPt(boxHeight);
		ctrlPt.x = pt.x;
		ctrlPt.y = pt.y;
	};

	my.computeRangebox = function (boxHeight) {
		return computeRangebox(boxHeight);
	};

	// Caches line segments (flow points). 
	my.cacheLineSegments = function (gap) {
		lineSegments = toRegularStraightLineSegments(gap);
	};
	
	my.cacheClippedLineSegments = function (rs, re, gap) {
		var flow = getClippedFlow(rs, re);
		flow.cacheLineSegments(gap);
		lineSegments = flow.getCachedLineSegments();
	};
	
	my.getCachedLineSegments = function () {
		return lineSegments;
	};

	my.pointOnCurve = function(t) {
		return pointOnCurve(t);
	};

	my.getBoundingBox = function() {
		return getBoundingBox();
	};
	
	my.cacheBoundingBox = function () {
		boundingBox = getBoundingBox();
	};
	
	my.getCachedBoundingBox = function () {
		return boundingBox;
	};
	
	my.getId = function () {
		return id;
	};
	
	my.setId = function (d) {
		id = d;
	};
	
	my.getArrow = function() {
		if(arrow){
			return arrow;
		}
		console.log("No arrow!");
		return false;
	};
	
	/**
	 * Add d to the value of this flow
 * @param {Number} d - Value to add.
 * @return {Number} total value of this flow
	 */
	my.addValue = function(d) {
		value += d;
		return value;
	};
	
	my.reverseFlow = function() {
        var temp = startPt;
        startPt = endPt;
        endPt = temp;
	};
	
	my.isPointInRangebox = function(rangeboxHeight) {
		return isPointInRangebox(rangeboxHeight);
	};
	
	
	return my;
};