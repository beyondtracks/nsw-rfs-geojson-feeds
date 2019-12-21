# 2.6.0

* Attempt to parse out the major fire update link and insert it as the link as this is more useful. This also adds a new property 'link-updated` which contains the time contained in the "MAJOR FIRE UPDATE AS AT...".

# 2.5.0

* `--sort=original|guid|pubdate` option to sort features.
* `guid` is promoted to a GeoJSON Feature `id`.

# 2.4.1

* Fix an issue in description parsing where the key contained a `:`, "MAJOR FIRE UPDATE AS AT...".

# 2.4.0

* `--avoid-geometrycollections` to explode GeometryCollections out into mulitple Features.
* `--avoid-slivers` to remove slivers in Polygons.
* Update @mapbox/geojson-rewind to fix issue rewinding Polygons within GeometryCollections.
* Try to avoid internal borders by unioning Polygons.
* Use eslint for code linting.

# 2.3.0

* `--pretty-print` option added.

# 2.2.1

* Fix output to stdout support.

# 2.2.0

* Drop polygons with 0 area
* Support pre-downloaded input
* Disable coordinate precision limit since it created invalid polygons

# 2.1.1

* Fix schema trailing space

# 2.1.0

* Remove titles from schema
* Sort features

# 2.0.0

* Drop identifiers and include JSON schema
* Changes to the properties schema


