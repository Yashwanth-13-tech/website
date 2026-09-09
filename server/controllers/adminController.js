import appDb from '../config/database.js'
import vehicleService from '../services/vehicleService.js'
import locationService from '../services/locationService.js'
import availabilityService from '../services/availabilityService.js'

export const adminController = {
  /**
   * GET /api/admin/stats
   * Comprehensive summary stats for Admin Dashboard
   */
  async getDashboardStats(req, res) {
    try {
      const counts = await appDb.getCounts()
      const allVehicles = await appDb.getVehicles()
      const allLocations = await appDb.getLocations()

      const statusCounts = {
        available: 0,
        booked: 0,
        maintenance: 0,
        inactive: 0,
      }

      for (const v of allVehicles) {
        const s = v.status || 'available'
        if (statusCounts[s] !== undefined) {
          statusCounts[s]++
        } else {
          statusCounts[s] = 1
        }
      }

      return res.status(200).json({
        success: true,
        engine: appDb.engine,
        stats: {
          total_vehicles: counts.vehicles,
          total_locations: counts.locations,
          total_inquiries: counts.inquiries,
          total_bookings: counts.bookings,
          active_locations: allLocations.filter((l) => l.is_active).length,
          vehicles_by_status: statusCounts,
        },
      })
    } catch (err) {
      console.error('[AdminController getDashboardStats Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch admin stats.',
      })
    }
  },

  /**
   * GET /api/admin/vehicles
   */
  async getVehicles(req, res) {
    try {
      const result = await vehicleService.getVehicles({ ...req.query, limit: req.query.limit || 200 })
      return res.status(200).json({
        success: true,
        engine: appDb.engine,
        ...result,
      })
    } catch (err) {
      console.error('[AdminController getVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch vehicles for admin.',
      })
    }
  },

  /**
   * POST /api/admin/vehicles
   */
  async createVehicle(req, res) {
    try {
      const data = req.body || {}
      if (!data.brand || !data.model) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle brand and model are required.',
        })
      }

      const vehicle = await vehicleService.createVehicle(data)
      return res.status(201).json({
        success: true,
        message: 'Vehicle created successfully in database.',
        vehicle,
        car: vehicle,
      })
    } catch (err) {
      console.error('[AdminController createVehicle Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to create vehicle.',
      })
    }
  },

  /**
   * PUT /api/admin/vehicles/:id
   */
  async updateVehicle(req, res) {
    try {
      const { id } = req.params
      const vehicle = await vehicleService.updateVehicle(id, req.body)
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Vehicle updated successfully.',
        vehicle,
        car: vehicle,
      })
    } catch (err) {
      console.error('[AdminController updateVehicle Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update vehicle.',
      })
    }
  },

  /**
   * PATCH /api/admin/vehicles/:id/status
   */
  async patchVehicleStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body || {}
      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required.',
        })
      }

      const vehicle = await vehicleService.updateVehicleStatus(id, status)
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: `Vehicle status changed to '${status}'.`,
        vehicle,
        car: vehicle,
      })
    } catch (err) {
      console.error('[AdminController patchVehicleStatus Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to patch vehicle status.',
      })
    }
  },

  /**
   * DELETE /api/admin/vehicles/:id
   */
  async deleteVehicle(req, res) {
    try {
      const { id } = req.params
      if (id === 'all') {
        const result = await vehicleService.deleteAllVehicles()
        return res.status(200).json({
          success: true,
          message: `Deleted all ${result.deletedCount} vehicles.`,
          deletedCount: result.deletedCount,
          vehicles: [],
          cars: [],
        })
      }

      const vehicle = await vehicleService.deleteVehicle(id)
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: `Vehicle "${vehicle.brand} ${vehicle.model}" permanently deleted.`,
        vehicle,
        car: vehicle,
      })
    } catch (err) {
      console.error('[AdminController deleteVehicle Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete vehicle.',
      })
    }
  },

  /**
   * DELETE /api/admin/vehicles/all
   */
  async deleteAllVehicles(req, res) {
    try {
      const result = await vehicleService.deleteAllVehicles()
      return res.status(200).json({
        success: true,
        message: `Deleted all ${result.deletedCount} vehicles.`,
        deletedCount: result.deletedCount,
        vehicles: [],
        cars: [],
      })
    } catch (err) {
      console.error('[AdminController deleteAllVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete all vehicles.',
      })
    }
  },

  /**
   * GET /api/admin/vehicles/:id/blocks
   */
  async getBlocks(req, res) {
    try {
      const { id } = req.params
      const blocks = await appDb.getUnavailabilityBlocks(id)
      return res.status(200).json({
        success: true,
        vehicle_id: Number(id),
        count: blocks.length,
        blocks,
      })
    } catch (err) {
      console.error('[AdminController getBlocks Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch blocks.',
      })
    }
  },

  /**
   * POST /api/admin/vehicles/:id/block
   */
  async addBlock(req, res) {
    try {
      const { id } = req.params
      const { start_date, end_date, reason, notes } = req.body || {}

      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'start_date and end_date are required (YYYY-MM-DD).',
        })
      }

      const block = await availabilityService.addVehicleBlock(id, {
        start_date,
        end_date,
        reason: reason || 'maintenance',
        notes: notes || '',
      })

      return res.status(201).json({
        success: true,
        message: 'Unavailability block created.',
        block,
      })
    } catch (err) {
      console.error('[AdminController addBlock Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to create block.',
      })
    }
  },

  /**
   * DELETE /api/admin/vehicles/blocks/:blockId
   */
  async deleteBlock(req, res) {
    try {
      const { blockId } = req.params
      const deleted = await availabilityService.removeVehicleBlock(blockId)
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `Block ${blockId} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Block removed.',
        block: deleted,
      })
    } catch (err) {
      console.error('[AdminController deleteBlock Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to remove block.',
      })
    }
  },

  /**
   * GET /api/admin/locations
   */
  async getLocations(req, res) {
    try {
      const locations = await locationService.getAllLocations()
      return res.status(200).json({
        success: true,
        count: locations.length,
        locations,
      })
    } catch (err) {
      console.error('[AdminController getLocations Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch locations for admin.',
      })
    }
  },

  /**
   * POST /api/admin/locations
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

      const location = await locationService.createLocation(data)
      return res.status(201).json({
        success: true,
        message: 'Location created successfully.',
        location,
      })
    } catch (err) {
      console.error('[AdminController createLocation Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to create location.',
      })
    }
  },

  /**
   * PUT /api/admin/locations/:id
   */
  async updateLocation(req, res) {
    try {
      const { id } = req.params
      const location = await locationService.updateLocation(id, req.body)
      if (!location) {
        return res.status(404).json({
          success: false,
          message: `Location with ID ${id} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Location updated successfully.',
        location,
      })
    } catch (err) {
      console.error('[AdminController updateLocation Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update location.',
      })
    }
  },

  /**
   * DELETE /api/admin/locations/:id
   */
  async deleteLocation(req, res) {
    try {
      const { id } = req.params
      const location = await locationService.deleteLocation(id)
      if (!location) {
        return res.status(404).json({
          success: false,
          message: `Location with ID ${id} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: `Location "${location.name}" permanently deleted.`,
        location,
      })
    } catch (err) {
      console.error('[AdminController deleteLocation Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete location.',
      })
    }
  },
}

export default adminController
