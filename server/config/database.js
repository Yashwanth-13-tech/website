import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ----------------------------------------------------------------------------
// Default Bangalore Pickup Hubs (Initial seed if locations table is empty)
// ----------------------------------------------------------------------------
export const DEFAULT_LOCATIONS = [
  { id: 'loc_airport', name: 'Bangalore Airport (BLR)', zone: 'Airport', lat: 13.1986, lng: 77.7066, active: true },
  { id: 'loc_koramangala', name: 'Koramangala', zone: 'South', lat: 12.9352, lng: 77.6245, active: true },
  { id: 'loc_indiranagar', name: 'Indiranagar', zone: 'Central', lat: 12.9784, lng: 77.6408, active: true },
  { id: 'loc_whitefield', name: 'Whitefield & ITPL', zone: 'East', lat: 12.9698, lng: 77.7499, active: true },
  { id: 'loc_hsr', name: 'HSR Layout', zone: 'South', lat: 12.9121, lng: 77.6446, active: true },
  { id: 'loc_electronic_city', name: 'Electronic City', zone: 'South', lat: 12.8452, lng: 77.6602, active: true },
  { id: 'loc_mg_road', name: 'MG Road & Brigade', zone: 'Central', lat: 12.9756, lng: 77.6066, active: true },
  { id: 'loc_jayanagar', name: 'Jayanagar & JP Nagar', zone: 'South', lat: 12.9308, lng: 77.5838, active: true },
  { id: 'loc_hebbal', name: 'Hebbal & Manyata', zone: 'North', lat: 13.0358, lng: 77.5970, active: true },
  { id: 'loc_marathahalli', name: 'Marathahalli & ORR', zone: 'East', lat: 12.9591, lng: 77.6974, active: true },
]

// ----------------------------------------------------------------------------
// Database Engine Initialization
// ----------------------------------------------------------------------------
const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI

let pgPool = null
let sqliteDb = null
let activeEngine = 'sqlite'
let dbReady = false

