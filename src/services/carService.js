import {
  initDB,
  getAllFromStore,
  getByIdFromStore,
  putInStore,
  deleteFromStore,
  resetCarsStore,
} from './db.js'
import { apiUrl } from '../config/api.js'
import { authService } from './authService.js'

let isInitialized = false

async function ensureDB() {
  if (!isInitialized) {
    await initDB()
    isInitialized = true
  }
}

export const carService = {
  /**
   * Fetch all cars directly from the persistent backend database (Single Source of Truth)
   */
  async getCars() {
    await ensureDB()

    try {
      const res = await fetch(apiUrl('/api/cars'))
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.cars)) {
          // Synchronize local cache with the authoritative server fleet
          await resetCarsStore()
          for (const car of data.cars) {
            await putInStore('cars', car)
          }
          return data.cars.sort((a, b) => Number(a.id) - Number(b.id))
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Failed to fetch vehicles (Status: ${res.status})`)
      }
    } catch (err) {
      console.warn('[CarService] Backend query notice:', err.message)
      const localCars = await getAllFromStore('cars')
      if (localCars && localCars.length > 0) {
        return localCars.sort((a, b) => Number(a.id) - Number(b.id))
      }
      throw err
    }
  },

  /**
   * Get single car by ID
   */
  async getCarById(id) {
    await ensureDB()
    const numericId = Number(id)
    const carId = isNaN(numericId) ? id : numericId

    // 1. Try backend
    try {
      const res = await fetch(apiUrl(`/api/cars/${encodeURIComponent(id)}`))
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.car) {
          await putInStore('cars', data.car)
          return data.car
        }
      }
    } catch {
      // ignore network errors
    }

    // 2. Fallback
    return await getByIdFromStore('cars', carId)
  },

  /**
   * Add a new vehicle to inventory
   */
  async addCar(carData) {
    await ensureDB()
    const token = authService.getToken()

    // Clear any previous deletion record for this vehicle if re-adding
    if (carData.id) {
      await deleteFromStore('deleted_records', String(carData.id)).catch(() => {})
    }

    // Send POST request to backend API
    try {
      const res = await fetch(apiUrl('/api/cars'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(carData),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.car) {
          await deleteFromStore('deleted_records', String(data.car.id)).catch(() => {})
          await putInStore('cars', data.car)
          return data.car
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          throw new Error('Unauthorized. Please log in again to add vehicles.')
        }
        throw new Error(errData.message || `Failed to add vehicle (Status: ${res.status})`)
      }
    } catch (err) {
      console.error('[CarService] Failed to add vehicle to backend:', err)
      throw err
    }
  },

  /**
   * Update an existing vehicle
   */
  async updateCar(id, updateData) {
    await ensureDB()
    const numericId = Number(id)
    const carId = isNaN(numericId) ? id : numericId
    const token = authService.getToken()

    // Send PUT request to backend API
    try {
      const res = await fetch(apiUrl(`/api/cars/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updateData),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.car) {
          await putInStore('cars', data.car)
          return data.car
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          throw new Error('Unauthorized. Please log in again to update vehicles.')
        }
        throw new Error(errData.message || `Failed to update vehicle (Status: ${res.status})`)
      }
    } catch (err) {
      console.error('[CarService] Failed to update vehicle on backend:', err)
      throw err
    }
  },

  /**
   * Permanently delete a vehicle from backend inventory and local cache
   */
  async deleteCar(id) {
    await ensureDB()
    const numericId = Number(id)
    const carId = isNaN(numericId) ? id : numericId
    const token = authService.getToken()

    // 1. Send DELETE request to backend server
    try {
      const res = await fetch(apiUrl(`/api/cars/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        let errMessage = `Server returned HTTP ${res.status}`
        try {
          const errData = await res.json()
          if (errData.message) errMessage = errData.message
        } catch {
          // ignore
        }
        if (res.status === 401) {
          throw new Error('Unauthorized. Please log in again to delete vehicles.')
        }
        if (res.status !== 404) {
          throw new Error(errMessage)
        }
      }
    } catch (err) {
      console.error('[CarService] Failed to delete vehicle on backend:', err)
      throw err
    }

    // 2. Record tombstone in deleted_records to prevent resurrecting during sync
    await putInStore('deleted_records', { id: String(id), timestamp: Date.now() })

    // 3. Permanently remove from local IndexedDB cache
    await deleteFromStore('cars', carId)
    return true
  },

  /**
   * Toggle availability status of a car (Available <-> Booked)
   */
  async toggleAvailability(id) {
    const car = await this.getCarById(id)
    if (!car) throw new Error('Car not found')
    return await this.updateCar(id, { available: !car.available })
  },

  /**
   * Toggle popular/featured status
   */
  async togglePopular(id) {
    const car = await this.getCarById(id)
    if (!car) throw new Error('Car not found')
    return await this.updateCar(id, { popular: !car.popular })
  },

  /**
   * Permanently delete all vehicles from backend database and local store
   */
  async deleteAllCars() {
    await ensureDB()
    const token = authService.getToken()

    try {
      const res = await fetch(apiUrl('/api/cars/all'), {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        let errMessage = `Server returned HTTP ${res.status}`
        try {
          const errData = await res.json()
          if (errData.message) errMessage = errData.message
        } catch {}
        if (res.status === 401) {
          throw new Error('Unauthorized. Please log in again to delete vehicles.')
        }
        throw new Error(errMessage)
      }

      const data = await res.json()
      await resetCarsStore()
      return { success: true, deletedCount: data.deletedCount || 0 }
    } catch (err) {
      console.error('[CarService] Failed to delete all vehicles:', err)
      throw err
    }
  },

  /**
   * Reset database back to default 0 cars
   */
  async resetToDefaults() {
    return await this.deleteAllCars()
  },
}

export default carService
