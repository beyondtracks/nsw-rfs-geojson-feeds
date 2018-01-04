const gp = require('geojson-precision');
const turf = {
    featureEach: require('@turf/meta').featureEach,
    feature: require('@turf/helpers').feature,
    featureCollection: require('@turf/helpers').featureCollection
};
const moment = require('moment-timezone');
const rewind = require('geojson-rewind');
const _ = require('lodash');

module.exports = {
    /**
     * "Cleans" the NSW RFS Major Incidents Upstream Feed to:
     *
     *   - Avoid nested GeometryCollections
     *   - Limit coordinate precision
     *   - Unpack overloaded description field
     *   - Use ISO8601 formatted datetimes
     *   - Enforce GeoJSON winding order
     *
     * @param {Object} geojson NSW RFS Major Incidents Upstream Feed as a GeoJSON Object
     * @return {String
     */
    clean: function(geojson) {
        var self = this;

        // clean up the upstream GeoJSON
        var cleanFeatures = [];
        turf.featureEach(geojson, function (feature) {
            var cleanGeometry = self._cleanGeometry(feature.geometry);
            var cleanProperties = self._cleanProperties(feature.properties);

            var cleanFeature = turf.feature(cleanGeometry, cleanProperties);
            cleanFeatures.push(cleanFeature);
        });
        var cleanedGeoJSON = turf.featureCollection(cleanFeatures);

        // Limit Coordinate Precision
        cleanedGeoJSON = gp.parse(cleanedGeoJSON, 4);

        // Enforce Winding Order
        cleanedGeoJSON = rewind(cleanedGeoJSON);

        return cleanedGeoJSON;
    },

    /**
     * Given a GeoJSON Geometry object, flattens any GeometryCollection's out
     * into an Array of Geometry objects.
     *
     * @param {Object} geometry A GeoJSON Geometry object
     * @returns {Array} An Array of GeoJSON Geometry objects
     * @private
     */
    _flattenGeometries: function(geometry) {
        var self = this;

        if (geometry === undefined) {
            return [];
        }

        if (geometry === null) {
            return [geometry];
        }

        if (geometry.type !== 'GeometryCollection') {
            return [geometry];
        } else {
            if (geometry.geometries && geometry.geometries.length) {
                return _.flattenDeep(geometry.geometries.map((g) => { return self._flattenGeometries(g); }));
            } else {
                return [];
            }
        }
    },

    /**
     * Given an Array of GeoJSON GeometryCollection geometries determines if they
     * are all of uniform type.
     *
     * @param {Array} geometryList An Array of GeoJSON GeometryCollection geometries
     * @returns {boolean}
     * @private
     */
    _uniformType: function (geometryList) {
        if (geometryList.length < 2) {
            return true;
        } else {
            return geometryList.map((geom) => {
                return geom.type;
            }).reduce((acc, cur) => {
                return acc === cur;
            });
        }
    },

    /**
     * Avoids nested GeometryCollections where possible and converts single type
     * GeometryCollections into multipart geometry types.
     *
     * @param {Object} geometry A GeoJSON Geometry
     * @returns {Object} A GeoJSON Geometry avoiding nested GeometryCollections and using multipart geometry types in favour of single type GeometryCollections
     * @private
     */
    _cleanGeometry: function (geometry) {
        var flat = this._flattenGeometries(geometry);

        if (!flat.length) return;

        if (flat.length == 1) {
            return flat[0];
        } else {
            if (this._uniformType(flat)) {
                // can be converted into a multi geom type
                return {
                    type: 'Multi' + flat[0].type,
                    coordinates: flat.map((g) => { return g.coordinates; })
                }
            } else {
                // can't be converted into a geom type, use GeometryCollection instead
                return {
                    type: 'GeometryCollection',
                    geometries: flat
                };
            }
        }
    },

    _cleanProperties: function(properties) {
        if (properties.pubDate) {
            properties.pubDate = this._cleanPubDate(properties.pubDate);
        }

        if (properties.description) {
            Object.assign(properties, this._unpackDescription(properties.description));
            delete properties.description; // remove original description string
        }

        // since this is a generic link applying to every incident don't bother to include it for each
        if (properties.link == 'http://www.rfs.nsw.gov.au/fire-information/fires-near-me') {
            delete properties.link;
        }

        return properties;
    },


    /**
     * Given an date string like "3/01/2018 5:20:00 AM" as used in the pubDate
     * field, return in ISO8601 format. Assumes time in local times of
     * Australia/Sydney.
     *
     * @param {String} datetime A date string like "3/01/2018 5:20:00 AM" as used in the pubDate field
     * @returns {String} An ISO8601 formatted datetime
     * @private
     */
    _cleanPubDate: function(datetime) {
        return moment.tz(datetime, 'D/MM/YYYY h:mm:ss A', 'Australia/Sydney').format();
    },

    /**
     * Given an date string like "3 Jan 2018 16:20" as used in the UPDATED field
     * within the description, return in ISO8601 format. Assumes time in local
     * times of Australia/Sydney.
     *
     * @param {String} datetime A date string like "3 Jan 2018 16:20" as used in the UPDATED field
     * @returns {String} An ISO8601 formatted datetime
     * @private
     */
    _cleanUpdatedDate: function(datetime) {
        return moment.tz(datetime, 'D MMM YYYY HH:mm', 'Australia/Sydney').format();
    },

    /**
     * Unpacks the overloaded description string like "KEY1: Value1 <br />KEY2: Value2"
     * into an Object like:
     *
     *    {
     *       "KEY1": "Value1",
     *       "KEY2": "Value2"
     *    }
     *
     * @param {String} description The description field string.
     * @returns {Object} An Object of the unpacked description
     * @private
     */
    _unpackDescription: function(description) {
        var self = this;

        if (!description)
            return {};

        var lines = description.split(/ *<br ?\/?> */);
        var result = {};
        lines.forEach((line) => {
            var match = line.match(/^([^:]*): ?(.*)/);
            if (match && match.length >= 3) {
                var key = match[1];
                var value = match[2];

                if (key == 'UPDATED') {
                    value = self._cleanUpdatedDate(value);
                }

                result[key] = value;
            }
        });

        return result;
    }
};
