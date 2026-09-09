import {
  initDB,
  getAllFromStore,
  getByIdFromStore,
  putInStore,
  deleteFromStore,
} from './db.js'
import { apiUrl } from '../config/api.js'
import { authService } from './authService.js'

const LOCATIONS_STORE = 'locations'

let isInitialized = false

async function ensureDB() {
  if (!isInitialized) {
    await initDB()
    isInitialized = true
  }
}

export const locationService = {
  /**
   * Fetch all locations directly from the persistent backend database (Single Source of Truth)
   */
  async getLocations() {
    await ensureDB()

    try {
      const res = await fetch(apiUrl('/api/locations'))
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.locations)) {
          // Clear stale local locations cache and sync with server authoritative locations
          const existingLocs = await getAllFromStore(LOCATIONS_STORE)
          const serverIdSet = new Set(data.locations.map((l) => String(l.id)))
          for (const loc of existingLocs) {
            if (!serverIdSet.has(String(loc.id))) {
              await deleteFromStore(LOCATIONS_STORE, loc.id).catch(() => {})
            }
          }
          for (const loc of data.locations) {
            await putInStore(LOCATIONS_STORE, loc)
          }
          return data.locations.sort((a, b) => a.name.localeCompare(b.name))
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Failed to fetch locations (Status: ${res.status})`)
      }
    } catch (err) {
      console.warn('[LocationService] Backend query notice:', err.message)
      const localLocations = await getAllFromStore(LOCATIONS_STORE)
      if (localLocations && localLocations.length > 0) {
        return localLocations.sort((a, b) => a.name.localeCompare(b.name))
      }
      throw err
    }
  },

  /**
   * Get single location by ID
   */
  async getLocationById(id) {
    await ensureDB()

    // 1. Try backend
    try {
      const res = await fetch(apiUrl(`/api/locations/${encodeURIComponent(id)}`))
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.location) {
          await putInStore(LOCATIONS_STORE, data.location)
          return data.location
        }
      }
    } catch {
      // ignore network errors
    }

    // 2. Fallback to local store
    return await getByIdFromStore(LOCATIONS_STORE, String(id))
  },

  /**
   * Add a new Bangalore pickup hub to database
   */
  async addLocation(name, zone = 'Other', lat = null, lng = null) {
    await ensureDB()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Location name is required')

    const token = authService.getToken()

    const payload = {
      name: trimmed,
      zone: zone.trim() || 'Other',
      lat: lat !== null && !isNaN(Number(lat)) ? Number(lat) : 12.9716,
      lng: lng !== null && !isNaN(Number(lng)) ? Number(lng) : 77.5946,
      active: true,
    }

    // Send POST request to backend API
    try {
      const res = await fetch(apiUrl('/api/locations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.location) {
          await putInStore(LOCATIONS_STORE, data.location)
          return data.location
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          throw new Error('Unauthorized. Please log in again as admin.')
        }
        throw new Error(errData.message || `Failed to add location (Status: ${res.status})`)
      }
    } catch (err) {
      console.error('[LocationService] Failed to add location to backend:', err)
      throw err
    }
  },

  /**
   * Update a location's name, zone, and coordinates in database
   */
  async updateLocation(id, name, zone, lat, lng, active = true) {
    await ensureDB()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Location name is required')

    const token = authService.getToken()

    const payload = {
      name: trimmed,
      zone: zone ? zone.trim() : undefined,
      lat: lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : undefined,
      lng: lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : undefined,
      active: active !== undefined ? Boolean(active) : undefined,
    }

    // Send PUT request to backend API
    try {
      const res = await fetch(apiUrl(`/api/locations/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.location) {
          await putInStore(LOCATIONS_STORE, data.location)
          return data.location
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          throw new Error('Unauthorized. Please log in again as admin.')
        }
        throw new Error(errData.message || `Failed to update location (Status: ${res.status})`)
      }
    } catch (err) {
      console.error('[LocationService] Failed to update location on backend:', err)
      throw err
    }
  },

  /**
   * Delete a location from backend database and local store
   */
  async deleteLocation(id) {
    await ensureDB()
    const token = authService.getToken()

    // Send DELETE request to backend server
    try {
      const res = await fetch(apiUrl(`/api/locations/${encodeURIComponent(id)}`), {
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
          throw new Error('Unauthorized. Please log in again as admin.')
        }
        if (res.status !== 404) {
          throw new Error(errMessage)
        }
      }
    } catch (err) {
      console.error('[LocationService] Failed to delete location on backend:', err)
      throw err
    }

    // Remove from local IndexedDB cache
    await deleteFromStore(LOCATIONS_STORE, String(id))
    return true
  },
}

export default locationService
