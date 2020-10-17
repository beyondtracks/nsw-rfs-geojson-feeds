const { DateTime } = require('luxon')

module.exports = {
  /**
   * Converts the NSW RFS Hazard Reduction JSON feed to GeoJSON
   *
   * @param {Object} json NSW RFS Hazard Reduction Feed as a JSON Object
   * @returns {Object} GeoJSON Object
   */
  toGeoJSON(json) {
    const self = this

    const features = json.results.map(result => {
      const polygons = result.polygons.map(polygon => {
        return [polygon
          .polygon
          .split('|')
          .map(coordinatePair => {
            return coordinatePair
              .split(';')
              .filter(coordinates => coordinates.length >= 2)
              .map(coordinate => Number(coordinate))
              .reverse()
          })
          .filter(coordinates => coordinates.length)]
      })

      return {
        type: 'Feature',
        id: result.guarReference,
        properties: {
          leadAgency: result.leadAgency,
          supportingAgencies: result.supportingAgencies,
          size: self._cleanSize(result.size),
          title: result.location.replace(/\s*HAZARD REDUCTION\s*$/i, ''), // remove trailing HAZARD REDUCTION from title
          tenure: result.tenure,
          startDate: self._cleanDate(result.startDate),
          endDate: self._cleanDate(result.endDate)
        },
        geometry: {
          type: result.geometryType,
          coordinates: polygons
        }
      }
    })

    return {
      type: 'FeatureCollection',
      features: features
    }
  },

  /*
   * Given an date string like "18/10/2020" return as ISO8601 assuming local time zone of Australia/Sydney
   *
   * @param {String} date A date string in "18/10/2020" format
   * @returns {String} ISO8601 date
   */
  _cleanDate(date) {
    return DateTime.fromFormat(date, 'd/MM/yyyy', { zone: 'Australia/Sydney' }).toISODate()
  },

  /*
   * Given an string like "1.2 ha" return size as a number assuming units in ha
   *
   * @param {String} datetime A size in "1.2 ha" format
   * @returns {number} size as a number
   */
  _cleanSize(size) {
    if (typeof size === 'string') {
      const area = Number(size.replace(/\s*ha\s*$/i, ''))
      if (isNaN(area)) {
        return null
      } else {
        return area
      }
    } else {
      return size
    }
  }
}
