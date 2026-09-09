/**
 * Vehicle Model
 * Represents a fleet vehicle with tiered pricing, specifications, features, and availability flags.
 */

export const VEHICLE_CATEGORIES = [
  'economy',
  'hatchback',
  'sedan',
  'suv',
  'luxury',
  'premium_suv',
  '7_seater',
  'electric',
]

export const VEHICLE_STATUSES = [
  'available',
  'booked',
  'maintenance',
  'blocked',
  'inactive',
]

export class Vehicle {
  constructor(data = {}) {
    this.id = data.id !== undefined ? Number(data.id) : undefined
    this.brand = String(data.brand || '').trim()
    this.model = String(data.model || '').trim()
    this.year = Number(data.year) || new Date().getFullYear()

    // Normalize category
    const cat = String(data.category || 'hatchback').toLowerCase().replace(/\s+/g, '_')
    this.category = VEHICLE_CATEGORIES.includes(cat) ? cat : 'hatchback'

    // Tiered pricing
    const baseDaily = Number(data.price_daily || data.pricePerDay || data.price || 1500)
    this.price_daily = baseDaily
    this.price_weekend = Number(data.price_weekend) || Math.round(baseDaily * 1.15)
    this.price_weekly = Number(data.price_weekly) || Math.round(baseDaily * 0.85)
    this.price_monthly = Number(data.price_monthly) || Math.round(baseDaily * 0.65)
    this.security_deposit = Number(data.security_deposit || data.securityDeposit || 3000)
    this.mileage_limit = Number(data.mileage_limit || data.mileageLimit || 300)
    this.extra_km_rate = Number(data.extra_km_rate || data.extraKmRate || 12.0)

    // Specifications
    this.seats = Number(data.seats) || 5
    this.doors = Number(data.doors) || 4
    this.transmission = String(data.transmission || 'automatic').toLowerCase()
    this.fuel_type = String(data.fuel_type || data.fuel || 'petrol').toLowerCase()
    this.ac = data.ac !== undefined ? Boolean(data.ac) : true

    // Assets & Features
    let featuresList = []
    if (Array.isArray(data.features)) {
      featuresList = data.features
    } else if (typeof data.features === 'string') {
      try {
        featuresList = JSON.parse(data.features)
      } catch {
        featuresList = data.features.split(',').map((f) => f.trim()).filter(Boolean)
      }
    }
    this.features = Array.isArray(featuresList) ? featuresList : []

    let imagesList = []
    if (Array.isArray(data.images) && data.images.length > 0) {
      imagesList = data.images
    } else if (typeof data.images === 'string') {
      try {
        imagesList = JSON.parse(data.images)
      } catch {
        imagesList = [data.images]
      }
    } else if (data.image) {
      imagesList = [data.image]
    }
    this.images = Array.isArray(imagesList) && imagesList.length > 0
      ? imagesList
      : ['https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=1200&q=80']
    this.image = this.images[0]

    let locationsList = []
    if (Array.isArray(data.locations)) {
      locationsList = data.locations
    } else if (typeof data.locations === 'string') {
      try {
        locationsList = JSON.parse(data.locations)
      } catch {
        locationsList = [data.locations]
      }
    }
    this.locations = Array.isArray(locationsList) ? locationsList : []

    // Flags & Status
    const st = String(data.status || (data.available === false ? 'booked' : 'available')).toLowerCase()
    this.status = VEHICLE_STATUSES.includes(st) ? st : 'available'
    this.available = this.status === 'available'
    this.rating = Number(data.rating) || 4.8
    this.review_count = Number(data.review_count || data.reviewCount || 0)
    this.is_featured = Boolean(data.is_featured !== undefined ? data.is_featured : data.popular)
    this.is_popular = Boolean(data.is_popular !== undefined ? data.is_popular : data.popular)
    this.popular = this.is_popular
    this.license_plate = String(data.license_plate || data.licensePlate || '').trim()
    this.description = String(data.description || '').trim()

    this.created_at = data.created_at || data.createdAt || new Date().toISOString()
    this.updated_at = data.updated_at || data.updatedAt || new Date().toISOString()
  }

  // Calculate rental cost based on duration
  calculateCost(days = 1, isWeekend = false) {
    const d = Math.max(Number(days) || 1, 1)
    let rate = this.price_daily
    if (d >= 30) rate = this.price_monthly
    else if (d >= 7) rate = this.price_weekly
    else if (isWeekend) rate = this.price_weekend

    const baseFare = Math.round(rate * d)
    const tax = Math.round(baseFare * 0.05)
    const total = baseFare + tax

    return {
      daily_rate: rate,
      days: d,
      base_fare: baseFare,
      tax,
      deposit: this.security_deposit,
      total,
    }
  }

  toJSON() {
    return {
      id: this.id,
      brand: this.brand,
      model: this.model,
      year: this.year,
      category: this.category,
      price_daily: this.price_daily,
      price_weekend: this.price_weekend,
      price_weekly: this.price_weekly,
      price_monthly: this.price_monthly,
      security_deposit: this.security_deposit,
      mileage_limit: this.mileage_limit,
      extra_km_rate: this.extra_km_rate,
      seats: this.seats,
      doors: this.doors,
      transmission: this.transmission,
      fuel_type: this.fuel_type,
      ac: this.ac,
      features: this.features,
      images: this.images,
      image: this.image,
      locations: this.locations,
      status: this.status,
      available: this.available,
      rating: this.rating,
      review_count: this.review_count,
      is_featured: this.is_featured,
      is_popular: this.is_popular,
      popular: this.is_popular,
      license_plate: this.license_plate,
      description: this.description,
      // Backward-compatible camelCase aliases for existing UI
      pricePerDay: this.price_daily,
      fuel: this.fuel_type,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    }
  }
}

export default Vehicle
