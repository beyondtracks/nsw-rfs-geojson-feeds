const gp = require('geojson-precision');
const turf = {
    area: require('@turf/area').default,
    featureEach: require('@turf/meta').featureEach,
    feature: require('@turf/helpers').feature,
    featureCollection: require('@turf/helpers').featureCollection
};
const moment = require('moment-timezone');
const rewind = require('geojson-rewind');
const _ = require('lodash');
const polygonClipping = require('polygon-clipping');

const defaultOptions = {
    avoidGeometryCollections: false
};

module.exports = {
    /**
     * "Cleans" the NSW RFS Major Incidents Upstream Feed to:
     *
     *   - Avoid nested GeometryCollections
     *   - Limit coordinate precision
     *   - Unpack overloaded description field
     *   - Use ISO8601 formatted datetimes
     *   - Enforce GeoJSON winding order
     *   - Union mulitple Polygons within a single GeometryCollection due to artificial shared borders.
     *
     * @param {Object} geojson NSW RFS Major Incidents Upstream Feed as a GeoJSON Object
     * @param {Object} [options]
     * @param {boolean} [options.avoidGeometryCollections=false] Avoid GeometryCollections and explode into flat Features (this may increase the feature count and duplicate properties across multiple features). Defaults to false.
     * @returns {Object} The "cleaned" GeoJSON Object
     */
    clean: function (geojson, options) {
        const self = this;

        options = Object.assign({}, defaultOptions, options);

        // clean up the upstream GeoJSON
        const cleanFeatures = [];
        turf.featureEach(geojson, (feature) => {
            const cleanGeometry = self._cleanGeometry(feature.geometry);
            const cleanProperties = self._cleanProperties(feature.properties);

            if (options.avoidGeometryCollections) {
                if (cleanGeometry.type === 'GeometryCollection') {
                    cleanGeometry.geometries.map((geometry) => {
                        const cleanFeature = turf.feature(geometry, cleanProperties);
                        cleanFeatures.push(cleanFeature);
                    });
                }
            } else {
                const cleanFeature = turf.feature(cleanGeometry, cleanProperties);
                cleanFeatures.push(cleanFeature);
            }
        });

        // sort happens inplace
        // features are sorted so that important incidents appear on top of lesser ones on the map
        cleanFeatures.sort((a, b) => {
            const sortIndexAlertLevelA = self._sortIndexAlertLevel(a.properties['alert-level']);
            const sortIndexAlertLevelB = self._sortIndexAlertLevel(b.properties['alert-level']);

            const sortIndexStatusA = self._sortIndexStatus(a.properties['status']);
            const sortIndexStatusB = self._sortIndexStatus(b.properties['status']);

            if (sortIndexStatusA == sortIndexStatusB) {
                return sortIndexAlertLevelB - sortIndexAlertLevelA;
            } else {
                return sortIndexStatusB - sortIndexStatusA;
            }
        });

        // create final GeoJSON with winding order enforced
        const cleanedGeoJSON = rewind(turf.featureCollection(cleanFeatures));

        // Limit Coordinate Precision
        // disabled since this can invalidate valid polygons if they are small or have fine detail
        // cleanedGeoJSON = gp.parse(cleanedGeoJSON, 4);

        return cleanedGeoJSON;
    },

    _sortIndexStatus(value) {
        switch (value) {
            case 'Out of control':
                return 0;
            case 'Being controlled':
                return 1;
            case 'Under control':
                return 3;
            default:
                return 4;
        }
    },

    _sortIndexAlertLevel(value) {
        switch (value) {
            case 'Emergency Warning':
                return 0;
            case 'Watch and Act':
                return 1;
            case 'Advice':
                return 2;
            case 'Not Applicable':
                return 3;
            default:
                return 4;
        }
    },

    /**
     * Given a GeoJSON Geometry object, flattens any GeometryCollection's out
     * into an Array of Geometry objects.
     *
     * @param {Object} geometry A GeoJSON Geometry object
     * @returns {Array} An Array of GeoJSON Geometry objects
     * @private
     */
    _flattenGeometries: function (geometry) {
        const self = this;

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
        // explode GeometryCollections into an array of Geometries
        // also removing any 0 area polygons
        const flatGeometries = this._flattenGeometries(geometry) 
            .map((g) => {
                if (g && g.type === 'Polygon' && turf.area(g) === 0) {
                    // not a valid polygon
                    return null;
                }
                return g;
            })
            .filter((g) => {
                return g !== null;
            });

        if (!flatGeometries.length) return null;

        if (flatGeometries.length == 1) {
            return flatGeometries[0];
        } else {
            // attempt to union multiple Polygons found within the GeometryCollection
            const polygons = flatGeometries.filter((geometry) => { return geometry.type === 'Polygon'; });
            const nonPolygons = flatGeometries.filter((geometry) => { return geometry.type !== 'Polygon'; });

            const flatGeometriesUnioned = nonPolygons;
            if (polygons.length) {
                const unioned = {
                    type: 'MultiPolygon',
                    coordinates: polygonClipping.union(...polygons.map((g) => { return g.coordinates; }))
                };
                flatGeometriesUnioned.push(unioned);
            }

            if (this._uniformType(flatGeometriesUnioned)) {
                const type = flatGeometriesUnioned[0].type;

                // can be converted into a multi geom type
                if (type === 'MultiPolygon') {
                    return flatGeometriesUnioned[0];
                } else {
                    return {
                        type: 'Multi' + type,
                        coordinates: flatGeometriesUnioned.map((g) => { return g.coordinates; })
                    }
                }
            } else {
                // can't be converted into a geom type, use GeometryCollection instead
                return {
                    type: 'GeometryCollection',
                    geometries: flatGeometriesUnioned
                };
            }
        }
    },

    _cleanProperties: function (properties) {
        if (properties.pubDate) {
            properties.pubDate = this._cleanPubDate(properties.pubDate);
            properties['pub-date'] = properties.pubDate;
            delete properties.pubDate;
        }

        if (properties.description) {
            Object.assign(properties, this._unpackDescription(properties.description));
            delete properties.description; // remove original description string
        }

        /* use a simplified schema removing some keys and using identifiers rather than full names for some values */

        // ALERT LEVEL seems to be a duplicate of category, best practice is to avoid duplication to reduce the risk of them coming out of sync
        if ('alert-level' in properties && 'category' in properties && (properties.category !== properties['alert-level'])) {
            console.error('properties.category !== description.ALERT LEVEL!', properties.category, properties['alert-level']);
        }

        if ('alert-level' in properties)
            delete properties['alert-level'];

        if ('category' in properties) {
            properties['alert-level'] = properties.category;
            delete properties.category;
        }

        if ('guid_isPermaLink' in properties)
            delete properties['guid_isPermaLink'];

        if ('fire' in properties)
            properties.fire = properties.fire.match(/Yes/i) ? true : false;

        // since this is a generic link applying to every incident don't bother to include it for each
        if ('link' in properties && properties.link == 'http://www.rfs.nsw.gov.au/fire-information/fires-near-me') {
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
    _cleanPubDate: function (datetime) {
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
    _cleanUpdatedDate: function (datetime) {
        return moment.tz(datetime, 'D MMM YYYY HH:mm', 'Australia/Sydney').format();
    },

    /**
     * Unpacks the overloaded description string like "KEY1: Value1 <br />KEY 2: Value2"
     * into an Object like:
     *
     *    {
     *       "key": "Value1",
     *       "key-2": "Value2"
     *    }
     *
     *  Keys are lower cased and have spaces replaced with a dash character `-`.
     *
     * @param {String} description The description field string.
     * @returns {Object} An Object of the unpacked description
     * @private
     */
    _unpackDescription: function (description) {
        const self = this;

        if (!description)
            return {};

        const lines = description.split(/ *<br ?\/?> */);
        const result = {};
        lines.forEach((line) => {
            const match = line.match(/^([^:]*): ?(.*)/);
            if (match && match.length >= 3) {
                let key = match[1];
                let value = match[2];

                if (key == 'UPDATED') {
                    value = self._cleanUpdatedDate(value);
                }

                // lower case keys and use - instead of spaces
                key = key.replace(' ', '-').toLowerCase()

                result[key] = value;
            }
        });

        return result;
    }
};
