/**
 * Point object for storing coordinates and values.
 * Stores two types of coordinates: latLng and pixel coordinates. Uses 
 * leaflet.js functions to translate latlng into pixel coordinates. LatLng is 
 * updated when pixel coordinates are changed, and vice versa. Pixel coordinates
 * are updated when the map is zoomed. 
 * @param {Object} lng Longitude
 * @param {Object} lat Latitude
 * @param {Object} val (optional) Value, determines size of drawn point
 */
Flox.Point = function(lng, lat, val) {
    "use strict";
    
    // _value determines the display size
    var value;
    
    // Set _value with optional val
    if(val && typeof val === "number") {
		value = val;
    } else { // No val was provided, set to default
		value = 1; // FIXME hardcoded value
    }

	// Initialize _latLng
	var latLng = Flox.createLatLng(lat,lng);

    // Initialize pixel coordinates. 
    var layerPt = Flox.latLngToLayerPt([lat,lng]);

	// Selected flag
	var selected = false;

    return {

		/**
		 * Returns the x pixel coordinate
		 * @return x pixel coordinate
		 */
        getX: function() {
            return layerPt.x;
        },

		/**
		 * Returns the y pixel coordinate
		 * @return y pixel coordinate
		 */
        getY: function() {
            return layerPt.y;
        },
        
        /**
         * Set the x pixel coordinate of this point. Updates _latLng
         * @param {Object} x New x pixel coordinate
         */
        setX: function(x) {
			if(isNaN(x)){
				// TODO For debugging... Should try to handle this case better.
				console.log("Something tried to make an x coordinate NaN");
			}
            layerPt.x = x;
            latLng = Flox.layerPtToLatLng(layerPt);
        },

		/**
         * Set the y pixel coordinate of this point. Updates _latLng
         * @param {Object} y New y pixel coordinate
         */
        setY: function(y) {
			if(isNaN(y)){
				// TODO For debugging... Should try to handle this case better.
				console.log("Something tried to make a y coordinate NaN")
			}
            layerPt.y = y;
            latLng = Flox.layerPtToLatLng(layerPt);
        },

		/**
		 * @return latitude
		 */
        getLat: function() {
            return latLng.lat;
        },

		/**
		 * Sets the latitude, updates _layerPt
         * @param lat
		 */
        setLat: function(lat) {
            latLng.lat = lat;
            layerPt = Flox.latLngToLayerPt(latLng);
        },

		/**
		 * @return longitude
		 */
        getLng: function() {
            return latLng.lng;
        },

		/**
		 * Sets the longitude, updates _layerPt
         * @param lng
		 */
        setLng: function(lng) {
            latLng.lng = lng;
            layerPt = Flox.latLngToLayerPt(latLng);
        },

		/**
		 * Sets _layerPt to a new layer point.
         * @param {Object} layerPt
		 */
        setLayerPt: function(lPt) {
            layerPt = lPt;
            latLng = Flox.layerPtToLatLng(layerPt);
        },
        
        /**
         * Sets _latLng to a new latLng
         * @param {Object} ll
         */
        setLatLng: function(ll) {
            latLng = ll;
            layerPt = Flox.latLngToLayerPt(ll);
        },

		/**
		 * @return the value of this point
		 */
        getValue: function() {
            return value;
        },

		/**
		 * Set the value of this point
         * @param {Object} val
		 */
        setValue: function(val) {
            value = val;
        },

        /**
         * returns a new Point rotated (clockwise?) around an origin point by a 
         * specified angle
		 * @param {Object} origin
		 * @param {Object} angle
		 * @return New rotated point
         */
        rotatePoint: function(origin, angle) {

            var tempX = layerPt.x - origin.getX(),
                tempY = layerPt.y - origin.getY(),
                cos = Math.cos(angle),
                sin = Math.sin(angle),
                newX = tempX * cos - tempY * sin,
                newY = tempX * sin + tempY * cos,
                newLayerPt = L.point(newX + origin.getX(), newY + origin.getY());
                
            return Flox.layerPtToPoint(newLayerPt);
        },
 
		isSelected: function() {
			return selected;
		},
		
		setSelected: function(boo) {
			selected = boo;
		}
    };
};