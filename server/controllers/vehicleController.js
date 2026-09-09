import appDb from '../config/database.js'
import vehicleService from '../services/vehicleService.js'
import availabilityService from '../services/availabilityService.js'

export const vehicleController = {
  /**
   * GET /api/vehicles (and /api/cars)
   * Supports multi-param filtering, sorting, pagination, and date availability search.
   */
  async getAllVehicles(req, res) {
    try {
      const result = await vehicleService.getVehicles(req.query)
      return res.status(200).json({
        success: true,
        engine: appDb.engine,
        ...result,
      })
    } catch (err) {
      console.error('[VehicleController getAllVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch vehicles from database.',
      })
    }
  },

  /**
   * GET /api/vehicles/featured
   */
  async getFeaturedVehicles(req, res) {
    try {
      const limit = req.query.limit || 8
      const featured = await vehicleService.getFeaturedVehicles(limit)
      return res.status(200).json({
        success: true,
        count: featured.length,
        vehicles: featured,
        cars: featured,
      })
    } catch (err) {
      console.error('[VehicleController getFeaturedVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch featured vehicles.',
      })
    }
  },

  /**
   * GET /api/vehicles/popular
   */
  async getPopularVehicles(req, res) {
    try {
      const limit = req.query.limit || 8
      const popular = await vehicleService.getPopularVehicles(limit)
      return res.status(200).json({
        success: true,
        count: popular.length,
        vehicles: popular,
        cars: popular,
      })
    } catch (err) {
      console.error('[VehicleController getPopularVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch popular vehicles.',
      })
    }
  },

  /**
   * GET /api/vehicles/availability
   */
  async getAvailableVehicles(req, res) {
    try {
      const pickupDate = req.query.pickup_date || req.query.pickupDate
      const returnDate = req.query.return_date || req.query.returnDate

      const result = await vehicleService.getVehicles({
        ...req.query,
        pickup_date: pickupDate,
        return_date: returnDate,
        status: req.query.status || 'available',
      })

      return res.status(200).json({
        success: true,
        ...result,
      })
    } catch (err) {
      console.error('[VehicleController getAvailableVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to search available vehicles.',
      })
    }
  },

  /**
   * GET /api/vehicles/meta/categories
   */
  async getCategoriesMeta(req, res) {
    try {
      const categories = await vehicleService.getCategoriesMeta()
      return res.status(200).json({
        success: true,
        categories,
      })
    } catch (err) {
      console.error('[VehicleController getCategoriesMeta Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch category metadata.',
      })
    }
  },

  /**
   * GET /api/vehicles/:id
   */
  async getVehicleById(req, res) {
    try {
      const { id } = req.params
      const car = await vehicleService.getVehicleById(id)
      if (!car) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found.`,
        })
      }
      return res.status(200).json({
        success: true,
        vehicle: car,
        car,
      })
    } catch (err) {
      console.error('[VehicleController getVehicleById Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch vehicle details.',
      })
    }
  },

  /**
   * GET /api/vehicles/:id/unavailable-dates
   */
  async getUnavailableDates(req, res) {
    try {
      const { id } = req.params
      const { month, year } = req.query
      const dates = await availabilityService.getUnavailableDates(id, month, year)
      return res.status(200).json({
        success: true,
        vehicle_id: Number(id),
        unavailable_dates: dates,
      })
    } catch (err) {
      console.error('[VehicleController getUnavailableDates Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch vehicle unavailable dates.',
      })
    }
  },

  /**
   * GET /api/vehicles/:id/availability
   */
  async checkAvailability(req, res) {
    try {
      const { id } = req.params
      const pickupDate = req.query.pickup_date || req.query.pickupDate
      const returnDate = req.query.return_date || req.query.returnDate

      const check = await availabilityService.isVehicleAvailable(id, pickupDate, returnDate)
      return res.status(200).json({
        success: true,
        vehicle_id: Number(id),
        ...check,
      })
    } catch (err) {
      console.error('[VehicleController checkAvailability Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to check vehicle availability.',
      })
    }
  },

  /**
   * POST /api/vehicles (and /api/cars)
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

      const newCar = await vehicleService.createVehicle(data)
      console.log(`[Vehicle Created] ID ${newCar.id}: ${newCar.brand} ${newCar.model} in database (${appDb.engine})`)

      return res.status(201).json({
        success: true,
        message: 'Vehicle added to database successfully.',
        vehicle: newCar,
        car: newCar,
      })
    } catch (err) {
      console.error('[VehicleController createVehicle Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to add vehicle to database.',
      })
    }
  },

  /**
   * PUT /api/vehicles/:id (and /api/cars/:id)
   */
  async updateVehicle(req, res) {
    try {
      const { id } = req.params
      const updatedCar = await vehicleService.updateVehicle(id, req.body)

      if (!updatedCar) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found.`,
        })
      }

      console.log(`[Vehicle Updated] ID ${id}: ${updatedCar.brand} ${updatedCar.model} in database (${appDb.engine})`)

      return res.status(200).json({
        success: true,
        message: 'Vehicle updated successfully.',
        vehicle: updatedCar,
        car: updatedCar,
      })
    } catch (err) {
      console.error('[VehicleController updateVehicle Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update vehicle in database.',
      })
    }
  },

  /**
   * PATCH /api/vehicles/:id/status
   */
  async updateVehicleStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body || {}
      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status field is required (available, booked, maintenance, inactive).',
        })
      }

      const updated = await vehicleService.updateVehicleStatus(id, status)
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: `Vehicle status updated to '${status}'.`,
        vehicle: updated,
        car: updated,
      })
    } catch (err) {
      console.error('[VehicleController updateVehicleStatus Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update vehicle status.',
      })
    }
  },

  /**
   * POST /api/vehicles/:id/block
   */
  async addUnavailabilityBlock(req, res) {
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
        message: 'Vehicle unavailability / maintenance block added successfully.',
        block,
      })
    } catch (err) {
      console.error('[VehicleController addUnavailabilityBlock Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to add unavailability block.',
      })
    }
  },

  /**
   * GET /api/vehicles/:id/blocks
   */
  async getUnavailabilityBlocks(req, res) {
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
      console.error('[VehicleController getUnavailabilityBlocks Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch unavailability blocks.',
      })
    }
  },

  /**
   * DELETE /api/vehicles/blocks/:blockId
   */
  async deleteUnavailabilityBlock(req, res) {
    try {
      const { blockId } = req.params
      const deleted = await availabilityService.removeVehicleBlock(blockId)
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `Unavailability block ${blockId} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Unavailability block removed successfully.',
        block: deleted,
      })
    } catch (err) {
      console.error('[VehicleController deleteUnavailabilityBlock Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to remove unavailability block.',
      })
    }
  },

  /**
   * DELETE /api/vehicles/:id (and /api/cars/:id)
   */
  async deleteVehicle(req, res) {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle ID is required.',
        })
      }

      if (id === 'all') {
        const result = await vehicleService.deleteAllVehicles()
        return res.status(200).json({
          success: true,
          message: `Successfully deleted all ${result.deletedCount} vehicles from inventory.`,
          deletedCount: result.deletedCount,
          vehicles: [],
          cars: [],
        })
      }

      const deletedCar = await vehicleService.deleteVehicle(id)
      if (!deletedCar) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found or already deleted.`,
        })
      }

      console.log(`[Vehicle Deleted] ID ${id}: ${deletedCar.brand} ${deletedCar.model} from database (${appDb.engine})`)

      return res.status(200).json({
        success: true,
        message: `Vehicle "${deletedCar.brand} ${deletedCar.model}" permanently deleted from database.`,
        deletedId: id,
        vehicle: deletedCar,
        car: deletedCar,
      })
    } catch (err) {
      console.error('[VehicleController deleteVehicle Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete vehicle from database.',
      })
    }
  },

  /**
   * DELETE /api/vehicles/all (and /api/cars/all)
   */
  async deleteAllVehicles(req, res) {
    try {
      const result = await vehicleService.deleteAllVehicles()
      console.log(`[Vehicles Deleted All] Removed all ${result.deletedCount} vehicles from database (${appDb.engine})`)

      return res.status(200).json({
        success: true,
        message: `Successfully deleted all ${result.deletedCount} vehicles from inventory.`,
        deletedCount: result.deletedCount,
        vehicles: [],
        cars: [],
      })
    } catch (err) {
      console.error('[VehicleController deleteAllVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete all vehicles from database.',
      })
    }
  },

  /**
   * POST /api/vehicles/reset (and /api/cars/reset)
   */
  async resetVehicles(req, res) {
    try {
      const result = await vehicleService.deleteAllVehicles()
      return res.status(200).json({
        success: true,
        message: 'Car inventory reset to 0 vehicles in database.',
        deletedCount: result.deletedCount,
        vehicles: [],
        cars: [],
      })
    } catch (err) {
      console.error('[VehicleController resetVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to reset vehicle inventory.',
      })
    }
  },

  /**
   * POST /api/vehicles/sync (and /api/cars/sync)
   */
  async syncVehicles(req, res) {
    try {
      const { cars = [], vehicles = [] } = req.body || {}
      const inputList = vehicles.length > 0 ? vehicles : cars

      if (!Array.isArray(inputList) || inputList.length === 0) {
        const allCars = await appDb.getVehicles()
        return res.status(200).json({
          success: true,
          count: allCars.length,
          vehicles: allCars,
          cars: allCars,
        })
      }

      const currentCars = await appDb.getVehicles()
      let restoredCount = 0
      for (const clientCar of inputList) {
        if (!clientCar || !clientCar.brand || !clientCar.model) continue
        const exists = currentCars.some((c) => String(c.id) === String(clientCar.id))
        if (!exists) {
          await vehicleService.createVehicle(clientCar)
          restoredCount++
        }
      }

      const updatedCars = await appDb.getVehicles()
      if (restoredCount > 0) {
        console.log(`[Vehicles SYNC] Restored ${restoredCount} vehicle(s) into database (${appDb.engine})`)
      }

      return res.status(200).json({
        success: true,
        restoredCount,
        count: updatedCars.length,
        vehicles: updatedCars,
        cars: updatedCars,
      })
    } catch (err) {
      console.error('[VehicleController syncVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Vehicle sync failed.',
      })
    }
  },
}

export default vehicleController
