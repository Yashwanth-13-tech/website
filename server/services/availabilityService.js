import appDb from '../config/database.js'
import { VehicleUnavailability } from '../models/VehicleUnavailability.js'

/**
 * Availability & Calendar Engine
 * Manages blackout dates, booking conflicts, and vehicle availability math.
 */
export const availabilityService = {
  /**
   * Validates if a vehicle is available for a requested pickup/return date window.
   * Overlap condition formula:
   * (existingStart <= requestedEnd) AND (existingEnd >= requestedStart)
   *
   * @param {number|string} vehicleId
   * @param {string} pickupDate - 'YYYY-MM-DD'
   * @param {string} returnDate - 'YYYY-MM-DD'
   * @returns {Promise<{ available: boolean, reason: string | null, vehicle?: object }>}
   */
  async isVehicleAvailable(vehicleId, pickupDate, returnDate) {
    const vId = Number(vehicleId)
    const vehicle = await appDb.getVehicleById(vId)

    if (!vehicle) {
      return { available: false, reason: 'Vehicle not found' }
    }

    // Check status
    if (['maintenance', 'blocked', 'inactive'].includes(vehicle.status)) {
      return {
        available: false,
        reason: `Vehicle is currently marked as ${vehicle.status}.`,
        vehicle,
      }
    }

    if (!pickupDate || !returnDate) {
      return { available: vehicle.status === 'available', reason: null, vehicle }
    }

    const reqStart = String(pickupDate).split('T')[0]
    const reqEnd = String(returnDate).split('T')[0]

    if (reqStart > reqEnd) {
      return { available: false, reason: 'Return date cannot be earlier than pickup date.', vehicle }
    }

    // 1. Check Unavailability / Blackout Blocks
    const blocks = await appDb.getUnavailabilityBlocks(vId)
    for (const b of blocks) {
      const blockModel = new VehicleUnavailability(b)
      if (blockModel.overlapsWith(reqStart, reqEnd)) {
        return {
          available: false,
          reason: `Vehicle is blocked for ${blockModel.reason.replace('_', ' ')} from ${blockModel.start_date} to ${blockModel.end_date}.`,
          vehicle,
          block: blockModel.toJSON(),
        }
      }
    }

    // 2. Check Confirmed Bookings Overlap
    const bookings = await appDb.getBookingsForVehicle(vId)
    for (const bk of bookings) {
      if (bk.status === 'CANCELLED') continue
      const bStart = String(bk.pickup_date || bk.pickupDate || '').split('T')[0]
      const bEnd = String(bk.return_date || bk.returnDate || '').split('T')[0]

      if (bStart && bEnd && bStart <= reqEnd && bEnd >= reqStart) {
        return {
          available: false,
          reason: `Vehicle has a confirmed booking from ${bStart} to ${bEnd}.`,
          vehicle,
          bookingId: bk.id || bk.booking_id,
        }
      }
    }

    return { available: true, reason: null, vehicle }
  },

  /**
   * Retrieves all blocked / unavailable dates for a vehicle within a specific month/year.
   * Useful for calendar date pickers.
   *
   * @param {number|string} vehicleId
   * @param {number} [month] - 1-12
   * @param {number} [year] - e.g. 2026
   * @returns {Promise<string[]>} array of 'YYYY-MM-DD' strings
   */
  async getUnavailableDates(vehicleId, month = null, year = null) {
    const vId = Number(vehicleId)
    const blocks = await appDb.getUnavailabilityBlocks(vId)
    const bookings = await appDb.getBookingsForVehicle(vId)

    const dateSet = new Set()

    // Add blackout blocks
    for (const b of blocks) {
      const blockModel = new VehicleUnavailability(b)
      const list = blockModel.getDateList()
      for (const d of list) {
        dateSet.add(d)
      }
    }

    // Add confirmed bookings
    for (const bk of bookings) {
      if (bk.status === 'CANCELLED') continue
      const bStart = String(bk.pickup_date || bk.pickupDate || '').split('T')[0]
      const bEnd = String(bk.return_date || bk.returnDate || '').split('T')[0]
      if (bStart && bEnd) {
        const [sy, sm, sd] = bStart.split('-').map(Number)
        const [ey, em, ed] = bEnd.split('-').map(Number)
        if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd) && !isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
          const cur = new Date(Date.UTC(sy, sm - 1, sd))
          const end = new Date(Date.UTC(ey, em - 1, ed))
          while (cur <= end) {
            dateSet.add(cur.toISOString().split('T')[0])
            cur.setUTCDate(cur.getUTCDate() + 1)
          }
        }
      }
    }

    let allDates = Array.from(dateSet).sort()

    // Filter by month/year if specified
    if (month || year) {
      allDates = allDates.filter((d) => {
        const [yStr, mStr] = d.split('-')
        const y = parseInt(yStr, 10)
        const m = parseInt(mStr, 10)

        if (year && y !== Number(year)) return false
        if (month && m !== Number(month)) return false
        return true
      })
    }

    return allDates
  },

  /**
   * Filters vehicles that are available for a given search query window.
   */
  async getAvailableVehicles(searchParams = {}) {
    const allVehicles = await appDb.getVehicles()
    const { pickupDate, returnDate } = searchParams

    if (!pickupDate || !returnDate) {
      return allVehicles.filter((v) => v.status === 'available')
    }

    const availableList = []
    for (const v of allVehicles) {
      const check = await this.isVehicleAvailable(v.id, pickupDate, returnDate)
      if (check.available) {
        availableList.push(v)
      }
    }

    return availableList
  },

  /**
   * Add a maintenance / blackout range block for a vehicle.
   */
  async addVehicleBlock(vehicleId, blockData) {
    const block = new VehicleUnavailability({
      ...blockData,
      vehicle_id: Number(vehicleId),
    })
    return await appDb.createUnavailabilityBlock(block)
  },

  /**
   * Remove a maintenance blackout block by ID.
   */
  async removeVehicleBlock(blockId) {
    return await appDb.deleteUnavailabilityBlock(blockId)
  },
}

export default availabilityService
