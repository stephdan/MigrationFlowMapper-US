var closestPair = (function(){
"use strict";

var my = {};

function getRandomPoints(howMany, maxD) {
	var xCoords = [],
		yCoords = [],
		i,
		points = [];
		
	i = 0;
	while(i < howMany) {
		xCoords.push(Math.random() * maxD);
		i += 1;
	}
	
	i = 0;
	while(i < howMany) {
		yCoords.push(Math.random() * maxD);
		i += 1;
	}
	for(i = 0; i < xCoords.length; i += 1) {
		points.push({x: xCoords[i], y: yCoords[i]});
	}
	return points;
}

function sortPointsByX(points) {
	return points.sort(function(a,b){
		return a.x - b.x;
	});
}

function distanceSquared(p1, p2) {
	return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

function closestPair(points) {
	var min = Infinity,
		i, j, dist;
	for(i = 0; i < points.length; i += 1) {
		for(j = i + 1; j < points.length; j += 1) {
			dist = distanceSquared(points[i], points[j]);
			if(dist < min) {
				min = dist;
			}
		}
	}
	return Math.sqrt(min);
}

function stripClosest(strip, delta) {
	"use strict";
	
	var i, j,
		min = delta * delta;
	
	// sort them by y
	strip.sort(function(a,b) {
		return a.y - b.y;
	});

	for(i = 0; i < strip.length; i += 1) {
		for(j = i + 1; j < strip.length && (strip[j].y - strip[i].y) < min; j += 1){
			if(distanceSquared(strip[i], strip[j]) < min) {
				min = distanceSquared(strip[i], strip[j]);
			}
		}
	}
	return Math.sqrt(min);
}

function closestPairDivideAndConquer(points) {
	
	"use strict";
	
	var midIndex = Math.floor(points.length/2),
		midX,
		pointsL,
		pointsR,
		delta,
		deltaL,
		deltaR,
		deltaStrip,
		pointsStrip = [],
		i;
	
	if (points.length < 2) {
		return Infinity;
	}
	
	// sort points by x coord
	points.sort(function(a,b){
		return a.x - b.x;
	});
	
	pointsL = points.slice(0, midIndex);
	pointsR = points.slice(midIndex + 1, points.length);
	
	// get the middle x coord of all points
	midX = points[midIndex].x;
	
	// Get the closest distance for points on each side of mixX
	deltaL = closestPair(pointsL);
	deltaR = closestPair(pointsR);
	
	// Get the smallest of d1 & d2, make that delta.
	delta = Math.min(deltaL, deltaR);

	// get the points within delta of midX
	for(i = 0; i < points.length; i += 1) {
		if(Math.abs(points[i].x - midX) < delta) {
			pointsStrip.push(points[i]);
		}
	}

	deltaStrip = stripClosest(pointsStrip, delta);
	
	return Math.min(delta, deltaStrip);
}

my.closestPairDivideAndConquer = function(points) {
	return closestPairDivideAndConquer(points);
};

my.getRandomPoints = function(howMany, maxD) {
	return getRandomPoints(howMany, maxD);
};

return my;

}());






