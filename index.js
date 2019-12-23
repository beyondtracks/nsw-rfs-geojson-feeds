const turf = {
    area: require('@turf/area').default,
    featureEach: require('@turf/meta').featureEach,
    feature: require('@turf/helpers').feature,
    featureCollection: require('@turf/helpers').featureCollection,
    buffer: require('@turf/buffer').default
};
const moment = require('moment-timezone');
const rewind = require('@mapbox/geojson-rewind');
const _ = require('lodash');
const polygonClipping = require('polygon-clipping');
const gp = require('geojson-precision');

const defaultOptions = {
    avoidGeometryCollections: false,
    avoidSlivers: false
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
     *   - Union mulitple Polygons within a single GeometryCollection due to artificial shared borders
     *   - Covert size from a string to a number (in hectares)
     *
     * @param {Object} geojson NSW RFS Major Incidents Upstream Feed as a GeoJSON Object
     * @param {Object} [options]
     * @param {boolean} [options.avoidGeometryCollections=false] Avoid GeometryCollections and explode into flat Features (this may increase the feature count and duplicate properties across multiple features). Defaults to false.
     * @param {boolean} [options.avoidSlivers=false] Try to avoid slivers in the Polygons. Defaults to false.
     * @param {original|guid|pubdate} [options.sort=original] Sort features by. Defaults to `original`.
     * @returns {Object} The "cleaned" GeoJSON Object
     */
    clean(geojson, options) {
        const self = this;

        options = Object.assign({}, defaultOptions, options);

        // clean up the upstream GeoJSON
        let cleanFeatures = [];
        turf.featureEach(geojson, (feature) => {
            const cleanGeometry = self._cleanGeometry(feature.geometry, {avoidSlivers: options.avoidSlivers});
            const cleanProperties = self._cleanProperties(feature.properties);

            if (options.avoidGeometryCollections) {
                if (cleanGeometry.type === 'GeometryCollection') {
                    cleanGeometry.geometries.forEach((geometry) => {
                        const cleanFeature = turf.feature(geometry, cleanProperties);
                        cleanFeatures.push(cleanFeature);
                    });
                }
            } else {
                const cleanFeature = turf.feature(cleanGeometry, cleanProperties);
                cleanFeatures.push(cleanFeature);
            }
        });

        // promote GUID to id
        cleanFeatures = cleanFeatures.map((feature) => {
            const featureID = self._extractID(feature.properties.guid);
            if (featureID !== null) {
                feature.id = featureID;
            }
            return feature;
        });

        // sort features
        const sortBy = {
            guid: 'id',
            pubdate: i => (new Date(i.properties['pub-date'])).getTime()
        };
        if (options.sort && options.sort in sortBy) {
            cleanFeatures = _.sortBy(cleanFeatures, [sortBy[options.sort]]);
        }

        // create final GeoJSON with winding order enforced, and
        // limited coordinate precision for points (polygons are left in tact to avoid
        // creating invalid geometries)
        const cleanedGeoJSON = gp(rewind(turf.featureCollection(cleanFeatures)), 4, 4, {
            skipLineString: true,
            skipPolygon: true
        });

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
     * Given a GUID string in the form `https://incidents.rfs.nsw.gov.au/api/v1/incidents/361069`
     * return the ID as a number.
     *
     * @param {string} guid
     * @returns {Number}
     * @private
     */
    _extractID(guid) {
        if (guid) {
            const matches = guid.match(/([0-9]*)$/);
            if (matches && matches.length === 2) {
                const integer = Number.parseInt(matches[1]);
                if (Number.isFinite(integer)) {
                    return integer;
                }
            }
        }

        return null;
    },

    /**
     * Given a GeoJSON Geometry object, flattens any GeometryCollection's out
     * into an Array of Geometry objects.
     *
     * @param {Object} geometry A GeoJSON Geometry object
     * @returns {Array} An Array of GeoJSON Geometry objects
     * @private
     */
    _flattenGeometries(geometry) {
        const self = this;

        if (geometry === undefined) {
            return [];
        }

        if (geometry === null) {
            return [geometry];
        }

        if (geometry.type !== 'GeometryCollection') {
            return [geometry];
        } else if (geometry.geometries && geometry.geometries.length) {
            return _.flattenDeep(geometry.geometries.map(g => self._flattenGeometries(g)));
        } else {
            return [];
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
    _uniformType(geometryList) {
        if (geometryList.length < 2) {
            return true;
        } else {
            return geometryList.map(geom => geom.type).reduce((acc, cur) => acc === cur);
        }
    },

    /**
     * Avoids nested GeometryCollections where possible and converts single type
     * GeometryCollections into multipart geometry types. Where the GeometryCollection
     * contains mixed geometries, they are also reduced into a GeometryCollection of
     * multipart geometries.
     *
     * @param {Object} geometry A GeoJSON Geometry
     * @params {Object} [options]
     * @params {boolean} [options.avoidSlivers=false] Try to avoid slivers in the Geometry by buffering then reverse buffering.
     * @returns {Object} A GeoJSON Geometry avoiding nested GeometryCollections and using multipart geometry types in favour of single type GeometryCollections
     * @private
     */
    _cleanGeometry(geometry, options) {
        options = Object.assign({}, {avoidSlivers: false}, options);

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
            .filter(g => g !== null);

        if (!flatGeometries.length) return null;

        if (flatGeometries.length === 1) {
            // a single geomtery can be returned as is
            return flatGeometries[0];
        } else {
            // Attempt to union multiple Polygons found within the GeometryCollection,
            // since as of Dec 2019 large polygons are being split on artificial internal
            // boundaries which we try to remove.
            const sliverBuffer = 25;
            const polygons = flatGeometries.filter(geometry => geometry.type === 'Polygon').map(geometry => (options.avoidSlivers ? turf.buffer(geometry, sliverBuffer, {units: 'meters'}).geometry : geometry));
            const nonPolygons = flatGeometries.filter(geometry => geometry.type !== 'Polygon');

            const flatGeometriesUnioned = nonPolygons;
            if (polygons.length) {
                try {
                    let unioned;
                    if (polygons.length > 1) {
                        const polygonsUnioned = polygonClipping.union(...polygons.map(g => g.coordinates));
                        if (polygonsUnioned.length > 1) {
                            unioned = {
                                type: 'MultiPolygon',
                                coordinates: polygonsUnioned
                            };
                        } else {
                            unioned = {
                                type: 'Polygon',
                                coordinates: polygonsUnioned[0]
                            };
                        }
                    } else {
                        unioned = polygons[0];
                    }

                    if (options.avoidSlivers) {
                        flatGeometriesUnioned.push(turf.buffer(unioned, -sliverBuffer, {units: 'meters'}).geometry);
                    } else {
                        flatGeometriesUnioned.push(unioned);
                    }
                } catch (e) {
                    // if there was an error unioning polygons, then still output them in their original form
                    console.error('Union error', e);
                    if (options.avoidSlivers) {
                        flatGeometriesUnioned.push(...(turf.buffer(polygons, -sliverBuffer, {units: 'meters'})));
                    } else {
                        flatGeometriesUnioned.push(...polygons);
                    }
                }
            }

            if (this._uniformType(flatGeometriesUnioned)) {
                const type = flatGeometriesUnioned[0].type;

                // can be converted into a multi geom type
                if (type === 'MultiPolygon') {
                    return flatGeometriesUnioned[0];
                } else {
                    return {
                        type: `Multi${  type}`,
                        coordinates: flatGeometriesUnioned.map(g => g.coordinates)
                    };
                }
            } else {
                // can't be converted into a geom type, use GeometryCollection instead
                // however still check if any of the geometries can be combined into multi types
                const points = flatGeometriesUnioned.filter(g => g.type === 'Point');
                const lines = flatGeometriesUnioned.filter(g => g.type === 'LineString');
                const polygons = flatGeometriesUnioned.filter(g => g.type === 'Polygon');
                const others = flatGeometriesUnioned.filter(g => !(['Point', 'LineString', 'Polygon'].includes(g.type)));

                const geometries = [];
                if (points.length > 1) {
                    geometries.push({
                        type: 'MultiPoint',
                        coordinates: points.map(g => g.coordinates)
                    });
                } else if (points.length === 1) {
                    geometries.push(points[0]);
                }

                if (lines.length > 1) {
                    geometries.push({
                        type: 'MultiLineString',
                        coordinates: lines.map(g => g.coordinates)
                    });
                } else if (lines.length === 1) {
                    geometries.push(lines[0]);
                }

                if (polygons.length > 1) {
                    geometries.push({
                        type: 'MultiPolygon',
                        coordinates: polygons.map(g => g.coordinates)
                    });
                } else if (polygons.length === 1) {
                    geometries.push(polygons[0]);
                }

                if (others.length > 1) {
                    geometries.push(...others);
                } else if (others.length === 1) {
                    geometries.push(others[0]);
                }

                return {
                    type: 'GeometryCollection',
                    geometries
                };
            }
        }
    },

    _cleanProperties(properties) {
        if (properties.pubDate) {
            properties.pubDate = this._cleanPubDate(properties.pubDate);
            properties['pub-date'] = properties.pubDate;
            delete properties.pubDate;
        }

        if (properties.description) {
            Object.assign(properties, this._unpackDescription(properties.description));
            delete properties.description; // remove original description string
        }

        if (properties.size) {
            if (typeof properties.size === 'string') {
                const area = Number(properties.size.replace(/\s*ha\s*$/i, ''));
                if (isNaN(area)) {
                    delete properties.size;
                } else {
                    properties.size = area;
                }
            }
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
            properties.fire = !!properties.fire.match(/Yes/i);

        // since this is a generic link applying to every incident don't bother to include it for each
        if ('link' in properties && properties.link === 'http://www.rfs.nsw.gov.au/fire-information/fires-near-me') {
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
    _cleanPubDate(datetime) {
        return moment.tz(datetime, 'D/MM/YYYY h:mm:ss A', 'Australia/Sydney').format();
    },

    /**
     * Given an date string like "3 Jan 2018 16:20" as used in the UPDATED field
     * within the description, return in ISO8601 format. Assumes time in local
     * times of Australia/Sydney.
     *
     * @param {String} datetime A date string like "3 Jan 2018 16:20" as used in the UPDATED field
     * @param {boolean} twelveHour `true` if the date is in 12 hour format, otherwise assumes 24 hour format.
     * @returns {String} An ISO8601 formatted datetime
     * @private
     */
    _cleanUpdatedDate(datetime, twelveHour) {
        return moment.tz(datetime, twelveHour ? 'D MMM YYYY HH:mmA' : 'D MMM YYYY HH:mm', 'Australia/Sydney').format();
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
    _unpackDescription(description) {
        const self = this;

        if (!description)
            return {};

        const lines = description.split(/ *<br ?\/?> */);
        const result = {};
        for (const line of lines) {
            const splits = line.split(':');
            if (splits && splits.length >= 2) {
                let key;
                let value;
                // when they use MAJOR FIRE UPDATE AS AT 15 Dec 2019 11:12PM: http://
                // they must have really wanted to make life harder for us and made
                // applications more likely to break without warning
                if (splits[0].startsWith('MAJOR FIRE UPDATE AS AT')) {
                    // take the first two as the key and use the rest as value
                    const keyParts = [];
                    keyParts.push(splits.shift());
                    keyParts.push(splits.shift());

                    key = keyParts.join(':');
                    value = splits.join(':').trim();

                    // now translate
                    //   key: MAJOR FIRE UPDATE AS AT 21 Dec 2019 11:12PM
                    //   value: <a href='http://www.rfs.nsw.gov.au/fire-information/major-fire-updates/mfu?id=6025' target='_blank'> More information</a>
                    // into
                    //   link: http://www.rfs.nsw.gov.au/fire-information/major-fire-updates/mfu?id=6025
                    //   link-updated: 2019-12-21T23:12:00+11:00
                    const asAt = key.replace(/^MAJOR FIRE UPDATE AS AT /, '');
                    const date = this._cleanUpdatedDate(asAt, true);
                    const matches = value.match('(http[^\']*)');
                    if (matches && matches.length === 2) {
                        const link = matches[1];

                        result['major-fire-update-link'] = link;
                        result['major-fire-update-updated'] = date;
                        continue;
                    }
                } else {
                    // take the first one as the key
                    key = splits.shift();
                    // join the rest into the value
                    value = splits.join(':').trim();
                }

                if (key === 'UPDATED') {
                    value = self._cleanUpdatedDate(value);
                }

                // lower case keys and use - instead of spaces
                key = key.replace(/ /g, '-').toLowerCase();

                result[key] = value;
            }
        }

        if ('major-fire-update-link' in result) {
            result.link = result['major-fire-update-link'];
            delete result['major-fire-update-link'];
        }
        if ('major-fire-update-updated' in result) {
            result['link-updated'] = result['major-fire-update-updated'];
            delete result['major-fire-update-updated'];
        }

        return result;
    }
};
