#!/bin/sh

mkdir -p output

echo "Test 1: download and process major incidents"
./bin/nsw-rfs-majorincidents-geojson --pretty-print output/nsw-rfs-majorincidents.geojson
geojsonhint output/nsw-rfs-majorincidents.geojson

echo "Test 2: download and process major incidents --avoid-geometrycollections"
./bin/nsw-rfs-majorincidents-geojson --pretty-print --avoid-geometrycollections output/nsw-rfs-majorincidents-avoidgeometrycollections.geojson
geojsonhint output/nsw-rfs-majorincidents-avoidgeometrycollections.geojson

echo "Test 3: download and process major incidents --avoid-slivers"
./bin/nsw-rfs-majorincidents-geojson --pretty-print --avoid-slivers output/nsw-rfs-majorincidents-avoidslivers.geojson
geojsonhint output/nsw-rfs-majorincidents-avoidslivers.geojson

echo "Test 4: download and process hazard reduction"
./bin/nsw-rfs-hazardreduction-geojson --pretty-print output/nsw-rfs-hazardreduction.geojson
geojsonhint output/nsw-rfs-hazardreduction.geojson

echo "Test 5: input fixture hazard reduction"
./bin/nsw-rfs-hazardreduction-geojson --pretty-print test/fixtures/input/hr.json - | diff test/fixtures/output/hr.geojson -

