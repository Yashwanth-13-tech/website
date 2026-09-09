import appDb from '../config/database.js'
import { Location } from '../models/Location.js'

export const locationService = {
  async getActiveLocations() {
    const all = await appDb.getLocations()
    return all.filter((l) => l.is_active || l.active)
  },

  async getAllLocations() {
    return await appDb.getLocations()
  },

  async getLocationBySlugOrId(slugOrId) {
    const all = await appDb.getLocations()
    const target = String(slugOrId).toLowerCase().trim()

    return all.find(
      (l) =>
        String(l.slug).toLowerCase() === target ||
        String(l.id).toLowerCase() === target ||
        String(l.name).toLowerCase() === target
    ) || null
  },

  async createLocation(data) {
    const loc = new Location(data)
    return await appDb.createLocation(loc)
  },

  async updateLocation(id, data) {
    return await appDb.updateLocation(id, data)
  },

  async deleteLocation(id) {
    return await appDb.deleteLocation(id)
  },
}

export default locationService
