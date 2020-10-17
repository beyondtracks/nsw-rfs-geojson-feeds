const test = require('tape'),
  _ = require('./')

test('cleanProperties', (t) => {
  t.deepEqual(_._cleanProperties({}), {}, 'empty properties')
  t.deepEqual(_._cleanProperties({size: null}), {size: null}, 'null size')
  t.deepEqual(_._cleanProperties({size: 10}), {size: 10}, 'numeric size')
  t.deepEqual(_._cleanProperties({size: '10'}), {size: 10}, 'numeric size as string')
  t.deepEqual(_._cleanProperties({size: '10ha'}), {size: 10}, '10ha')
  t.deepEqual(_._cleanProperties({size: '10 ha'}), {size: 10}, '10 ha')
  t.deepEqual(_._cleanProperties({size: '10.5 ha'}), {size: 10.5}, 'float size')

  t.end()
})

test('uniformType', (t) => {
  t.true(_._uniformType([]), 'empty array')
  t.true(_._uniformType([
    {type: 'Point'}
  ]), 'single item')
  t.true(_._uniformType([
    {type: 'Point'},
    {type: 'Point'}
  ]), 'two items with same type')
  t.false(_._uniformType([
    {type: 'Point'},
    {type: 'Polygon'}
  ]), 'two items with different type')
  t.end()
})

test('flattenGeometries', (t) => {
  t.deepEqual(_._flattenGeometries(), [], 'no argument')

  t.deepEqual(_._flattenGeometries(null), [null], 'empty geometry')

  t.deepEqual(_._flattenGeometries({
    type: 'Point'
  }),
  [{
    type: 'Point'
  }],
  'single item already flat')

  t.deepEqual(_._flattenGeometries({
    type: 'GeometryCollection'
  }),
  [],
  'single empty GeometryCollection')

  t.deepEqual(_._flattenGeometries({
    type: 'GeometryCollection',
    geometries: [{type: 'Point'}]
  }),
  [
    {type: 'Point'}
  ],
  'single level GeometryCollection')

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
  'two level GeometryCollection')

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
  'two level GeometryCollection with siblings')
  t.end()
})

test('cleanPubDate', (t) => {
  t.equal(_._cleanPubDate('3/01/2018 5:20:00 AM'), '2018-01-03T05:20:00+11:00', 'pubDate string AEDT')
  t.equal(_._cleanPubDate('3/06/2018 5:20:00 AM'), '2018-06-03T05:20:00+10:00', 'pubDate string AEST')
  t.end()
})

test('cleanUpdatedDate', (t) => {
  t.equal(_._cleanUpdatedDate('3 Jan 2018 16:20'), '2018-01-03T16:20:00+11:00', 'updated date string AEDT')
  t.equal(_._cleanUpdatedDate('3 Jun 2018 16:20'), '2018-06-03T16:20:00+10:00', 'updated date string AEST')
  t.end()
})

test('extractID', (t) => {
  t.equal(_._extractID(''), null, 'empty guid')
  t.equal(_._extractID(null), null, 'null guid')
  t.equal(_._extractID('foo/bar'), null, 'id not found')
  t.equal(_._extractID('https://incidents.rfs.nsw.gov.au/api/v1/incidents/364897'), 364897, 'id found')
  t.end()
})

test('unpackDescription', (t) => {
  t.deepEqual(_._unpackDescription(), {}, 'undefined arg')
  t.deepEqual(_._unpackDescription(''), {}, 'empty string')
  t.deepEqual(_._unpackDescription('key: Value'), {'key': 'Value'}, 'single key value')
  t.deepEqual(_._unpackDescription('KEY: Value'), {'key': 'Value'}, 'lowercase key')
  t.deepEqual(_._unpackDescription('KEY 2: Value'), {'key-2': 'Value'}, 'no spaces in key')
  t.deepEqual(_._unpackDescription('KEY 2 a: Value'), {'key-2-a': 'Value'}, 'no spaces in key with multiple spaces')
  t.deepEqual(_._unpackDescription('MAJOR FIRE UPDATE AS AT 11:12PM: Value'), {'major-fire-update-as-at-11:12pm': 'Value'}, 'colon in key')
  t.deepEqual(_._unpackDescription('KEY: Value<br />KEY2: Value2'),
    {'key': 'Value', 'key2': 'Value2'},
    'multiple key values')
  t.deepEqual(_._unpackDescription('KEY: Value  <br>  KEY2: Value 2'),
    {'key': 'Value', 'key2': 'Value 2'},
    'multiple key values with whitespaces')
  t.deepEqual(_._unpackDescription('MAJOR FIRE UPDATE AS AT 21 Dec 2019 11:12PM: <a href=\'http://www.rfs.nsw.gov.au/fire-information/major-fire-updates/mfu?id=6025\' target=\'_blank\'> More information</a>'),
    {
      'link': 'http://www.rfs.nsw.gov.au/fire-information/major-fire-updates/mfu?id=6025',
      'link-updated': '2019-12-21T23:12:00+11:00'
    }, 'major fire update link and time')
  t.end()
})

