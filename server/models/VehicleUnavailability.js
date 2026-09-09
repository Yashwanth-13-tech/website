/**
 * VehicleUnavailability Model
 * Tracks maintenance, service, repairs, and offline blocks for vehicles.
 */

export const UNAVAILABILITY_REASONS = [
  'maintenance',
  'service',
  'accident_repair',
  'reserved_offline',
  'other',
]

export class VehicleUnavailability {
  constructor(data = {}) {
    this.id = data.id ? Number(data.id) : undefined
    this.vehicle_id = Number(data.vehicle_id || data.vehicleId)
    this.start_date = String(data.start_date || data.startDate || '').split('T')[0]
    this.end_date = String(data.end_date || data.endDate || '').split('T')[0]

    const r = String(data.reason || 'other').toLowerCase()
    this.reason = UNAVAILABILITY_REASONS.includes(r) ? r : 'other'
    this.notes = String(data.notes || '').trim()
    this.created_at = data.created_at || data.createdAt || new Date().toISOString()
  }

  // Check if a given requested range overlaps with this block
  // Overlap Formula: (existingStart <= requestedEnd) AND (existingEnd >= requestedStart)
  overlapsWith(reqStart, reqEnd) {
    const s = String(reqStart).split('T')[0]
    const e = String(reqEnd).split('T')[0]
    return this.start_date <= e && this.end_date >= s
  }

  // Generate an array of all individual date strings in this range (YYYY-MM-DD)
  getDateList() {
    const dates = []
    if (!this.start_date || !this.end_date) return dates

    const [sy, sm, sd] = this.start_date.split('-').map(Number)
    const [ey, em, ed] = this.end_date.split('-').map(Number)

    if (isNaN(sy) || isNaN(sm) || isNaN(sd) || isNaN(ey) || isNaN(em) || isNaN(ed)) return dates

    const cur = new Date(Date.UTC(sy, sm - 1, sd))
    const end = new Date(Date.UTC(ey, em - 1, ed))

    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0])
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return dates
  }

  toJSON() {
    return {
      id: this.id,
      vehicle_id: this.vehicle_id,
      start_date: this.start_date,
      end_date: this.end_date,
      reason: this.reason,
      notes: this.notes,
      created_at: this.created_at,
    }
  }
}

export default VehicleUnavailability
