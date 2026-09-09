import appDb from '../config/database.js'
import { Vehicle, VEHICLE_CATEGORIES } from '../models/Vehicle.js'
import availabilityService from './availabilityService.js'

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

  async createVehicle(data) {
    const vehicle = new Vehicle(data)
    return await appDb.createVehicle(vehicle)
  },

  async updateVehicle(id, data) {
    return await appDb.updateVehicle(id, data)
  },

  async updateVehicleStatus(id, status) {
    return await appDb.updateVehicle(id, { status })
  },

  async deleteVehicle(id) {
    return await appDb.deleteVehicle(id)
  },

  async deleteAllVehicles() {
    return await appDb.deleteAllVehicles()
  },
}

export default vehicleService
