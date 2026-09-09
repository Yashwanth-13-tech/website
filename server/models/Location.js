/**
 * Location Model
 * Represents a physical pickup/drop-off hub in Bangalore with delivery fee and coordinates.
 */

function generateSlug(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export class Location {
  constructor(data = {}) {
    this.id = data.id !== undefined ? (typeof data.id === 'number' ? data.id : String(data.id)) : undefined
    this.name = String(data.name || '').trim()
    this.slug = String(data.slug || generateSlug(this.name) || `loc-${Date.now()}`).toLowerCase()
    this.address = String(data.address || `${this.name}, Bangalore, Karnataka`).trim()
    this.description = String(data.description || `BLR CRUIZ authorized pickup & drop hub at ${this.name}.`).trim()
    this.is_active = data.is_active !== undefined ? Boolean(data.is_active) : (data.active !== undefined ? Boolean(data.active) : true)
    this.pickup_available = data.pickup_available !== undefined ? Boolean(data.pickup_available) : true
    this.return_available = data.return_available !== undefined ? Boolean(data.return_available) : true
    this.delivery_fee = Number(data.delivery_fee !== undefined ? data.delivery_fee : (this.slug.includes('airport') ? 500 : 0))
    this.phone = String(data.phone || '+91 80001 23456')
    this.whatsapp_number = String(data.whatsapp_number || '+91 98765 43210')

    // Coordinates
    let coords = { lat: 12.9716, lng: 77.5946 }
    if (data.coordinates && typeof data.coordinates === 'object') {
      coords = {
        lat: Number(data.coordinates.lat) || 12.9716,
        lng: Number(data.coordinates.lng) || 77.5946,
      }
    } else if (data.lat !== undefined && data.lng !== undefined) {
      coords = {
        lat: Number(data.lat) || 12.9716,
        lng: Number(data.lng) || 77.5946,
      }
    }
    this.coordinates = coords
    this.lat = coords.lat
    this.lng = coords.lng
    this.zone = String(data.zone || 'Central')

    this.created_at = data.created_at || data.createdAt || new Date().toISOString()
    this.updated_at = data.updated_at || data.updatedAt || new Date().toISOString()
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      address: this.address,
      description: this.description,
      is_active: this.is_active,
      active: this.is_active,
      pickup_available: this.pickup_available,
      return_available: this.return_available,
      delivery_fee: this.delivery_fee,
      phone: this.phone,
      whatsapp_number: this.whatsapp_number,
      coordinates: this.coordinates,
      lat: this.lat,
      lng: this.lng,
      zone: this.zone,
      created_at: this.created_at,
      updated_at: this.updated_at,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
    }
  }
}

export default Location
