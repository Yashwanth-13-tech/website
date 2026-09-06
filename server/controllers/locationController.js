import appDb from '../config/database.js'

export const locationController = {
  async getAllLocations(req, res) {
    try {
      const locations = await appDb.getLocations()
      return res.status(200).json({
        success: true,
        count: locations.length,
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

  async getLocationById(req, res) {
    try {
      const { id } = req.params
      const location = await appDb.getLocationById(id)
      if (!location) {
        return res.status(404).json({
          success: false,
          message: `Location with ID ${id} not found.`,
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

  async createLocation(req, res) {
    try {
      const data = req.body || {}
      if (!data.name || !data.name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Location name is required.',
        })
      }

      const newLocation = await appDb.createLocation(data)
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

  async updateLocation(req, res) {
    try {
      const { id } = req.params
      const updatedLocation = await appDb.updateLocation(id, req.body)

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

  async deleteLocation(req, res) {
    try {
      const { id } = req.params
      const deletedLocation = await appDb.deleteLocation(id)

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
