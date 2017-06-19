Flox.RangeboxEnforcer = function(model) {
  "use strict";

  function enforceFlowControlPointRange(flow) {
    var cPt = {
      x: flow.getCtrlPt().x,
      y: flow.getCtrlPt().y
    }

    var refPt = flow.getBaselineMidPoint();

    var box = computeRangebox(flow);

    // bottom border
    if (Flox.GeomUtils.linesIntersect(
            refPt.x, refPt.y,
            cPt.x, cPt.y,
            box[0].x, box[0].y,
            box[1].x, box[1].y)) {
        Flox.GeomUtils.getLineLineIntersection(
            refPt.x, refPt.y,
            cPt.x, cPt.y,
            box[0].x, box[0].y,
            box[1].x, box[1].y, cPt);
    }

    // top border
    if (Flox.GeomUtils.linesIntersect(
            refPt.x, refPt.y,
            cPt.x, cPt.y,
            box[2].x, box[2].y,
            box[3].x, box[3].y)) {
        Flox.GeomUtils.getLineLineIntersection(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[2].x, box[2].y,
                box[3].x, box[3].y, cPt);
    }
    // right border
    if (Flox.GeomUtils.linesIntersect(
            refPt.x, refPt.y,
            cPt.x, cPt.y,
            box[1].x, box[1].y,
            box[2].x, box[2].y)) {
        Flox.GeomUtils.getLineLineIntersection(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[1].x, box[1].y,
                box[2].x, box[2].y, cPt);
    }
    // left border
    if (Flox.GeomUtils.linesIntersect(
            refPt.x, refPt.y,
            cPt.x, cPt.y,
            box[0].x, box[0].y,
            box[3].x, box[3].y)) {
        Flox.GeomUtils.getLineLineIntersection(
                refPt.x, refPt.y,
                cPt.x, cPt.y,
                box[0].x, box[0].y,
                box[3].x, box[3].y, cPt);
    }
    flow.setCtrlPt(cPt);
  }

  function computeRangebox(flow) {
    var baseDist = flow.getBaselineLength();
    var boxHeight = model.settings.flowRangeboxHeight;

    var startPt = flow.getStartPt();
    var endPt = flow.getEndPt();
    var x1 = startPt.x;
    var y1 = startPt.y;
    var x2 = endPt.x;
    var y2 = endPt.y;
    var dx = x2 - x1;
    var dy = y2 - y1;
    var l = Math.sqrt(dx * dx + dy * dy);

    // unary vector along base line
    var ux = dx / l;
    var uy = dy / l;
    // vector from start and end points of base line to corners
    var vx = -uy * baseDist * boxHeight;
    var vy = ux * baseDist * boxHeight;

    var bottomLeft = {x: x1 - vx, y:  y1 - vy};
    var bottomRight = {x: x2 - vx, y: y2 - vy};
    var topRight = {x: x2 + vx, y: y2 + vy};
    var topLeft = {x: x1 + vx, y: y1 + vy};

    var rangeboxPoints = [bottomLeft, bottomRight, topRight, topLeft];

    return rangeboxPoints;

  }

  function isPointInRangebox(flow, x, y) {
    var baseDist = flow.getBaselineLength();
    var boxHeight = model.settings.flowRangeboxHeight;

    var startPt = flow.getStartPt();
    var endPt = flow.getEndPt();
    var x1 = startPt.x;
    var y1 = startPt.y;
    var x2 = endPt.x;
    var y2 = endPt.y;
    var dx = x2 - x1;
    var dy = y2 - y1;
    var l = Math.sqrt(dx * dx + dy * dy);

    // unary vector along base line
    var ux = dx / l;
    var uy = dy / l;
    // vector from start and end points of base line to corners
    var vx = -uy * baseDist * boxHeight;
    var vy = ux * baseDist * boxHeight;

    // http://stackoverflow.com/questions/2752725/finding-whether-a-point-lies-inside-a-rectangle-or-not
    var Ax = x1 - vx;
    var Ay = y1 - vy;
    var Bx = x2 - vx;
    var By = y2 - vy;
    var Dx = x1 + vx;
    var Dy = y1 + vy;
    var bax = Bx - Ax;
    var bay = By - Ay;
    var dax = Dx - Ax;
    var day = Dy - Ay;

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

  function longestDistanceSqToCorner(rangeBoxCorners, x, y) {
    var maxDistSq = 0;
    for (var i = 0; i < rangeBoxCorners.length; i++) {
      var corner = rangeBoxCorners[i];
      var dx = x - corner.x;
      var dy = y - corner.y;
      var distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
      }
    }
    return maxDistSq;
  }



  // PUBLIC ==============================================

  return {
    enforceFlowControlPointRange: enforceFlowControlPointRange,
    computeRangebox: computeRangebox,
    isPointInRangebox: isPointInRangebox,
    longestDistanceSqToCorner: longestDistanceSqToCorner
  }

};