if (POSTGRES_URL) {
  activeEngine = 'postgres'
  console.log('[Database] Connecting to PostgreSQL Single Source of Truth...')
  pgPool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: POSTGRES_URL.includes('localhost') || POSTGRES_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  })

  pgPool.on('error', (err) => {
    console.error('[Database Pool Error]:', err.message)
  })
} else {
  activeEngine = 'sqlite'
  function resolveDatabasePath() {
    if (process.env.DATABASE_PATH) {
      const dir = path.dirname(process.env.DATABASE_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      return process.env.DATABASE_PATH
    }

    const envDir = process.env.DATA_DIR || process.env.PERSISTENT_STORAGE_PATH || process.env.PERSISTENT_DATA_DIR
    if (envDir) {
      try {
        if (!fs.existsSync(envDir)) fs.mkdirSync(envDir, { recursive: true })
        return path.join(envDir, 'blrcruiz.db')
      } catch {}
    }

    const persistentMounts = ['/var/data', '/data']
    for (const mount of persistentMounts) {
      if (fs.existsSync(mount)) {
        try {
          const testFile = path.join(mount, '.write_test')
          fs.writeFileSync(testFile, 'ok')
          fs.unlinkSync(testFile)
          return path.join(mount, 'blrcruiz.db')
        } catch {}
      }
    }

    const localDataDir = path.resolve(__dirname, '..', 'data')
    if (!fs.existsSync(localDataDir)) {
      try {
        fs.mkdirSync(localDataDir, { recursive: true })
      } catch {
        return path.resolve(__dirname, '..', 'blrcruiz.db')
      }
    }
    return path.join(localDataDir, 'blrcruiz.db')
  }

  const DB_FILE = resolveDatabasePath()
  console.log(`[Database] Initializing SQLite Single-Source-of-Truth at: ${DB_FILE}`)
  sqliteDb = new DatabaseSync(DB_FILE)
  try {
    sqliteDb.exec('PRAGMA journal_mode = WAL;')
    sqliteDb.exec('PRAGMA synchronous = NORMAL;')
  } catch {}
}

// ----------------------------------------------------------------------------
// Schema Initializations & Safe Migrations
// ----------------------------------------------------------------------------
let initPromise = null

async function initSchema() {
  if (activeEngine === 'postgres') {
    const client = await pgPool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id SERIAL PRIMARY KEY,
          brand VARCHAR(255) NOT NULL,
          model VARCHAR(255) NOT NULL,
          category VARCHAR(100) DEFAULT 'Hatchback',
          year INTEGER DEFAULT 2026,
          seats INTEGER DEFAULT 5,
          transmission VARCHAR(100) DEFAULT 'Automatic',
          fuel VARCHAR(100) DEFAULT 'Petrol',
          ac BOOLEAN DEFAULT true,
          price_per_day NUMERIC(10,2) DEFAULT 1500,
          rating NUMERIC(3,2) DEFAULT 4.8,
          popular BOOLEAN DEFAULT false,
          available BOOLEAN DEFAULT true,
          image TEXT,
          images JSONB DEFAULT '[]'::jsonb,
          locations JSONB DEFAULT '[]'::jsonb,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS locations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          zone VARCHAR(100) DEFAULT 'Other',
          lat NUMERIC(10,6) DEFAULT 12.9716,
          lng NUMERIC(10,6) DEFAULT 77.5946,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inquiries (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(100) NOT NULL,
          email VARCHAR(255),
          car_name VARCHAR(255),
          car_id VARCHAR(255),
          pickup_location VARCHAR(255),
          pickup_date VARCHAR(100),
          return_date VARCHAR(100),
          days INTEGER DEFAULT 1,
          estimated_total VARCHAR(100),
          message TEXT,
          status VARCHAR(100) DEFAULT 'New',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bookings (
          id VARCHAR(255) PRIMARY KEY,
          booking_id VARCHAR(255),
          status VARCHAR(100) DEFAULT 'CONFIRMED',
          payment_status VARCHAR(100) DEFAULT 'PAID',
          payment_method VARCHAR(100) DEFAULT 'RAZORPAY',
          razorpay_order_id VARCHAR(255),
          razorpay_payment_id VARCHAR(255),
          razorpay_signature VARCHAR(255),
          amount_paid NUMERIC(10,2),
          car_id VARCHAR(255),
          car_name VARCHAR(255),
          customer_name VARCHAR(255),
          customer_phone VARCHAR(100),
          customer_email VARCHAR(255),
          pickup_date VARCHAR(100),
          return_date VARCHAR(100),
          pickup_location VARCHAR(255),
          days INTEGER DEFAULT 1,
          need_chauffeur BOOLEAN DEFAULT false,
          special_requests TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          verified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admin_sessions (
          token VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          role VARCHAR(100) DEFAULT 'admin',
          name VARCHAR(255),
          created_at BIGINT,
          expires_at BIGINT
        );
      `)

      // Seed default locations if missing without overwriting existing
      for (const loc of DEFAULT_LOCATIONS) {
        await client.query(`
          INSERT INTO locations (id, name, zone, lat, lng, active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [loc.id, loc.name, loc.zone, loc.lat, loc.lng, loc.active])
      }

      console.log('[Database] PostgreSQL schema verified successfully.')
      dbReady = true
    } finally {
      client.release()
    }
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        category TEXT DEFAULT 'Hatchback',
        year INTEGER DEFAULT 2026,
        seats INTEGER DEFAULT 5,
        transmission TEXT DEFAULT 'Automatic',
        fuel TEXT DEFAULT 'Petrol',
        ac INTEGER DEFAULT 1,
        pricePerDay REAL DEFAULT 1500,
        rating REAL DEFAULT 4.8,
        popular INTEGER DEFAULT 0,
        available INTEGER DEFAULT 1,
        image TEXT,
        images TEXT,
        locations TEXT,
        description TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        zone TEXT DEFAULT 'Other',
        lat REAL DEFAULT 12.9716,
        lng REAL DEFAULT 77.5946,
        active INTEGER DEFAULT 1,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS inquiries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        carName TEXT,
        carId TEXT,
        pickupLocation TEXT,
        pickupDate TEXT,
        returnDate TEXT,
        days INTEGER DEFAULT 1,
        estimatedTotal TEXT,
        message TEXT,
        status TEXT DEFAULT 'New',
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        bookingId TEXT,
        status TEXT DEFAULT 'CONFIRMED',
        paymentStatus TEXT DEFAULT 'PAID',
        paymentMethod TEXT DEFAULT 'RAZORPAY',
        razorpay_order_id TEXT,
        razorpay_payment_id TEXT,
        razorpay_signature TEXT,
        amountPaid REAL,
        carId TEXT,
        carName TEXT,
        customerName TEXT,
        customerPhone TEXT,
        customerEmail TEXT,
        pickupDate TEXT,
        returnDate TEXT,
        pickupLocation TEXT,
        days INTEGER DEFAULT 1,
        needChauffeur INTEGER DEFAULT 0,
        specialRequests TEXT,
        createdAt TEXT,
        verifiedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        name TEXT,
        createdAt INTEGER,
        expiresAt INTEGER
      );
    `)

    // Seed default locations if missing into SQLite
    const insertStmt = sqliteDb.prepare(`
      INSERT OR IGNORE INTO locations (id, name, zone, lat, lng, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const now = new Date().toISOString()
    for (const loc of DEFAULT_LOCATIONS) {
      insertStmt.run(loc.id, loc.name, loc.zone, loc.lat, loc.lng, loc.active ? 1 : 0, now, now)
    }

    console.log('[Database] SQLite schema verified successfully.')
    dbReady = true
  }
}

initPromise = initSchema().catch((err) => {
  console.error('[Database] Schema initialization error:', err)
})

async function ensureReady() {
  if (initPromise) {
    await initPromise
  }
}

// ----------------------------------------------------------------------------
// Atomic JSON File Mirror Writers (Zero-Data-Loss Safety)
// ----------------------------------------------------------------------------
function saveCarsJsonMirror(carsList) {
  try {
    const list = Array.isArray(carsList) ? carsList : []
    const jsonContent = JSON.stringify(list, null, 2)
    const candidates = [
      path.resolve(__dirname, '..', 'data', 'cars_data.json'),
      path.resolve(__dirname, '..', 'cars_data.json'),
    ]
    for (const jsonPath of candidates) {
      const dir = path.dirname(jsonPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(jsonPath, jsonContent, 'utf-8')
    }
  } catch (err) {
    console.warn('[Database] Failed to write cars_data.json mirror:', err.message)
  }
}

function saveLocationsJsonMirror(locationsList) {
  try {
    const list = Array.isArray(locationsList) ? locationsList : []
    const jsonContent = JSON.stringify(list, null, 2)
    const candidates = [
      path.resolve(__dirname, '..', 'data', 'locations_data.json'),
      path.resolve(__dirname, '..', 'locations_data.json'),
    ]
    for (const jsonPath of candidates) {
      const dir = path.dirname(jsonPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(jsonPath, jsonContent, 'utf-8')
    }
  } catch (err) {
    console.warn('[Database] Failed to write locations_data.json mirror:', err.message)
  }
}

// ----------------------------------------------------------------------------
// Formatters for Consistent Multi-Database Output
// ----------------------------------------------------------------------------
function formatPgVehicleRow(row) {
  if (!row) return null
  const images = Array.isArray(row.images) ? row.images : []
  const locations = Array.isArray(row.locations) ? row.locations : []
  return {
    id: Number(row.id),
    brand: String(row.brand),
    model: String(row.model),
    category: String(row.category || 'Hatchback'),
    year: Number(row.year) || 2026,
    seats: Number(row.seats) || 5,
    transmission: String(row.transmission || 'Automatic'),
    fuel: String(row.fuel || 'Petrol'),
    ac: Boolean(row.ac),
    pricePerDay: Number(row.price_per_day) || 1500,
    rating: Number(row.rating) || 4.8,
    popular: Boolean(row.popular),
    available: Boolean(row.available),
    image: row.image || (images.length > 0 ? images[0] : ''),
    images: images.length > 0 ? images : (row.image ? [row.image] : []),
    locations,
    description: String(row.description || ''),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  }
}

function formatSqliteVehicleRow(row) {
  if (!row) return null
  let images = []
  try {
    images = typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || [])
  } catch {
    images = row.image ? [row.image] : []
  }

  let locations = []
  try {
    locations = typeof row.locations === 'string' ? JSON.parse(row.locations) : (row.locations || [])
  } catch {
    locations = []
  }

  return {
    id: Number(row.id),
    brand: String(row.brand),
    model: String(row.model),
    category: String(row.category || 'Hatchback'),
    year: Number(row.year) || 2026,
    seats: Number(row.seats) || 5,
    transmission: String(row.transmission || 'Automatic'),
    fuel: String(row.fuel || 'Petrol'),
    ac: Boolean(row.ac),
    pricePerDay: Number(row.pricePerDay) || 1500,
    rating: Number(row.rating) || 4.8,
    popular: Boolean(row.popular),
    available: Boolean(row.available),
    image: row.image || (images.length > 0 ? images[0] : ''),
    images: Array.isArray(images) && images.length > 0 ? images : (row.image ? [row.image] : []),
    locations: Array.isArray(locations) ? locations : [],
    description: String(row.description || ''),
    createdAt: String(row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  }
}

function formatPgLocationRow(row) {
  if (!row) return null
  return {
    id: String(row.id),
    name: String(row.name),
    zone: String(row.zone || 'Other'),
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : 12.9716,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : 77.5946,
    active: Boolean(row.active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  }
}

function formatSqliteLocationRow(row) {
  if (!row) return null
  return {
    id: String(row.id),
    name: String(row.name),
    zone: String(row.zone || 'Other'),
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : 12.9716,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : 77.5946,
    active: Boolean(row.active),
    createdAt: String(row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  }
}

// ----------------------------------------------------------------------------
// Unified Database Operations API
// ----------------------------------------------------------------------------
export const appDb = {
  get engine() {
    return activeEngine
  },

  async isHealthy() {
    await ensureReady()
    try {
      if (activeEngine === 'postgres') {
        const res = await pgPool.query('SELECT 1 as healthy')
        return res.rows.length > 0
      }
      const res = sqliteDb.prepare('SELECT 1 as healthy').get()
      return Boolean(res && res.healthy === 1)
    } catch {
      return false
    }
  },

  async getCounts() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      const [vRes, lRes, iRes, bRes] = await Promise.all([
        pgPool.query('SELECT COUNT(*) FROM vehicles'),
        pgPool.query('SELECT COUNT(*) FROM locations'),
        pgPool.query('SELECT COUNT(*) FROM inquiries'),
        pgPool.query('SELECT COUNT(*) FROM bookings'),
      ])
      return {
        vehicles: parseInt(vRes.rows[0].count, 10),
        locations: parseInt(lRes.rows[0].count, 10),
        inquiries: parseInt(iRes.rows[0].count, 10),
        bookings: parseInt(bRes.rows[0].count, 10),
      }
    }
    const v = sqliteDb.prepare('SELECT COUNT(*) as count FROM vehicles').get()
    const l = sqliteDb.prepare('SELECT COUNT(*) as count FROM locations').get()
    const i = sqliteDb.prepare('SELECT COUNT(*) as count FROM inquiries').get()
    const b = sqliteDb.prepare('SELECT COUNT(*) as count FROM bookings').get()
    return {
      vehicles: v ? Number(v.count) : 0,
      locations: l ? Number(l.count) : 0,
      inquiries: i ? Number(i.count) : 0,
      bookings: b ? Number(b.count) : 0,
    }
  },

  // --- VEHICLES ---
  async getVehicles() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM vehicles ORDER BY id ASC')
      return res.rows.map(formatPgVehicleRow)
    }
    const rows = sqliteDb.prepare('SELECT * FROM vehicles ORDER BY id ASC').all()
    return rows.map(formatSqliteVehicleRow)
  },

  async getVehicleById(id) {
    await ensureReady()
    const numericId = Number(id)
    if (isNaN(numericId)) return null

    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM vehicles WHERE id = $1', [numericId])
      return formatPgVehicleRow(res.rows[0])
    }
    const row = sqliteDb.prepare('SELECT * FROM vehicles WHERE id = ?').get(numericId)
    return formatSqliteVehicleRow(row)
  },

  async createVehicle(data) {
    await ensureReady()
    const brand = String(data.brand || '').trim()
    const model = String(data.model || '').trim()
    const category = String(data.category || 'Hatchback').trim()
    const year = Number(data.year) || new Date().getFullYear()
    const seats = Number(data.seats) || 5
    const transmission = String(data.transmission || 'Automatic').trim()
    const fuel = String(data.fuel || 'Petrol').trim()
    const ac = data.ac !== undefined ? Boolean(data.ac) : true
    const pricePerDay = Number(data.pricePerDay) || 1500
    const rating = Number(data.rating) || 4.8
    const popular = Boolean(data.popular)
    const available = data.available !== undefined ? Boolean(data.available) : true

    const images = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : [data.image || 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80']
    const image = images[0] || (data.image || '')
    const locations = Array.isArray(data.locations) ? data.locations : []
    const description = String(data.description || '').trim()
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const query = `
        INSERT INTO vehicles (
          brand, model, category, year, seats, transmission, fuel, ac,
          price_per_day, rating, popular, available, image, images, locations,
          description, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *;
      `
      const res = await pgPool.query(query, [
        brand, model, category, year, seats, transmission, fuel, ac,
        pricePerDay, rating, popular, available, image, JSON.stringify(images),
        JSON.stringify(locations), description, now, now,
      ])
      const created = formatPgVehicleRow(res.rows[0])
      saveCarsJsonMirror(await this.getVehicles())
      return created
    }

    const stmt = sqliteDb.prepare(`
      INSERT INTO vehicles (
        brand, model, category, year, seats, transmission, fuel, ac,
        pricePerDay, rating, popular, available, image, images, locations,
        description, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      brand, model, category, year, seats, transmission, fuel, ac ? 1 : 0,
      pricePerDay, rating, popular ? 1 : 0, available ? 1 : 0, image, JSON.stringify(images),
      JSON.stringify(locations), description, now, now
    )

    const newId = Number(result.lastInsertRowid)
    const created = await this.getVehicleById(newId)
    saveCarsJsonMirror(await this.getVehicles())
    return created
  },

  async updateVehicle(id, data) {
    await ensureReady()
    const numericId = Number(id)
    const existing = await this.getVehicleById(numericId)
    if (!existing) return null

    const brand = data.brand !== undefined ? String(data.brand).trim() : existing.brand
    const model = data.model !== undefined ? String(data.model).trim() : existing.model
    const category = data.category !== undefined ? String(data.category).trim() : existing.category
    const year = data.year !== undefined ? Number(data.year) : existing.year
    const seats = data.seats !== undefined ? Number(data.seats) : existing.seats
    const transmission = data.transmission !== undefined ? String(data.transmission).trim() : existing.transmission
    const fuel = data.fuel !== undefined ? String(data.fuel).trim() : existing.fuel
    const ac = data.ac !== undefined ? Boolean(data.ac) : existing.ac
    const pricePerDay = data.pricePerDay !== undefined ? Number(data.pricePerDay) : existing.pricePerDay
    const rating = data.rating !== undefined ? Number(data.rating) : existing.rating
    const popular = data.popular !== undefined ? Boolean(data.popular) : existing.popular
    const available = data.available !== undefined ? Boolean(data.available) : existing.available

    const images = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : (data.image ? [data.image] : existing.images)
    const image = images[0] || existing.image
    const locations = Array.isArray(data.locations) ? data.locations : existing.locations
    const description = data.description !== undefined ? String(data.description).trim() : existing.description
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const query = `
        UPDATE vehicles SET
          brand = $1, model = $2, category = $3, year = $4, seats = $5, transmission = $6,
          fuel = $7, ac = $8, price_per_day = $9, rating = $10, popular = $11, available = $12,
          image = $13, images = $14, locations = $15, description = $16, updated_at = $17
        WHERE id = $18
        RETURNING *;
      `
      const res = await pgPool.query(query, [
        brand, model, category, year, seats, transmission, fuel, ac,
        pricePerDay, rating, popular, available, image, JSON.stringify(images),
        JSON.stringify(locations), description, now, numericId,
      ])
      const updated = formatPgVehicleRow(res.rows[0])
      saveCarsJsonMirror(await this.getVehicles())
      return updated
    }

    const stmt = sqliteDb.prepare(`
      UPDATE vehicles SET
        brand = ?, model = ?, category = ?, year = ?, seats = ?, transmission = ?,
        fuel = ?, ac = ?, pricePerDay = ?, rating = ?, popular = ?, available = ?,
        image = ?, images = ?, locations = ?, description = ?, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(
      brand, model, category, year, seats, transmission, fuel, ac ? 1 : 0,
      pricePerDay, rating, popular ? 1 : 0, available ? 1 : 0, image, JSON.stringify(images),
      JSON.stringify(locations), description, now, numericId
    )

    const updated = await this.getVehicleById(numericId)
    saveCarsJsonMirror(await this.getVehicles())
    return updated
  },

  async deleteVehicle(id) {
    await ensureReady()
    const numericId = Number(id)
    const existing = await this.getVehicleById(numericId)
    if (!existing) return null

    if (activeEngine === 'postgres') {
      await pgPool.query('DELETE FROM vehicles WHERE id = $1', [numericId])
    } else {
      sqliteDb.prepare('DELETE FROM vehicles WHERE id = ?').run(numericId)
    }
    saveCarsJsonMirror(await this.getVehicles())
    return existing
  },

  async deleteAllVehicles() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('DELETE FROM vehicles RETURNING id;')
      saveCarsJsonMirror([])
      return { success: true, deletedCount: res.rowCount }
    }
    const countRow = sqliteDb.prepare('SELECT COUNT(*) as count FROM vehicles').get()
    const deletedCount = countRow ? Number(countRow.count) : 0
    sqliteDb.prepare('DELETE FROM vehicles').run()
    saveCarsJsonMirror([])
    return { success: true, deletedCount }
  },

  async resetVehicles() {
    return await this.deleteAllVehicles()
  },

  // --- LOCATIONS ---
  async getLocations() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM locations ORDER BY name ASC')
      return res.rows.map(formatPgLocationRow)
    }
    const rows = sqliteDb.prepare('SELECT * FROM locations ORDER BY name ASC').all()
    return rows.map(formatSqliteLocationRow)
  },

  async getLocationById(id) {
    await ensureReady()
    const stringId = String(id)
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM locations WHERE id = $1', [stringId])
      return formatPgLocationRow(res.rows[0])
    }
    const row = sqliteDb.prepare('SELECT * FROM locations WHERE id = ?').get(stringId)
    return formatSqliteLocationRow(row)
  },

  async createLocation(data) {
    await ensureReady()
    const trimmedName = String(data.name || '').trim()
    if (!trimmedName) throw new Error('Location name is required')

    const id = data.id || `loc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const zone = String(data.zone || 'Other').trim()
    const lat = data.lat !== null && data.lat !== undefined && !isNaN(Number(data.lat)) ? Number(data.lat) : 12.9716
    const lng = data.lng !== null && data.lng !== undefined && !isNaN(Number(data.lng)) ? Number(data.lng) : 77.5946
    const active = data.active !== undefined ? Boolean(data.active) : true
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const query = `
        INSERT INTO locations (id, name, zone, lat, lng, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          zone = EXCLUDED.zone,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          active = EXCLUDED.active,
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `
      const res = await pgPool.query(query, [id, trimmedName, zone, lat, lng, active, now, now])
      const created = formatPgLocationRow(res.rows[0])
      saveLocationsJsonMirror(await this.getLocations())
      return created
    }

    sqliteDb.prepare(`
      INSERT OR REPLACE INTO locations (id, name, zone, lat, lng, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, trimmedName, zone, lat, lng, active ? 1 : 0, now, now)

    const created = await this.getLocationById(id)
    saveLocationsJsonMirror(await this.getLocations())
    return created
  },

  async updateLocation(id, data) {
    await ensureReady()
    const stringId = String(id)
    const existing = await this.getLocationById(stringId)
    if (!existing) return null

    const name = data.name !== undefined ? String(data.name).trim() : existing.name
    const zone = data.zone !== undefined ? String(data.zone).trim() : existing.zone
    const lat = data.lat !== undefined && data.lat !== null && !isNaN(Number(data.lat)) ? Number(data.lat) : existing.lat
    const lng = data.lng !== undefined && data.lng !== null && !isNaN(Number(data.lng)) ? Number(data.lng) : existing.lng
    const active = data.active !== undefined ? Boolean(data.active) : existing.active
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const res = await pgPool.query(`
        UPDATE locations SET
          name = $1, zone = $2, lat = $3, lng = $4, active = $5, updated_at = $6
        WHERE id = $7
        RETURNING *;
      `, [name, zone, lat, lng, active, now, stringId])
      const updated = formatPgLocationRow(res.rows[0])
      saveLocationsJsonMirror(await this.getLocations())
      return updated
    }

    sqliteDb.prepare(`
      UPDATE locations SET
        name = ?, zone = ?, lat = ?, lng = ?, active = ?, updatedAt = ?
      WHERE id = ?
    `).run(name, zone, lat, lng, active ? 1 : 0, now, stringId)

    const updated = await this.getLocationById(stringId)
    saveLocationsJsonMirror(await this.getLocations())
    return updated
  },

  async deleteLocation(id) {
    await ensureReady()
    const stringId = String(id)
    const existing = await this.getLocationById(stringId)
    if (!existing) return null

    if (activeEngine === 'postgres') {
      await pgPool.query('DELETE FROM locations WHERE id = $1', [stringId])
    } else {
      sqliteDb.prepare('DELETE FROM locations WHERE id = ?').run(stringId)
    }
    saveLocationsJsonMirror(await this.getLocations())
    return existing
  },

  // --- INQUIRIES ---
  async getInquiries() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM inquiries ORDER BY created_at DESC')
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email || '',
        carName: r.car_name || '',
        carId: r.car_id || null,
        pickupLocation: r.pickup_location || '',
        pickupDate: r.pickup_date || '',
        returnDate: r.return_date || '',
        days: Number(r.days) || 1,
        estimatedTotal: r.estimated_total || '—',
        message: r.message || '',
        status: r.status || 'New',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      }))
    }
    const rows = sqliteDb.prepare('SELECT * FROM inquiries ORDER BY createdAt DESC').all()
    return rows.map((r) => ({
      ...r,
      days: Number(r.days) || 1,
    }))
  },

  async createInquiry(data) {
    await ensureReady()
    const id = data.id || `inq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const name = String(data.name || 'Anonymous').trim()
    const phone = String(data.phone || '').trim()
    const email = String(data.email || '').trim()
    const carName = String(data.carName || data.car || 'General Inquiry').trim()
    const carId = data.carId ? String(data.carId) : null
    const pickupLocation = String(data.pickupLocation || 'Bangalore City').trim()
    const pickupDate = String(data.pickupDate || '')
    const returnDate = String(data.returnDate || '')
    const days = Number(data.days) || 1
    const estimatedTotal = String(data.estimatedTotal || '—')
    const message = String(data.message || '').trim()
    const status = String(data.status || 'New').trim()
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const query = `
        INSERT INTO inquiries (
          id, name, phone, email, car_name, car_id, pickup_location, pickup_date,
          return_date, days, estimated_total, message, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *;
      `
      const res = await pgPool.query(query, [
        id, name, phone, email, carName, carId, pickupLocation, pickupDate,
        returnDate, days, estimatedTotal, message, status, now, now,
      ])
      const r = res.rows[0]
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email || '',
        carName: r.car_name || '',
        carId: r.car_id || null,
        pickupLocation: r.pickup_location || '',
        pickupDate: r.pickup_date || '',
        returnDate: r.return_date || '',
        days: Number(r.days) || 1,
        estimatedTotal: r.estimated_total || '—',
        message: r.message || '',
        status: r.status || 'New',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : now,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : now,
      }
    }

    sqliteDb.prepare(`
      INSERT INTO inquiries (
        id, name, phone, email, carName, carId, pickupLocation, pickupDate,
        returnDate, days, estimatedTotal, message, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, phone, email, carName, carId, pickupLocation, pickupDate,
      returnDate, days, estimatedTotal, message, status, now, now
    )

    return sqliteDb.prepare('SELECT * FROM inquiries WHERE id = ?').get(id)
  },

  async updateInquiry(id, data) {
    await ensureReady()
    const now = new Date().toISOString()
    if (activeEngine === 'postgres') {
      const existingRes = await pgPool.query('SELECT * FROM inquiries WHERE id = $1', [id])
      if (existingRes.rows.length === 0) return null
      const existing = existingRes.rows[0]
      const status = data.status !== undefined ? String(data.status).trim() : existing.status
      const message = data.message !== undefined ? String(data.message).trim() : existing.message

      const res = await pgPool.query(
        'UPDATE inquiries SET status = $1, message = $2, updated_at = $3 WHERE id = $4 RETURNING *;',
        [status, message, now, id]
      )
      const r = res.rows[0]
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        status: r.status,
        message: r.message,
        updatedAt: new Date(r.updated_at).toISOString(),
      }
    }

    const existing = sqliteDb.prepare('SELECT * FROM inquiries WHERE id = ?').get(id)
    if (!existing) return null

    const status = data.status !== undefined ? String(data.status).trim() : existing.status
    const message = data.message !== undefined ? String(data.message).trim() : existing.message

    sqliteDb.prepare(`
      UPDATE inquiries SET status = ?, message = ?, updatedAt = ? WHERE id = ?
    `).run(status, message, now, id)

    return sqliteDb.prepare('SELECT * FROM inquiries WHERE id = ?').get(id)
  },

  async deleteInquiry(id) {
    await ensureReady()
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('DELETE FROM inquiries WHERE id = $1 RETURNING *;', [id])
      return res.rows[0] || null
    }
    const existing = sqliteDb.prepare('SELECT * FROM inquiries WHERE id = ?').get(id)
    if (!existing) return null
    sqliteDb.prepare('DELETE FROM inquiries WHERE id = ?').run(id)
    return existing
  },

  async resetInquiries() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      await pgPool.query('DELETE FROM inquiries')
    } else {
      sqliteDb.prepare('DELETE FROM inquiries').run()
    }
    return []
  },

  // --- BOOKINGS ---
  async getBookings() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM bookings ORDER BY created_at DESC')
      return res.rows
    }
    return sqliteDb.prepare('SELECT * FROM bookings ORDER BY createdAt DESC').all()
  },

  async createBooking(data) {
    await ensureReady()
    const id = data.id || data.bookingId || `DRV-BLR-${Date.now().toString().slice(-6)}`
    const bookingId = data.bookingId || id
    const status = data.status || 'CONFIRMED'
    const paymentStatus = data.paymentStatus || 'PAID'
    const paymentMethod = data.paymentMethod || 'RAZORPAY'
    const razorpay_order_id = data.razorpay_order_id || ''
    const razorpay_payment_id = data.razorpay_payment_id || ''
    const razorpay_signature = data.razorpay_signature || ''
    const amountPaid = Number(data.amountPaid) || 0
    const carId = String(data.carId || '')
    const carName = String(data.carName || '')
    const customerName = String(data.customerName || '')
    const customerPhone = String(data.customerPhone || '')
    const customerEmail = String(data.customerEmail || '')
    const pickupDate = String(data.pickupDate || '')
    const returnDate = String(data.returnDate || '')
    const pickupLocation = String(data.pickupLocation || '')
    const days = Number(data.days) || 1
    const needChauffeur = Boolean(data.needChauffeur)
    const specialRequests = String(data.specialRequests || '')
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const query = `
        INSERT INTO bookings (
          id, booking_id, status, payment_status, payment_method,
          razorpay_order_id, razorpay_payment_id, razorpay_signature,
          amount_paid, car_id, car_name, customer_name, customer_phone, customer_email,
          pickup_date, return_date, pickup_location, days, need_chauffeur, special_requests,
          created_at, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *;
      `
      const res = await pgPool.query(query, [
        id, bookingId, status, paymentStatus, paymentMethod,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        amountPaid, carId, carName, customerName, customerPhone, customerEmail,
        pickupDate, returnDate, pickupLocation, days, needChauffeur, specialRequests,
        now, now,
      ])
      return res.rows[0]
    }

    sqliteDb.prepare(`
      INSERT INTO bookings (
        id, bookingId, status, paymentStatus, paymentMethod,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        amountPaid, carId, carName, customerName, customerPhone, customerEmail,
        pickupDate, returnDate, pickupLocation, days, needChauffeur, specialRequests,
        createdAt, verifiedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, bookingId, status, paymentStatus, paymentMethod,
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      amountPaid, carId, carName, customerName, customerPhone, customerEmail,
      pickupDate, returnDate, pickupLocation, days, needChauffeur ? 1 : 0, specialRequests,
      now, now
    )

    return sqliteDb.prepare('SELECT * FROM bookings WHERE id = ?').get(id)
  },

  // --- SESSIONS ---
  async getSession(token) {
    await ensureReady()
    if (!token) return null
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM admin_sessions WHERE token = $1', [token])
      if (res.rows.length === 0) return null
      const row = res.rows[0]
      if (Number(row.expires_at) < Date.now()) {
        await this.deleteSession(token)
        return null
      }
      return {
        token: row.token,
        user: {
          username: row.username,
          role: row.role,
          name: row.name,
        },
        createdAt: Number(row.created_at),
        expiresAt: Number(row.expires_at),
      }
    }

    const row = sqliteDb.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token)
    if (!row) return null
    if (row.expiresAt < Date.now()) {
      await this.deleteSession(token)
      return null
    }
    return {
      token: row.token,
      user: {
        username: row.username,
        role: row.role,
        name: row.name,
      },
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    }
  },

  async saveSession(session) {
    await ensureReady()
    const username = session.user?.username || 'admin'
    const role = session.user?.role || 'admin'
    const name = session.user?.name || 'BLR CRUIZ Admin'
    const createdAt = session.createdAt || Date.now()
    const expiresAt = session.expiresAt || (Date.now() + 24 * 60 * 60 * 1000)

    if (activeEngine === 'postgres') {
      await pgPool.query(`
        INSERT INTO admin_sessions (token, username, role, name, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (token) DO UPDATE SET
          username = EXCLUDED.username,
          role = EXCLUDED.role,
          name = EXCLUDED.name,
          expires_at = EXCLUDED.expires_at;
      `, [session.token, username, role, name, createdAt, expiresAt])
      return
    }

    sqliteDb.prepare(`
      INSERT OR REPLACE INTO admin_sessions (token, username, role, name, createdAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session.token, username, role, name, createdAt, expiresAt)
  },

  async deleteSession(token) {
    await ensureReady()
    if (!token) return
    if (activeEngine === 'postgres') {
      await pgPool.query('DELETE FROM admin_sessions WHERE token = $1', [token])
    } else {
      sqliteDb.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token)
    }
  },
}

export default appDb
