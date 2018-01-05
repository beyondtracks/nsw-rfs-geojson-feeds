# nsw-rfs-majorincidents-geojson

The NSW Rural Fire Service (RFS) [publishes a GeoJSON feed of major incidents](http://www.rfs.nsw.gov.au/news-and-media/stay-up-to-date/feeds), this project aims to make that feed more developer friendly.

You can either build this application into your own pipeline or use the hosted URL at https://www.beyondtracks.com/contrib/nsw-rfs-majorincidents.geojson (no service availability guarantees!).

_NSW RFS Current Incidents are © State of New South Wales (NSW Rural Fire Service). For current information go to www.rfs.nsw.gov.au. Licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0)._

# Where is it used?

This pipeline has been built for [www.beyondtracks.com](https://www.beyondtracks.com) to provide information about bush fires nearby bushwalks.

# Features
## Access-Control-Allow-Origin

The upstream feed lacks the Access-Control-Allow-Origin header which means web applications aren't able to use the feed directly. This was reported to the NSW RFS on the 3rd of December 2015, and as of January 2018 the header still isn't present.

The sample crontab file allows you to mirror the RFS feed and serve it with your own HTTP server,  add the Access-Control-Allow-Origin HTTP header.

## Nested GeometryCollections

The upstream feed uses nested GeometryCollections, although allowed by the [GeoJSON spec](https://tools.ietf.org/html/rfc7946), the recommendation is they SHOULD be avoided.

These are converted to flat GeometryCollections when including different Geometry types or a multipart type where possible.

## Coordinate Precision

Although extra coordinate precision can help retain geometry shape even beyond the capture precision, the upstream feed uses 14 decimal places. Practically fire extents or geometry shape won't be more than 10m in accuracy so limiting to 4 decimal places will suffice.

## Overloaded description

The upstream feed overloads properties into the `description` field in a format like `KEY: Value <br />KEY: Value`. These are exploded out to make them easier to read in applications. The original overloaded description is dropped from the output.

## ISO8601 Datetimes

The upstream feed uses dates in the format `3/01/2018 5:20:00 AM` and also `3 Jan 2018 16:20` in local time. These datetimes are converted into ISO8601 datetimes assuming the 'Australia/Sydney' time zone to avoid any ambiguities in interpretation.

## Winding Order

For extra assurances the GeoJSON winding order is enforced with https://github.com/mapbox/geojson-rewind.

# Usage

Install the Node dependencies with:

    yarn install

Run the script with:

    ./bin/nsw-rfs-majorincidents-geojson nsw-rfs-majorincidents.geojson

This will download the upstream feed, process it and save the resulting GeoJSON file at `nsw-rfs-majorincidents.geojson`.

# Warranty

The information in the RFS feed can affect life and property. Although the aim of this project is to make the RFS feed more safe, usable and reliable for data consumers, errors or omissions may be present and/or the upstream supplied data structure may change without any notice causing issues. Use at your own risk.

THIS SOFTWARE IS PROVIDED ``AS IS'' AND WITHOUT ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, WITHOUT LIMITATION, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
