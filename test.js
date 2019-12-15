const test = require('tape'),
    _ = require('./');

test('uniformType', (t) => {
    t.true(_._uniformType([]), 'empty array');
    t.true(_._uniformType([
        {type: 'Point'}
    ]), 'single item');
    t.true(_._uniformType([
        {type: 'Point'},
        {type: 'Point'}
    ]), 'two items with same type');
    t.false(_._uniformType([
        {type: 'Point'},
        {type: 'Polygon'}
    ]), 'two items with different type');
    t.end();
});

test('flattenGeometries', (t) => {
    t.deepEqual(_._flattenGeometries(), [], 'no argument');

    t.deepEqual(_._flattenGeometries(null), [null], 'empty geometry');

    t.deepEqual(_._flattenGeometries({
        type: 'Point'
    }),
    [{
        type: 'Point'
    }],
    'single item already flat');

    t.deepEqual(_._flattenGeometries({
        type: 'GeometryCollection'
    }),
    [],
    'single empty GeometryCollection');

    t.deepEqual(_._flattenGeometries({
        type: 'GeometryCollection',
        geometries: [{type: 'Point'}]
    }),
    [
        {type: 'Point'}
    ],
    'single level GeometryCollection');

    t.deepEqual(_._flattenGeometries({
        type: 'GeometryCollection',
        geometries: [
            {
                type: 'GeometryCollection',
                geometries: [
                    {type: 'Point'}
                ]
            }
        ]
    }),
    [
        {type: 'Point'}
    ],
    'two level GeometryCollection');

    t.deepEqual(_._flattenGeometries({
        type: 'GeometryCollection',
        geometries: [
            {
                type: 'GeometryCollection',
                geometries: [
                    {type: 'Point'}
                ]
            },
            {type: 'Polygon'}
        ]
    }),
    [
        {type: 'Point'},
        {type: 'Polygon'}
    ],
    'two level GeometryCollection with siblings');
    t.end();
});

test('cleanPubDate', (t) => {
    t.equal(_._cleanPubDate('3/01/2018 5:20:00 AM'), '2018-01-03T05:20:00+11:00', 'pubDate string AEDT');
    t.equal(_._cleanPubDate('3/06/2018 5:20:00 AM'), '2018-06-03T05:20:00+10:00', 'pubDate string AEST');
    t.end();
});

test('cleanUpdatedDate', (t) => {
    t.equal(_._cleanUpdatedDate('3 Jan 2018 16:20'), '2018-01-03T16:20:00+11:00', 'updated date string AEDT');
    t.equal(_._cleanUpdatedDate('3 Jun 2018 16:20'), '2018-06-03T16:20:00+10:00', 'updated date string AEST');
    t.end();
});

test('unpackDescription', (t) => {
    t.deepEqual(_._unpackDescription(), {}, 'undefined arg');
    t.deepEqual(_._unpackDescription(''), {}, 'empty string');
    t.deepEqual(_._unpackDescription('key: Value'), {'key': 'Value'}, 'single key value');
    t.deepEqual(_._unpackDescription('KEY: Value'), {'key': 'Value'}, 'lowercase key');
    t.deepEqual(_._unpackDescription('KEY 2: Value'), {'key-2': 'Value'}, 'no spaces in key');
    t.deepEqual(_._unpackDescription('KEY 2 a: Value'), {'key-2-a': 'Value'}, 'no spaces in key with multiple spaces');
    t.deepEqual(_._unpackDescription('MAJOR FIRE UPDATE AS AT 11:12PM: Value'), {'major-fire-update-as-at-11:12pm': 'Value'}, 'colon in key');
    t.deepEqual(_._unpackDescription('KEY: Value<br />KEY2: Value2'),
        {'key': 'Value', 'key2': 'Value2'},
        'multiple key values');
    t.deepEqual(_._unpackDescription('KEY: Value  <br>  KEY2: Value 2'),
        {'key': 'Value', 'key2': 'Value 2'},
        'multiple key values with whitespaces');
    t.end();
});

test('cleanGeometry', (t) => {
    t.deepEqual(_._cleanGeometry(null), null, 'null geometry');
    t.deepEqual(_._cleanGeometry({type: 'Point'}), {type: 'Point'}, 'single geometry');
    t.deepEqual(_._cleanGeometry({
        type: 'GeometryCollection',
        geometries: [
            {
                type: 'Point',
                coordinates: [1, 1]
            },
            {
                type: 'Point',
                coordinates: [2, 2]
            }
        ]
    }), {
        type: 'MultiPoint',
        coordinates: [[1, 1], [2, 2]]
    }, 'geometrycollection to multi geometry');

    t.deepEqual(_._cleanGeometry({
        type: 'GeometryCollection',
        geometries: [
            {
                type: 'Point',
                coordinates: [1, 1]
            },
            {
                type: 'Polygon',
                coordinates: [
                    [
                        [2, 2],
                        [2, 2],
                        [2, 2],
                        [2, 2]
                    ]
                ]
            }
        ]
    }), {
        type: 'Point',
        coordinates: [1, 1]
    }, 'geometrycollection with empty polygon');

    t.deepEqual(_._cleanGeometry({
        type: 'GeometryCollection',
        geometries: [
            {
                type: 'Polygon',
                coordinates: [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0],
                    ]
                ]
            },
            {
                type: 'Polygon',
                coordinates: [
                    [
                        [1, 0],
                        [2, 0],
                        [2, 1],
                        [1, 1],
                        [1, 0],
                    ]
                ]
            }
        ]
    }), {
        type: 'MultiPolygon',
        coordinates: [[
            [
                [0, 0],
                [2, 0],
                [2, 1],
                [0, 1],
                [0, 0],
            ]
        ]]
    }, 'geometrycollection with two touching polygons');

    // TODO collection of point, point, polygon
    // TODO collection of point, point, geomCollection (point, point)
    // TODO collection of point, polygon, geomCollection (point, polygon)

    t.end();
});

test('clean', (t) => {
    const geoJSONWithGeometryCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'GeometryCollection',
                    geometries: [
                        {
                            type: 'Point',
                            coordinates: [0, 0]
                        },
                        {
                            type: 'LineString',
                            coordinates: [[0, 0], [1, 1]]
                        }
                    ]
                }
            }
        ]
    };

    const geoJSONWithGeometryCollectionAvoided = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                }
            },
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0], [1, 1]]
                }
            }
        ]
    };

    t.deepEqual(_.clean(geoJSONWithGeometryCollection, {avoidGeometryCollections: false}), geoJSONWithGeometryCollection, 'FeatureCollection with GeometryCollection and avoidGeometryCollections: false');
    t.deepEqual(_.clean(geoJSONWithGeometryCollection, {avoidGeometryCollections: true}), geoJSONWithGeometryCollectionAvoided, 'FeatureCollection with GeometryCollection and avoidGeometryCollections: true');

    t.end();
});