test('cleanGeometry', (t) => {
  t.deepEqual(_._cleanGeometry(null), null, 'null geometry')
  t.deepEqual(_._cleanGeometry({type: 'Point'}), {type: 'Point'}, 'single geometry')
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
  }, 'geometrycollection to multi geometry')

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
  }, 'geometrycollection with empty polygon')

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
  }, 'geometrycollection with two touching polygons')

  t.deepEqual(_._cleanGeometry({
    type: 'GeometryCollection',
    geometries: [
      {
        type: 'Point',
        coordinates: [0, 0]
      },
      {
        type: 'Point',
        coordinates: [1, 1]
      },
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
      }
    ]
  }), {
    type: 'GeometryCollection',
    geometries: [
      {
        type: 'MultiPoint',
        coordinates: [[0, 0], [1, 1]]
      },
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
      }
    ]
  }, 'geometrycollection of point, point, polygon')

  t.deepEqual(_._cleanGeometry({
    type: 'GeometryCollection',
    geometries: [
      {
        type: 'Point',
        coordinates: [0, 0]
      },
      {
        type: 'Point',
        coordinates: [1, 1]
      },
      {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Point',
            coordinates: [2, 2]
          },
          {
            type: 'Point',
            coordinates: [3, 3]
          }
        ]
      }
    ]
  }), {
    type: 'GeometryCollection',
    geometries: [
      {
        type: 'MultiPoint',
        coordinates: [[0, 0], [1, 1], [2, 2], [3, 3]]
      }
    ]
  }, 'geometrycollection of point, point, geomCollection (point, point)')

  t.deepEqual(_._cleanGeometry({
    type: 'GeometryCollection',
    geometries: [
      {
        type: 'Point',
        coordinates: [0, 0]
      },
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
                [1, 0],
                [2, 0],
                [2, 1],
                [1, 1],
                [1, 0],
              ]
            ]
          }
        ]
      }
    ]
  }), {
    type: 'GeometryCollection',
    geometries: [
      {
        type: 'MultiPoint',
        coordinates: [[0, 0], [1, 1]]
      },
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 1],
            [0, 1],
            [0, 0],
          ]
        ]
      }
    ]
  }, 'geometrycollection of point, polygon, geomCollection (point, polygon)')

  t.end()
})

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
  }

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
  }

  const geoJSONToSort = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          guid: 'https://incidents.rfs.nsw.gov.au/api/v1/incidents/3',
          pubDate: '19/12/2019 2:00:00 AM'
        },
        geometry: null
      },
      {
        type: 'Feature',
        properties: {
          guid: 'https://incidents.rfs.nsw.gov.au/api/v1/incidents/2',
          pubDate: '19/12/2019 3:00:00 AM'
        },
        geometry: null
      },
      {
        type: 'Feature',
        properties: {
          guid: 'https://incidents.rfs.nsw.gov.au/api/v1/incidents/1',
          pubDate: '19/12/2019 1:00:00 AM'
        },
        geometry: null
      },
    ]
  }

  t.deepEqual(_.clean(geoJSONWithGeometryCollection, {avoidGeometryCollections: false}), geoJSONWithGeometryCollection, 'FeatureCollection with GeometryCollection and avoidGeometryCollections: false')
  t.deepEqual(_.clean(geoJSONWithGeometryCollection, {avoidGeometryCollections: true}), geoJSONWithGeometryCollectionAvoided, 'FeatureCollection with GeometryCollection and avoidGeometryCollections: true')

  t.deepEqual(_.clean(geoJSONToSort, {sort: 'original'}).features.map(feature => feature.id), [3, 2, 1], 'original sort')
  t.deepEqual(_.clean(geoJSONToSort, {sort: 'guid'}).features.map(feature => feature.id), [1, 2, 3], 'guid sort')
  t.deepEqual(_.clean(geoJSONToSort, {sort: 'pubdate'}).features.map(feature => feature.id), [1, 3, 2], 'pubdate sort')

  t.deepEqual(_.clean({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [150.123456789, -34.123456789]
        }
      }
    ]
  }).features[0].geometry.coordinates, [150.1235, -34.1235], 'limit point precision')

  const coordinates = [
    [
      [150.123456789, -34.123456789],
      [151.123456789, -34.123456789],
      [151.123456789, -33.123456789],
      [150.123456789, -33.123456789],
      [150.123456789, -34.123456789]
    ]
  ]
  t.deepEqual(_.clean({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates
        }
      }
    ]
  }).features[0].geometry.coordinates, coordinates, 'polygon precision unchanged')

  t.end()
})
