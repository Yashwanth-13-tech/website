import appDb from '../config/database.js'
import { Vehicle, VEHICLE_CATEGORIES } from '../models/Vehicle.js'
import availabilityService from './availabilityService.js'
import supabaseStorage from './supabaseStorage.js'

export const vehicleService = {
  /**
   * Multi-parameter search & filtering with pagination.
   */
  async getVehicles(params = {}) {
    let vehicles = await appDb.getVehicles()

    const {
      category,
      brand,
      transmission,
      fuel_type,
      fuel,
      min_seats,
      max_price,
      featured,
      popular,
      status,
      pickup_date,
      return_date,
      sort = 'id',
      order = 'asc',
      limit = 50,
      offset = 0,
    } = params

    // Category filter
    if (category && category !== 'all' && category !== 'All') {
      const targetCat = String(category).toLowerCase().replace(/\s+/g, '_')
      vehicles = vehicles.filter((v) => v.category === targetCat || v.category === category)
    }

    // Brand filter
    if (brand && brand !== 'all' && brand !== 'All') {
      const b = String(brand).toLowerCase().trim()
      vehicles = vehicles.filter((v) => v.brand.toLowerCase() === b)
    }

    // Transmission filter
    if (transmission && transmission !== 'all') {
      const t = String(transmission).toLowerCase().trim()
      vehicles = vehicles.filter((v) => v.transmission.toLowerCase() === t)
    }

    // Fuel type filter
    const fuelTarget = fuel_type || fuel
    if (fuelTarget && fuelTarget !== 'all') {
      const f = String(fuelTarget).toLowerCase().trim()
      vehicles = vehicles.filter((v) => v.fuel_type.toLowerCase() === f || (v.fuel && v.fuel.toLowerCase() === f))
    }

    // Min seats filter
    if (min_seats) {
      const s = Number(min_seats)
      if (!isNaN(s)) {
        vehicles = vehicles.filter((v) => v.seats >= s)
      }
    }

    // Max price filter
    if (max_price) {
      const p = Number(max_price)
      if (!isNaN(p)) {
        vehicles = vehicles.filter((v) => (v.price_daily || v.pricePerDay) <= p)
      }
    }

    // Featured flag
    if (featured === true || featured === 'true' || featured === '1') {
      vehicles = vehicles.filter((v) => v.is_featured || v.popular)
    }

    // Popular flag
    if (popular === true || popular === 'true' || popular === '1') {
      vehicles = vehicles.filter((v) => v.is_popular || v.popular)
    }

    // Status filter
    if (status) {
      const st = String(status).toLowerCase()
      vehicles = vehicles.filter((v) => v.status === st)
    }

    // Date Availability Window Filter
    if (pickup_date && return_date) {
      const availableList = []
      for (const v of vehicles) {
        const check = await availabilityService.isVehicleAvailable(v.id, pickup_date, return_date)
        if (check.available) {
          availableList.push(v)
        }
      }
      vehicles = availableList
    }

    // Sorting
    const sortField = String(sort).toLowerCase()
    const sortOrder = String(order).toLowerCase() === 'desc' ? -1 : 1

    vehicles.sort((a, b) => {
      let valA = a[sortField] !== undefined ? a[sortField] : a.id
      let valB = b[sortField] !== undefined ? b[sortField] : b.id

      if (sortField === 'price' || sortField === 'price_daily' || sortField === 'priceperday') {
        valA = Number(a.price_daily || a.pricePerDay || 0)
        valB = Number(b.price_daily || b.pricePerDay || 0)
      } else if (sortField === 'rating') {
        valA = Number(a.rating || 0)
        valB = Number(b.rating || 0)
      } else if (sortField === 'year') {
        valA = Number(a.year || 0)
        valB = Number(b.year || 0)
      }

      if (valA < valB) return -1 * sortOrder
      if (valA > valB) return 1 * sortOrder
      return 0
    })

    const total = vehicles.length
    const l = Math.max(parseInt(limit, 10) || 50, 1)
    const o = Math.max(parseInt(offset, 10) || 0, 0)
    const paginated = vehicles.slice(o, o + l)

    return {
      total,
      limit: l,
      offset: o,
      count: paginated.length,
      vehicles: paginated,
      cars: paginated, // backward compatibility
    }
  },

  async getFeaturedVehicles(limit = 8) {
    const all = await appDb.getVehicles()
    const featured = all
      .filter((v) => (v.is_featured || v.popular) && v.status === 'available')
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, Number(limit) || 8)

    return featured
  },

  async getPopularVehicles(limit = 8) {
    const all = await appDb.getVehicles()
    const popular = all
      .filter((v) => (v.is_popular || v.popular) && v.status === 'available')
      .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
      .slice(0, Number(limit) || 8)

    return popular
  },

  async getCategoriesMeta() {
    const all = await appDb.getVehicles()
    const counts = {}

    for (const cat of VEHICLE_CATEGORIES) {
      counts[cat] = {
        category: cat,
        label: cat.replace('_', ' ').toUpperCase(),
        count: 0,
        min_price: null,
      }
    }

    for (const v of all) {
      const c = v.category || 'hatchback'
      if (!counts[c]) {
        counts[c] = {
          category: c,
          label: c.replace('_', ' ').toUpperCase(),
          count: 0,
          min_price: null,
        }
      }
      counts[c].count++
      const price = Number(v.price_daily || v.pricePerDay || 0)
      if (counts[c].min_price === null || price < counts[c].min_price) {
        counts[c].min_price = price
      }
    }

    return Object.values(counts)
  },

  async getVehicleById(id) {
    return await appDb.getVehicleById(id)
  },

  /**
   * Create vehicle: automatically intercepts and uploads any base64 image strings to Supabase Storage
   */
  async createVehicle(data) {
    const payload = { ...data }

    // Intercept and sanitize any inline base64 images
    let rawImages = []
    if (Array.isArray(payload.images) && payload.images.length > 0) {
      rawImages = payload.images
    } else if (payload.image) {
      rawImages = [payload.image]
    }

    if (rawImages.length > 0) {
      const cleanImages = await supabaseStorage.sanitizeAndUploadImages(rawImages)
      payload.images = cleanImages
      payload.image = cleanImages[0] || null
    }

    const vehicle = new Vehicle(payload)
    return await appDb.createVehicle(vehicle)
  },

  /**
   * Update vehicle: handles automatic upload of new base64 images and safe cleanup of replaced old storage objects
   */
  async updateVehicle(id, data) {
    const existing = await appDb.getVehicleById(id)
    if (!existing) return null

    const payload = { ...data }

    // Intercept and sanitize any inline base64 images
    let rawImages = payload.images
    if (rawImages !== undefined) {
      if (Array.isArray(rawImages)) {
        payload.images = await supabaseStorage.sanitizeAndUploadImages(rawImages, id)
        if (payload.images.length > 0) {
          payload.image = payload.images[0]
        }
      }
    } else if (payload.image && supabaseStorage.isDataUrl(payload.image)) {
      const cleanImages = await supabaseStorage.sanitizeAndUploadImages([payload.image], id)
      payload.image = cleanImages[0]
      if (Array.isArray(existing.images) && existing.images.length > 0) {
        payload.images = [cleanImages[0], ...existing.images.slice(1)]
      } else {
        payload.images = [cleanImages[0]]
      }
    }

    const updated = await appDb.updateVehicle(id, payload)
    if (!updated) return null

    // Safe orphan image cleanup (Requirement 13):
    // Compare existing images with updated images and remove deleted Supabase Storage objects
    if (existing.images && updated.images) {
      const oldImages = Array.isArray(existing.images) ? existing.images : [existing.images]
      const newImages = Array.isArray(updated.images) ? updated.images : [updated.images]

      for (const oldUrl of oldImages) {
        if (oldUrl && typeof oldUrl === 'string' && !newImages.includes(oldUrl)) {
          // Check if this was a Supabase stored image before attempting delete
          if (supabaseStorage.extractStoragePath(oldUrl)) {
            supabaseStorage.deleteImage(oldUrl).catch((err) => {
              console.warn(`[VehicleService] Replaced image cleanup notice (${oldUrl}):`, err.message)
            })
          }
        }
      }
    }

    return updated
  },

  async updateVehicleStatus(id, status) {
    return await appDb.updateVehicle(id, { status })
  },

  /**
   * Delete vehicle: deletes database record safely, then cleans up associated Supabase Storage objects
   */
  async deleteVehicle(id) {
    const deleted = await appDb.deleteVehicle(id)
    if (!deleted) return null

    // Safe image deletion for deleted vehicle (Requirement 14)
    const imagesToDelete = Array.isArray(deleted.images)
      ? deleted.images
      : (deleted.image ? [deleted.image] : [])

    for (const imgUrl of imagesToDelete) {
      if (imgUrl && typeof imgUrl === 'string' && supabaseStorage.extractStoragePath(imgUrl)) {
        supabaseStorage.deleteImage(imgUrl).catch((err) => {
          console.warn(`[VehicleService] Deleted vehicle image cleanup notice (${imgUrl}):`, err.message)
        })
      }
    }

    return deleted
  },

  /**
   * Delete all vehicles: deletes all records and cleans up storage objects
   */
  async deleteAllVehicles() {
    const allVehicles = await appDb.getVehicles()
    const result = await appDb.deleteAllVehicles()

    // Clean up images for all deleted vehicles
    for (const v of allVehicles) {
      const imgs = Array.isArray(v.images) ? v.images : (v.image ? [v.image] : [])
      for (const img of imgs) {
        if (img && typeof img === 'string' && supabaseStorage.extractStoragePath(img)) {
          supabaseStorage.deleteImage(img).catch(() => {})
        }
      }
    }

    return result
  },

  /**
   * Migration utility: scans all vehicles in DB and migrates any existing base64 images to Supabase Storage
   */
  async migrateExistingBase64Images() {
    if (!supabaseStorage.isConfigured) {
      console.log('[VehicleService] Supabase Storage not configured. Skipping inline image migration.')
      return { migratedCount: 0, totalVehicles: 0 }
    }

    const vehicles = await appDb.getVehicles()
    let migratedCount = 0

    for (const vehicle of vehicles) {
      let needsMigration = false
      let imagesList = Array.isArray(vehicle.images) ? [...vehicle.images] : []

      if (imagesList.some((img) => supabaseStorage.isDataUrl(img))) {
        needsMigration = true
      }
      if (supabaseStorage.isDataUrl(vehicle.image)) {
        needsMigration = true
      }

      if (needsMigration) {
        console.log(`[VehicleService] Migrating inline base64 images for vehicle #${vehicle.id} (${vehicle.brand} ${vehicle.model})...`)
        const cleanImages = await supabaseStorage.sanitizeAndUploadImages(imagesList, vehicle.id)
        const cleanMainImage = cleanImages[0] || (supabaseStorage.isDataUrl(vehicle.image) ? cleanImages[0] : vehicle.image)

        await appDb.updateVehicle(vehicle.id, {
          images: cleanImages,
          image: cleanMainImage,
        })
        migratedCount++
        console.log(`[VehicleService] Successfully migrated vehicle #${vehicle.id} images to Supabase Storage.`)
      }
    }

    return { migratedCount, totalVehicles: vehicles.length }
  },
}

export default vehicleService
