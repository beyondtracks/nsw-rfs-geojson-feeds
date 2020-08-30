const defaultOptions = {
}

module.exports = {
  /**
   * Converts the NSW RFS Hazard Reduction JSON feed to GeoJSON
   *
   * @param {Object} json NSW RFS Hazard Reduction Feed as a JSON Object
   * @param {Object} [options]
   * @returns {Object} GeoJSON Object
   */
  toGeoJSON(json, options) {
    const self = this

    options = Object.assign({}, defaultOptions, options)

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
          size: result.size, // fixme parse as numeric
          title: result.location, // fixme parse out HAZARD REDUCTION suffix
          tenure: result.tenure,
          startDate: result.startDate, // fixme parse as ISO date
          endDate: result.endDate // fixme parse as ISO date
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
  }
}
