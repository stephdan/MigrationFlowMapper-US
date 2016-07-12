Flox.ColorUtils = (function() {
	
	"use strict";
	
	var my = {};
	
	my.blend = function(c1, c2, ratio) {
		if (ratio > 1) {
			return c2;
		}
		if (ratio < 0) {
			return c1;
		}
	
		var r1 = c1[0],
		    g1 = c1[1],
		    b1 = c1[2],
		    a1 = c1[3],
		    r2 = c2[0],
		    g2 = c2[1],
		    b2 = c2[2],
		    a2 = c2[3],
		    r = Math.round(r1 + (r2 - r1) * ratio),
		    g = Math.round(g1 + (g2 - g1) * ratio),
		    b = Math.round(b1 + (b2 - b1) * ratio),
		    a = (a1 + (a2 - a1) * ratio);
	
		return [r,g,b,a];
	
	};
	
	my.getColorRamp = function(c1, c2, breaks) {
		var ramp = [c1], 
			i, b, k;
		k = 1 / (breaks - 1);
		b = k;
		for(i = 1; i < (breaks - 1); i += 1) {
			ramp.push(my.blend(c1, c2, b));
			b += k;
		}
		ramp.push(c2);
		return ramp;
	};
	
	return my;

}());
