import appDb from '../config/database.js'

export const vehicleController = {
  async getAllVehicles(req, res) {
    try {
      const cars = await appDb.getVehicles()
      return res.status(200).json({
        success: true,
        count: cars.length,
        engine: appDb.engine,
        cars,
      })
    } catch (err) {
      console.error('[VehicleController getAllVehicles Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch vehicles from database.',
      })
    }
  },

  async getVehicleById(req, res) {
    try {
      const { id } = req.params
      const car = await appDb.getVehicleById(id)
      if (!car) {
        return res.status(404).json({
          success: false,
          message: `Vehicle with ID ${id} not found.`,
        })
      }
      return res.status(200).json({
        success: true,
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

  async createVehicle(req, res) {
    try {
      const data = req.body || {}
      if (!data.brand || !data.model) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle brand and model are required.',
        })
      }

      const newCar = await appDb.createVehicle(data)
      console.log(`[Vehicle Created] ID ${newCar.id}: ${newCar.brand} ${newCar.model} in database (${appDb.engine})`)

      return res.status(201).json({
        success: true,
        message: 'Vehicle added to database successfully.',
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

  async updateVehicle(req, res) {
    try {
      const { id } = req.params
      const updatedCar = await appDb.updateVehicle(id, req.body)

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
        const result = await appDb.deleteAllVehicles()
        return res.status(200).json({
          success: true,
          message: `Successfully deleted all ${result.deletedCount} vehicles from inventory.`,
          deletedCount: result.deletedCount,
          cars: [],
        })
      }

      const deletedCar = await appDb.deleteVehicle(id)
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

  async deleteAllVehicles(req, res) {
    try {
      const result = await appDb.deleteAllVehicles()
      console.log(`[Vehicles Deleted All] Removed all ${result.deletedCount} vehicles from database (${appDb.engine})`)

      return res.status(200).json({
        success: true,
        message: `Successfully deleted all ${result.deletedCount} vehicles from inventory.`,
        deletedCount: result.deletedCount,
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

  async resetVehicles(req, res) {
    try {
      const result = await appDb.resetVehicles()
      return res.status(200).json({
        success: true,
        message: 'Car inventory reset to 0 vehicles in database.',
        deletedCount: result.deletedCount,
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

  async syncVehicles(req, res) {
    try {
      const { cars = [] } = req.body || {}
      if (!Array.isArray(cars) || cars.length === 0) {
        const allCars = await appDb.getVehicles()
        return res.status(200).json({
          success: true,
          cars: allCars,
        })
      }

      const currentCars = await appDb.getVehicles()
      let restoredCount = 0
      for (const clientCar of cars) {
        if (!clientCar || !clientCar.brand || !clientCar.model) continue
        const exists = currentCars.some((c) => String(c.id) === String(clientCar.id))
        if (!exists) {
          await appDb.createVehicle(clientCar)
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
