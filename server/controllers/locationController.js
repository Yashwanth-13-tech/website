import appDb from '../config/database.js'
import locationService from '../services/locationService.js'

export const locationController = {
  /**
   * GET /api/locations
   * Returns active locations for public booking and pickers.
   * If include_inactive=true, returns all locations.
   */
  async getAllLocations(req, res) {
    try {
      const includeInactive = req.query.include_inactive === 'true' || req.query.all === 'true'
      const locations = includeInactive
        ? await locationService.getAllLocations()
        : await locationService.getActiveLocations()

      return res.status(200).json({
        success: true,
        count: locations.length,
        engine: appDb.engine,
        locations,
      })
    } catch (err) {
      console.error('[LocationController getAllLocations Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch pickup locations.',
      })
    }
  },

  /**
   * GET /api/locations/all
   * Admin view: Returns all locations including inactive.
   */
  async getAllLocationsAdmin(req, res) {
    try {
      const locations = await locationService.getAllLocations()
      return res.status(200).json({
        success: true,
        count: locations.length,
        engine: appDb.engine,
        locations,
      })
    } catch (err) {
      console.error('[LocationController getAllLocationsAdmin Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch all locations.',
      })
    }
  },

  /**
   * GET /api/locations/:slug (or :id)
   */
  async getLocationById(req, res) {
    try {
      const { id, slug } = req.params
      const target = slug || id
      const location = await locationService.getLocationBySlugOrId(target)

      if (!location) {
        return res.status(404).json({
          success: false,
          message: `Location '${target}' not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        location,
      })
    } catch (err) {
      console.error('[LocationController getLocationById Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch location.',
      })
    }
  },

  /**
   * POST /api/locations
   */
  async createLocation(req, res) {
    try {
      const data = req.body || {}
      if (!data.name || !data.name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Location name is required.',
        })
      }

      const newLocation = await locationService.createLocation(data)
      console.log(`[Location Created] ID ${newLocation.id}: ${newLocation.name} in database (${appDb.engine})`)

      return res.status(201).json({
        success: true,
        message: 'Location added to database successfully.',
        location: newLocation,
      })
    } catch (err) {
      console.error('[LocationController createLocation Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to add location to database.',
      })
    }
  },

  /**
   * PUT /api/locations/:id
   */
  async updateLocation(req, res) {
    try {
      const { id } = req.params
      const updatedLocation = await locationService.updateLocation(id, req.body)

      if (!updatedLocation) {
        return res.status(404).json({
          success: false,
          message: `Location with ID ${id} not found.`,
        })
      }

      console.log(`[Location Updated] ID ${id}: ${updatedLocation.name} in database (${appDb.engine})`)

      return res.status(200).json({
        success: true,
        message: 'Location updated successfully.',
        location: updatedLocation,
      })
    } catch (err) {
      console.error('[LocationController updateLocation Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update location in database.',
      })
    }
  },

  /**
   * DELETE /api/locations/:id
   */
  async deleteLocation(req, res) {
    try {
      const { id } = req.params
      const deletedLocation = await locationService.deleteLocation(id)

      if (!deletedLocation) {
        return res.status(404).json({
          success: false,
          message: `Location with ID ${id} not found or already deleted.`,
        })
      }

      console.log(`[Location Deleted] ID ${id}: ${deletedLocation.name} from database (${appDb.engine})`)

      return res.status(200).json({
        success: true,
        message: `Location "${deletedLocation.name}" permanently deleted from database.`,
        deletedId: id,
        location: deletedLocation,
      })
    } catch (err) {
      console.error('[LocationController deleteLocation Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete location from database.',
      })
    }
  },
}

export default locationController
