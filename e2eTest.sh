#!/bin/sh

./bin/nsw-rfs-majorincidents-geojson --pretty-print nsw-rfs-majorincidents.geojson
geojsonhint nsw-rfs-majorincidents.geojson

./bin/nsw-rfs-majorincidents-geojson --pretty-print nsw-rfs-majorincidents-avoidgeometrycollections.geojson
geojsonhint nsw-rfs-majorincidents-avoidgeometrycollections.geojson

./bin/nsw-rfs-majorincidents-geojson --pretty-print nsw-rfs-majorincidents-avoidslivers.geojson
geojsonhint nsw-rfs-majorincidents-avoidslivers.geojson
