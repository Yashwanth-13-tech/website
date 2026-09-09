import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import { DEMO_LOCATIONS, DEMO_VEHICLES, DEMO_UNAVAILABILITY } from '../data/demo.js'
import { Vehicle } from '../models/Vehicle.js'
import { Location } from '../models/Location.js'
import { VehicleUnavailability } from '../models/VehicleUnavailability.js'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ----------------------------------------------------------------------------
// Database Engine Initialization
// ----------------------------------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production'
const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI

let pgPool = null
let sqliteDb = null
let activeEngine = isProduction ? 'postgres' : (POSTGRES_URL ? 'postgres' : 'sqlite')
let dbConnectionError = null

if (isProduction && !POSTGRES_URL) {
  dbConnectionError = 'FATAL: DATABASE_URL environment variable is required in production! Configure DATABASE_URL in Render Dashboard.'
  console.error(`\n[Database Configuration Error] ${dbConnectionError}\n`)
}

if (POSTGRES_URL) {
  activeEngine = 'postgres'
  console.log('[Database] Initializing PostgreSQL Single Source of Truth...')
  pgPool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: POSTGRES_URL.includes('localhost') || POSTGRES_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  pgPool.on('error', (err) => {
    console.error('[Database Pool Error]:', err.message)
    dbConnectionError = err.message
  })
} else if (!isProduction) {
  activeEngine = 'sqlite'
  function resolveDatabasePath() {
    if (process.env.DATABASE_PATH) {
      const dir = path.dirname(process.env.DATABASE_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      return process.env.DATABASE_PATH
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

  try {
    const DB_FILE = resolveDatabasePath()
    console.log(`[Database (Development Only)] Initializing local SQLite at: ${DB_FILE}`)
    sqliteDb = new DatabaseSync(DB_FILE)
    sqliteDb.exec('PRAGMA journal_mode = WAL;')
    sqliteDb.exec('PRAGMA synchronous = NORMAL;')
  } catch (err) {
    dbConnectionError = err.message
    console.error('[Database Error] SQLite initialization failed:', err.message)
  }
}

// ----------------------------------------------------------------------------
// Schema Migrations & Auto-Columns
// ----------------------------------------------------------------------------
let initPromise = null

async function initSchema() {
  if (activeEngine === 'postgres') {
    if (!POSTGRES_URL) {
      throw new Error(dbConnectionError || 'DATABASE_URL is missing for PostgreSQL')
    }

    let client
    try {
      client = await pgPool.connect()
      await client.query(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id SERIAL PRIMARY KEY,
          brand VARCHAR(255) NOT NULL,
          model VARCHAR(255) NOT NULL,
          year INTEGER DEFAULT 2024,
          category VARCHAR(100) DEFAULT 'hatchback',
          price_daily NUMERIC(10,2) DEFAULT 1500,
          price_weekend NUMERIC(10,2) DEFAULT 1725,
          price_weekly NUMERIC(10,2) DEFAULT 1275,
          price_monthly NUMERIC(10,2) DEFAULT 975,
          security_deposit NUMERIC(10,2) DEFAULT 3000,
          mileage_limit INTEGER DEFAULT 300,
          extra_km_rate NUMERIC(8,2) DEFAULT 12.00,
          seats INTEGER DEFAULT 5,
          doors INTEGER DEFAULT 4,
          transmission VARCHAR(100) DEFAULT 'automatic',
          fuel_type VARCHAR(100) DEFAULT 'petrol',
          ac BOOLEAN DEFAULT true,
          features JSONB DEFAULT '[]'::jsonb,
          images JSONB DEFAULT '[]'::jsonb,
          locations JSONB DEFAULT '[]'::jsonb,
          status VARCHAR(100) DEFAULT 'available',
          rating NUMERIC(3,2) DEFAULT 4.80,
          review_count INTEGER DEFAULT 0,
          is_featured BOOLEAN DEFAULT false,
          is_popular BOOLEAN DEFAULT false,
          license_plate VARCHAR(100),
          description TEXT,
          image TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS vehicle_unavailability (
          id SERIAL PRIMARY KEY,
          vehicle_id INTEGER NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          reason VARCHAR(100) DEFAULT 'other',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS locations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) UNIQUE,
          address TEXT,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          pickup_available BOOLEAN DEFAULT true,
          return_available BOOLEAN DEFAULT true,
          delivery_fee NUMERIC(8,2) DEFAULT 0.00,
          phone VARCHAR(100),
          whatsapp_number VARCHAR(100),
          coordinates JSONB DEFAULT '{"lat":12.9716,"lng":77.5946}'::jsonb,
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

      // Auto-migrate column additions safely
      const pgCols = [
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price_weekend NUMERIC(10,2) DEFAULT 1725;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price_weekly NUMERIC(10,2) DEFAULT 1275;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2) DEFAULT 975;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10,2) DEFAULT 3000;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mileage_limit INTEGER DEFAULT 300;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS extra_km_rate NUMERIC(8,2) DEFAULT 12.00;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT '[]'::jsonb;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'available';`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;`,
        `ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS license_plate VARCHAR(100);`,
      ]
      for (const colQuery of pgCols) {
        try { await client.query(colQuery) } catch {}
      }

      // Seed default locations ONLY if locations table is completely empty
      const locCountRes = await client.query('SELECT COUNT(*) FROM locations')
      if (parseInt(locCountRes.rows[0].count, 10) === 0) {
        for (const loc of DEMO_LOCATIONS) {
          await client.query(`
            INSERT INTO locations (
              id, name, slug, address, description, is_active, pickup_available, return_available,
              delivery_fee, phone, whatsapp_number, coordinates, zone, lat, lng, active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [
            String(loc.id), loc.name, loc.slug, loc.address, loc.description,
            loc.is_active, loc.pickup_available, loc.return_available, loc.delivery_fee,
            loc.phone, loc.whatsapp_number, JSON.stringify(loc.coordinates),
            loc.zone, loc.coordinates.lat, loc.coordinates.lng, loc.is_active
          ])
        }
      }

      dbConnectionError = null
      console.log('[Database] PostgreSQL schema verified successfully.')
    } catch (err) {
      dbConnectionError = err.message
      console.error('[Database Connection Error]:', err.message)
      throw err
    } finally {
      if (client) client.release()
    }
  } else if (sqliteDb) {
    try {
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          year INTEGER DEFAULT 2024,
          category TEXT DEFAULT 'hatchback',
          price_daily REAL DEFAULT 1500,
          price_weekend REAL DEFAULT 1725,
          price_weekly REAL DEFAULT 1275,
          price_monthly REAL DEFAULT 975,
          security_deposit REAL DEFAULT 3000,
          mileage_limit INTEGER DEFAULT 300,
          extra_km_rate REAL DEFAULT 12.0,
          seats INTEGER DEFAULT 5,
          doors INTEGER DEFAULT 4,
          transmission TEXT DEFAULT 'automatic',
          fuel_type TEXT DEFAULT 'petrol',
          ac INTEGER DEFAULT 1,
          features TEXT DEFAULT '[]',
          images TEXT DEFAULT '[]',
          locations TEXT DEFAULT '[]',
          status TEXT DEFAULT 'available',
          rating REAL DEFAULT 4.8,
          review_count INTEGER DEFAULT 0,
          is_featured INTEGER DEFAULT 0,
          is_popular INTEGER DEFAULT 0,
          license_plate TEXT,
          description TEXT,
          image TEXT,
          pricePerDay REAL,
          fuel TEXT,
          popular INTEGER DEFAULT 0,
          available INTEGER DEFAULT 1,
          createdAt TEXT,
          updatedAt TEXT,
          created_at TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS vehicle_unavailability (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          reason TEXT DEFAULT 'other',
          notes TEXT,
          created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT,
          address TEXT,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          pickup_available INTEGER DEFAULT 1,
          return_available INTEGER DEFAULT 1,
          delivery_fee REAL DEFAULT 0,
          phone TEXT,
          whatsapp_number TEXT,
          coordinates TEXT DEFAULT '{"lat":12.9716,"lng":77.5946}',
          zone TEXT DEFAULT 'Other',
          lat REAL DEFAULT 12.9716,
          lng REAL DEFAULT 77.5946,
          active INTEGER DEFAULT 1,
          createdAt TEXT,
          updatedAt TEXT,
          created_at TEXT,
          updated_at TEXT
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

      // Safe column migration for SQLite
      const columnsToAdd = [
        { col: 'price_daily', def: 'REAL DEFAULT 1500' },
        { col: 'price_weekend', def: 'REAL DEFAULT 1725' },
        { col: 'price_weekly', def: 'REAL DEFAULT 1275' },
        { col: 'price_monthly', def: 'REAL DEFAULT 975' },
        { col: 'security_deposit', def: 'REAL DEFAULT 3000' },
        { col: 'mileage_limit', def: 'INTEGER DEFAULT 300' },
        { col: 'extra_km_rate', def: 'REAL DEFAULT 12.0' },
        { col: 'doors', def: 'INTEGER DEFAULT 4' },
        { col: 'fuel_type', def: 'TEXT DEFAULT "petrol"' },
        { col: 'features', def: 'TEXT DEFAULT "[]"' },
        { col: 'status', def: 'TEXT DEFAULT "available"' },
        { col: 'review_count', def: 'INTEGER DEFAULT 0' },
        { col: 'is_featured', def: 'INTEGER DEFAULT 0' },
        { col: 'is_popular', def: 'INTEGER DEFAULT 0' },
        { col: 'license_plate', def: 'TEXT' },
      ]

      for (const { col, def } of columnsToAdd) {
        try {
          sqliteDb.exec(`ALTER TABLE vehicles ADD COLUMN ${col} ${def};`)
        } catch {}
      }

      // Seed locations in SQLite ONLY if table is empty
      const locCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM locations').get()
      if (locCount && Number(locCount.count) === 0) {
        const insertStmt = sqliteDb.prepare(`
          INSERT OR IGNORE INTO locations (
            id, name, slug, address, description, is_active, pickup_available, return_available,
            delivery_fee, phone, whatsapp_number, coordinates, zone, lat, lng, active, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        const now = new Date().toISOString()
        for (const loc of DEMO_LOCATIONS) {
          insertStmt.run(
            String(loc.id), loc.name, loc.slug, loc.address, loc.description,
            loc.is_active ? 1 : 0, loc.pickup_available ? 1 : 0, loc.return_available ? 1 : 0,
            loc.delivery_fee, loc.phone, loc.whatsapp_number, JSON.stringify(loc.coordinates),
            loc.zone, loc.coordinates.lat, loc.coordinates.lng, loc.is_active ? 1 : 0,
            now, now
          )
        }
      }

      dbConnectionError = null
      console.log('[Database (Development)] SQLite schema verified successfully.')
    } catch (err) {
      dbConnectionError = err.message
      console.error('[Database Error] SQLite schema error:', err.message)
      throw err
    }
  }
}

initPromise = initSchema().catch((err) => {
  console.error('[Database] Schema initialization failed:', err.message)
})

async function ensureReady() {
  if (initPromise) {
    try {
      await initPromise
    } catch {
      // Let subsequent queries check database readiness and throw appropriate errors
    }
  }
}

function checkConnection() {
  if (activeEngine === 'postgres' && !pgPool) {
    throw new Error(dbConnectionError || 'PostgreSQL database pool is not connected. Verify DATABASE_URL.')
  }
  if (activeEngine === 'sqlite' && !sqliteDb) {
    throw new Error(dbConnectionError || 'SQLite database is not initialized.')
  }
}

// ----------------------------------------------------------------------------
// Formatters for Consistent Model Objects
// ----------------------------------------------------------------------------
function formatPgVehicle(row) {
  if (!row) return null
  return new Vehicle({
    id: row.id,
    brand: row.brand,
    model: row.model,
    year: row.year,
    category: row.category,
    price_daily: row.price_daily,
    price_weekend: row.price_weekend,
    price_weekly: row.price_weekly,
    price_monthly: row.price_monthly,
    security_deposit: row.security_deposit,
    mileage_limit: row.mileage_limit,
    extra_km_rate: row.extra_km_rate,
    seats: row.seats,
    doors: row.doors,
    transmission: row.transmission,
    fuel_type: row.fuel_type,
    ac: row.ac,
    features: row.features,
    images: row.images,
    locations: row.locations,
    status: row.status,
    rating: row.rating,
    review_count: row.review_count,
    is_featured: row.is_featured,
    is_popular: row.is_popular,
    license_plate: row.license_plate,
    description: row.description,
    image: row.image,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }).toJSON()
}

function formatSqliteVehicle(row) {
  if (!row) return null
  let features = []
  let images = []
  let locations = []

  try {
    features = typeof row.features === 'string' ? JSON.parse(row.features) : (row.features || [])
  } catch {}
  try {
    images = typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || [])
  } catch {}
  try {
    locations = typeof row.locations === 'string' ? JSON.parse(row.locations) : (row.locations || [])
  } catch {}

  const basePrice = Number(row.price_daily || row.pricePerDay || 1500)

  return new Vehicle({
    id: row.id,
    brand: row.brand,
    model: row.model,
    year: row.year || 2024,
    category: row.category || 'hatchback',
    price_daily: basePrice,
    price_weekend: row.price_weekend || Math.round(basePrice * 1.15),
    price_weekly: row.price_weekly || Math.round(basePrice * 0.85),
    price_monthly: row.price_monthly || Math.round(basePrice * 0.65),
    security_deposit: row.security_deposit || 3000,
    mileage_limit: row.mileage_limit || 300,
    extra_km_rate: row.extra_km_rate || 12.0,
    seats: row.seats || 5,
    doors: row.doors || 4,
    transmission: row.transmission || 'automatic',
    fuel_type: row.fuel_type || row.fuel || 'petrol',
    ac: Boolean(row.ac),
    features,
    images: images.length > 0 ? images : (row.image ? [row.image] : []),
    locations,
    status: row.status || (row.available === 0 ? 'booked' : 'available'),
    rating: row.rating || 4.8,
    review_count: row.review_count || 0,
    is_featured: Boolean(row.is_featured || row.popular),
    is_popular: Boolean(row.is_popular || row.popular),
    license_plate: row.license_plate || '',
    description: row.description || '',
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at || row.updatedAt,
  }).toJSON()
}

function formatPgLocation(row) {
  if (!row) return null
  return new Location({
    id: row.id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    description: row.description,
    is_active: row.is_active,
    pickup_available: row.pickup_available,
    return_available: row.return_available,
    delivery_fee: row.delivery_fee,
    phone: row.phone,
    whatsapp_number: row.whatsapp_number,
    coordinates: row.coordinates || { lat: Number(row.lat) || 12.9716, lng: Number(row.lng) || 77.5946 },
    zone: row.zone,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }).toJSON()
}

function formatSqliteLocation(row) {
  if (!row) return null
  let coords = { lat: Number(row.lat) || 12.9716, lng: Number(row.lng) || 77.5946 }
  try {
    coords = typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : (row.coordinates || coords)
  } catch {}

  return new Location({
    id: row.id,
    name: row.name,
    slug: row.slug || row.id,
    address: row.address || `${row.name}, Bangalore`,
    description: row.description || '',
    is_active: Boolean(row.is_active !== undefined ? row.is_active : row.active),
    pickup_available: Boolean(row.pickup_available !== undefined ? row.pickup_available : 1),
    return_available: Boolean(row.return_available !== undefined ? row.return_available : 1),
    delivery_fee: Number(row.delivery_fee || 0),
    phone: row.phone || '+91 80001 23456',
    whatsapp_number: row.whatsapp_number || '+91 98765 43210',
    coordinates: coords,
    zone: row.zone || 'Central',
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at || row.updatedAt,
  }).toJSON()
}

// ----------------------------------------------------------------------------
// Unified Database Operations API
// ----------------------------------------------------------------------------
export const appDb = {
  get engine() {
    return activeEngine
  },

  get dbError() {
    return dbConnectionError
  },

  async isHealthy() {
    await ensureReady()
    if (activeEngine === 'postgres') {
      if (!pgPool) return false
      try {
        const res = await pgPool.query('SELECT 1 as healthy')
        return Boolean(res && res.rows && res.rows.length > 0)
      } catch {
        return false
      }
    }
    if (sqliteDb) {
      try {
        const res = sqliteDb.prepare('SELECT 1 as healthy').get()
        return Boolean(res && res.healthy === 1)
      } catch {
        return false
      }
    }
    return false
  },

  async getCounts() {
    await ensureReady()
    checkConnection()

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
    checkConnection()

    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM vehicles ORDER BY id ASC')
      return res.rows.map(formatPgVehicle)
    }
    const rows = sqliteDb.prepare('SELECT * FROM vehicles ORDER BY id ASC').all()
    return rows.map(formatSqliteVehicle)
  },

  async getVehicleById(id) {
    await ensureReady()
    checkConnection()

    const numericId = Number(id)
    if (isNaN(numericId)) return null

    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM vehicles WHERE id = $1', [numericId])
      return formatPgVehicle(res.rows[0])
    }
    const row = sqliteDb.prepare('SELECT * FROM vehicles WHERE id = ?').get(numericId)
    return formatSqliteVehicle(row)
  },

  async createVehicle(data) {
    await ensureReady()
    checkConnection()

    const v = new Vehicle(data)
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const query = `
        INSERT INTO vehicles (
          brand, model, year, category, price_daily, price_weekend, price_weekly, price_monthly,
          security_deposit, mileage_limit, extra_km_rate, seats, doors, transmission, fuel_type,
          ac, features, images, locations, status, rating, review_count, is_featured, is_popular,
          license_plate, description, image, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
        ) RETURNING *;
      `
      const res = await pgPool.query(query, [
        v.brand, v.model, v.year, v.category, v.price_daily, v.price_weekend, v.price_weekly,
        v.price_monthly, v.security_deposit, v.mileage_limit, v.extra_km_rate, v.seats, v.doors,
        v.transmission, v.fuel_type, v.ac, JSON.stringify(v.features), JSON.stringify(v.images),
        JSON.stringify(v.locations), v.status, v.rating, v.review_count, v.is_featured,
        v.is_popular, v.license_plate, v.description, v.image, now, now
      ])
      return formatPgVehicle(res.rows[0])
    }

    const stmt = sqliteDb.prepare(`
      INSERT INTO vehicles (
        brand, model, year, category, price_daily, price_weekend, price_weekly, price_monthly,
        security_deposit, mileage_limit, extra_km_rate, seats, doors, transmission, fuel_type,
        ac, features, images, locations, status, rating, review_count, is_featured, is_popular,
        license_plate, description, image, pricePerDay, fuel, popular, available, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)

    const result = stmt.run(
      v.brand, v.model, v.year, v.category, v.price_daily, v.price_weekend, v.price_weekly,
      v.price_monthly, v.security_deposit, v.mileage_limit, v.extra_km_rate, v.seats, v.doors,
      v.transmission, v.fuel_type, v.ac ? 1 : 0, JSON.stringify(v.features), JSON.stringify(v.images),
      JSON.stringify(v.locations), v.status, v.rating, v.review_count, v.is_featured ? 1 : 0,
      v.is_popular ? 1 : 0, v.license_plate, v.description, v.image, v.price_daily, v.fuel_type,
      v.is_popular ? 1 : 0, v.available ? 1 : 0, now, now
    )

    const newId = Number(result.lastInsertRowid)
    return await this.getVehicleById(newId)
  },

  async updateVehicle(id, data) {
    await ensureReady()
    checkConnection()

    const numericId = Number(id)
    const existing = await this.getVehicleById(numericId)
    if (!existing) return null

    const updatedModel = new Vehicle({
      ...existing,
      ...data,
      id: numericId,
    })
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const query = `
        UPDATE vehicles SET
          brand = $1, model = $2, year = $3, category = $4, price_daily = $5, price_weekend = $6,
          price_weekly = $7, price_monthly = $8, security_deposit = $9, mileage_limit = $10,
          extra_km_rate = $11, seats = $12, doors = $13, transmission = $14, fuel_type = $15,
          ac = $16, features = $17, images = $18, locations = $19, status = $20, rating = $21,
          review_count = $22, is_featured = $23, is_popular = $24, license_plate = $25,
          description = $26, image = $27, updated_at = $28
        WHERE id = $29
        RETURNING *;
      `
      const res = await pgPool.query(query, [
        updatedModel.brand, updatedModel.model, updatedModel.year, updatedModel.category,
        updatedModel.price_daily, updatedModel.price_weekend, updatedModel.price_weekly,
        updatedModel.price_monthly, updatedModel.security_deposit, updatedModel.mileage_limit,
        updatedModel.extra_km_rate, updatedModel.seats, updatedModel.doors, updatedModel.transmission,
        updatedModel.fuel_type, updatedModel.ac, JSON.stringify(updatedModel.features),
        JSON.stringify(updatedModel.images), JSON.stringify(updatedModel.locations),
        updatedModel.status, updatedModel.rating, updatedModel.review_count, updatedModel.is_featured,
        updatedModel.is_popular, updatedModel.license_plate, updatedModel.description,
        updatedModel.image, now, numericId
      ])
      return formatPgVehicle(res.rows[0])
    }

    const stmt = sqliteDb.prepare(`
      UPDATE vehicles SET
        brand = ?, model = ?, year = ?, category = ?, price_daily = ?, price_weekend = ?,
        price_weekly = ?, price_monthly = ?, security_deposit = ?, mileage_limit = ?,
        extra_km_rate = ?, seats = ?, doors = ?, transmission = ?, fuel_type = ?,
        ac = ?, features = ?, images = ?, locations = ?, status = ?, rating = ?,
        review_count = ?, is_featured = ?, is_popular = ?, license_plate = ?,
        description = ?, image = ?, pricePerDay = ?, fuel = ?, popular = ?, available = ?,
        updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(
      updatedModel.brand, updatedModel.model, updatedModel.year, updatedModel.category,
      updatedModel.price_daily, updatedModel.price_weekend, updatedModel.price_weekly,
      updatedModel.price_monthly, updatedModel.security_deposit, updatedModel.mileage_limit,
      updatedModel.extra_km_rate, updatedModel.seats, updatedModel.doors, updatedModel.transmission,
      updatedModel.fuel_type, updatedModel.ac ? 1 : 0, JSON.stringify(updatedModel.features),
      JSON.stringify(updatedModel.images), JSON.stringify(updatedModel.locations),
      updatedModel.status, updatedModel.rating, updatedModel.review_count,
      updatedModel.is_featured ? 1 : 0, updatedModel.is_popular ? 1 : 0, updatedModel.license_plate,
      updatedModel.description, updatedModel.image, updatedModel.price_daily, updatedModel.fuel_type,
      updatedModel.is_popular ? 1 : 0, updatedModel.available ? 1 : 0, now, numericId
    )

    return await this.getVehicleById(numericId)
  },

  async deleteVehicle(id) {
    await ensureReady()
    checkConnection()

    const numericId = Number(id)
    const existing = await this.getVehicleById(numericId)
    if (!existing) return null

    if (activeEngine === 'postgres') {
      await pgPool.query('DELETE FROM vehicles WHERE id = $1', [numericId])
    } else {
      sqliteDb.prepare('DELETE FROM vehicles WHERE id = ?').run(numericId)
    }
    return existing
  },

  async deleteAllVehicles() {
    await ensureReady()
    checkConnection()

    if (activeEngine === 'postgres') {
      const res = await pgPool.query('DELETE FROM vehicles RETURNING id;')
      return { success: true, deletedCount: res.rowCount }
    }
    const countRow = sqliteDb.prepare('SELECT COUNT(*) as count FROM vehicles').get()
    const deletedCount = countRow ? Number(countRow.count) : 0
    sqliteDb.prepare('DELETE FROM vehicles').run()
    return { success: true, deletedCount }
  },

  // --- UNAVAILABILITY & BLACKOUT BLOCKS ---
  async getUnavailabilityBlocks(vehicleId) {
    await ensureReady()
    checkConnection()

    const vId = Number(vehicleId)
    if (activeEngine === 'postgres') {
      const res = await pgPool.query(
        'SELECT * FROM vehicle_unavailability WHERE vehicle_id = $1 ORDER BY start_date ASC',
        [vId]
      )
      return res.rows.map((r) => new VehicleUnavailability(r).toJSON())
    }
    const rows = sqliteDb.prepare(
      'SELECT * FROM vehicle_unavailability WHERE vehicle_id = ? ORDER BY start_date ASC'
    ).all(vId)
    return rows.map((r) => new VehicleUnavailability(r).toJSON())
  },

  async createUnavailabilityBlock(blockData) {
    await ensureReady()
    checkConnection()

    const block = new VehicleUnavailability(blockData)
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const res = await pgPool.query(`
        INSERT INTO vehicle_unavailability (vehicle_id, start_date, end_date, reason, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `, [block.vehicle_id, block.start_date, block.end_date, block.reason, block.notes, now])
      return new VehicleUnavailability(res.rows[0]).toJSON()
    }

    const stmt = sqliteDb.prepare(`
      INSERT INTO vehicle_unavailability (vehicle_id, start_date, end_date, reason, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(block.vehicle_id, block.start_date, block.end_date, block.reason, block.notes, now)
    block.id = Number(result.lastInsertRowid)
    return block.toJSON()
  },

  async deleteUnavailabilityBlock(blockId) {
    await ensureReady()
    checkConnection()

    const bId = Number(blockId)
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('DELETE FROM vehicle_unavailability WHERE id = $1 RETURNING *;', [bId])
      return res.rows[0] ? new VehicleUnavailability(res.rows[0]).toJSON() : null
    }
    const row = sqliteDb.prepare('SELECT * FROM vehicle_unavailability WHERE id = ?').get(bId)
    if (!row) return null
    sqliteDb.prepare('DELETE FROM vehicle_unavailability WHERE id = ?').run(bId)
    return new VehicleUnavailability(row).toJSON()
  },

  // --- LOCATIONS ---
  async getLocations() {
    await ensureReady()
    checkConnection()

    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM locations ORDER BY name ASC')
      return res.rows.map(formatPgLocation)
    }
    const rows = sqliteDb.prepare('SELECT * FROM locations ORDER BY name ASC').all()
    return rows.map(formatSqliteLocation)
  },

  async getLocationById(id) {
    await ensureReady()
    checkConnection()

    const stringId = String(id)
    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM locations WHERE id = $1 OR slug = $1', [stringId])
      return formatPgLocation(res.rows[0])
    }
    const row = sqliteDb.prepare('SELECT * FROM locations WHERE id = ? OR slug = ?').get(stringId, stringId)
    return formatSqliteLocation(row)
  },

  async createLocation(data) {
    await ensureReady()
    checkConnection()

    const loc = new Location(data)
    const now = new Date().toISOString()
    const stringId = String(loc.id || `loc_${Date.now()}`)
    loc.id = stringId

    if (activeEngine === 'postgres') {
      const query = `
        INSERT INTO locations (
          id, name, slug, address, description, is_active, pickup_available, return_available,
          delivery_fee, phone, whatsapp_number, coordinates, zone, lat, lng, active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          pickup_available = EXCLUDED.pickup_available,
          return_available = EXCLUDED.return_available,
          delivery_fee = EXCLUDED.delivery_fee,
          phone = EXCLUDED.phone,
          whatsapp_number = EXCLUDED.whatsapp_number,
          coordinates = EXCLUDED.coordinates,
          zone = EXCLUDED.zone,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          active = EXCLUDED.active,
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `
      const res = await pgPool.query(query, [
        stringId, loc.name, loc.slug, loc.address, loc.description,
        loc.is_active, loc.pickup_available, loc.return_available, loc.delivery_fee,
        loc.phone, loc.whatsapp_number, JSON.stringify(loc.coordinates),
        loc.zone, loc.lat, loc.lng, loc.is_active, now, now
      ])
      return formatPgLocation(res.rows[0])
    }

    sqliteDb.prepare(`
      INSERT OR REPLACE INTO locations (
        id, name, slug, address, description, is_active, pickup_available, return_available,
        delivery_fee, phone, whatsapp_number, coordinates, zone, lat, lng, active, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      stringId, loc.name, loc.slug, loc.address, loc.description,
      loc.is_active ? 1 : 0, loc.pickup_available ? 1 : 0, loc.return_available ? 1 : 0,
      loc.delivery_fee, loc.phone, loc.whatsapp_number, JSON.stringify(loc.coordinates),
      loc.zone, loc.lat, loc.lng, loc.is_active ? 1 : 0, now, now
    )

    return await this.getLocationById(stringId)
  },

  async updateLocation(id, data) {
    await ensureReady()
    checkConnection()

    const stringId = String(id)
    const existing = await this.getLocationById(stringId)
    if (!existing) return null

    const updated = new Location({ ...existing, ...data, id: stringId })
    const now = new Date().toISOString()

    if (activeEngine === 'postgres') {
      const res = await pgPool.query(`
        UPDATE locations SET
          name = $1, slug = $2, address = $3, description = $4, is_active = $5,
          pickup_available = $6, return_available = $7, delivery_fee = $8, phone = $9,
          whatsapp_number = $10, coordinates = $11, zone = $12, lat = $13, lng = $14,
          active = $15, updated_at = $16
        WHERE id = $17
        RETURNING *;
      `, [
        updated.name, updated.slug, updated.address, updated.description, updated.is_active,
        updated.pickup_available, updated.return_available, updated.delivery_fee, updated.phone,
        updated.whatsapp_number, JSON.stringify(updated.coordinates), updated.zone, updated.lat,
        updated.lng, updated.is_active, now, stringId
      ])
      return formatPgLocation(res.rows[0])
    }

    sqliteDb.prepare(`
      UPDATE locations SET
        name = ?, slug = ?, address = ?, description = ?, is_active = ?,
        pickup_available = ?, return_available = ?, delivery_fee = ?, phone = ?,
        whatsapp_number = ?, coordinates = ?, zone = ?, lat = ?, lng = ?,
        active = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      updated.name, updated.slug, updated.address, updated.description,
      updated.is_active ? 1 : 0, updated.pickup_available ? 1 : 0, updated.return_available ? 1 : 0,
      updated.delivery_fee, updated.phone, updated.whatsapp_number, JSON.stringify(updated.coordinates),
      updated.zone, updated.lat, updated.lng, updated.is_active ? 1 : 0, now, stringId
    )

    return await this.getLocationById(stringId)
  },

  async deleteLocation(id) {
    await ensureReady()
    checkConnection()

    const stringId = String(id)
    const existing = await this.getLocationById(stringId)
    if (!existing) return null

    if (activeEngine === 'postgres') {
      await pgPool.query('DELETE FROM locations WHERE id = $1', [stringId])
    } else {
      sqliteDb.prepare('DELETE FROM locations WHERE id = ?').run(stringId)
    }
    return existing
  },

  // --- INQUIRIES ---
  async getInquiries() {
    await ensureReady()
    checkConnection()

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
    return rows.map((r) => ({ ...r, days: Number(r.days) || 1 }))
  },

  async createInquiry(data) {
    await ensureReady()
    checkConnection()

    const id = data.id || `inq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const inq = {
      id,
      name: String(data.name || 'Anonymous').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      carName: String(data.carName || data.car || 'General Inquiry').trim(),
      carId: data.carId ? String(data.carId) : null,
      pickupLocation: String(data.pickupLocation || 'Bangalore City').trim(),
      pickupDate: String(data.pickupDate || ''),
      returnDate: String(data.returnDate || ''),
      days: Number(data.days) || 1,
      estimatedTotal: String(data.estimatedTotal || '—'),
      message: String(data.message || '').trim(),
      status: String(data.status || 'New').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    if (activeEngine === 'postgres') {
      const query = `
        INSERT INTO inquiries (
          id, name, phone, email, car_name, car_id, pickup_location, pickup_date,
          return_date, days, estimated_total, message, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *;
      `
      await pgPool.query(query, [
        inq.id, inq.name, inq.phone, inq.email, inq.carName, inq.carId, inq.pickupLocation,
        inq.pickupDate, inq.returnDate, inq.days, inq.estimatedTotal, inq.message, inq.status,
        inq.createdAt, inq.updatedAt,
      ])
      return inq
    }

    sqliteDb.prepare(`
      INSERT INTO inquiries (
        id, name, phone, email, carName, carId, pickupLocation, pickupDate,
        returnDate, days, estimatedTotal, message, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      inq.id, inq.name, inq.phone, inq.email, inq.carName, inq.carId, inq.pickupLocation,
      inq.pickupDate, inq.returnDate, inq.days, inq.estimatedTotal, inq.message, inq.status,
      inq.createdAt, inq.updatedAt
    )
    return inq
  },

  async updateInquiry(id, data) {
    await ensureReady()
    checkConnection()

    const now = new Date().toISOString()
    if (activeEngine === 'postgres') {
      const res = await pgPool.query(
        'UPDATE inquiries SET status = $1, message = $2, updated_at = $3 WHERE id = $4 RETURNING *;',
        [data.status || 'New', data.message || '', now, id]
      )
      return res.rows[0] || null
    }

    const existing = sqliteDb.prepare('SELECT * FROM inquiries WHERE id = ?').get(id)
    if (!existing) return null

    sqliteDb.prepare('UPDATE inquiries SET status = ?, message = ?, updatedAt = ? WHERE id = ?').run(
      data.status || existing.status, data.message || existing.message, now, id
    )
    return sqliteDb.prepare('SELECT * FROM inquiries WHERE id = ?').get(id)
  },

  async deleteInquiry(id) {
    await ensureReady()
    checkConnection()

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
    checkConnection()

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
    checkConnection()

    if (activeEngine === 'postgres') {
      const res = await pgPool.query('SELECT * FROM bookings ORDER BY created_at DESC')
      return res.rows
    }
    return sqliteDb.prepare('SELECT * FROM bookings ORDER BY createdAt DESC').all()
  },

  async getBookingsForVehicle(vehicleId) {
    await ensureReady()
    checkConnection()

    const vId = String(vehicleId)
    if (activeEngine === 'postgres') {
      const res = await pgPool.query(
        'SELECT * FROM bookings WHERE car_id = $1 ORDER BY pickup_date ASC',
        [vId]
      )
      return res.rows
    }
    return sqliteDb.prepare(
      'SELECT * FROM bookings WHERE carId = ? ORDER BY pickupDate ASC'
    ).all(vId)
  },

  async createBooking(data) {
    await ensureReady()
    checkConnection()

    const id = data.id || data.bookingId || `DRV-BLR-${Date.now().toString().slice(-6)}`
    const booking = {
      id,
      booking_id: data.bookingId || id,
      bookingId: data.bookingId || id,
      status: data.status || 'CONFIRMED',
      payment_status: data.paymentStatus || 'PAID',
      paymentStatus: data.paymentStatus || 'PAID',
      payment_method: data.paymentMethod || 'RAZORPAY',
      paymentMethod: data.paymentMethod || 'RAZORPAY',
      razorpay_order_id: data.razorpay_order_id || '',
      razorpay_payment_id: data.razorpay_payment_id || '',
      razorpay_signature: data.razorpay_signature || '',
      amount_paid: Number(data.amountPaid || data.amount_paid) || 0,
      amountPaid: Number(data.amountPaid || data.amount_paid) || 0,
      car_id: String(data.carId || data.car_id || ''),
      carId: String(data.carId || data.car_id || ''),
      car_name: String(data.carName || data.car_name || ''),
      carName: String(data.carName || data.car_name || ''),
      customer_name: String(data.customerName || data.customer_name || ''),
      customerName: String(data.customerName || data.customer_name || ''),
      customer_phone: String(data.customerPhone || data.customer_phone || ''),
      customerPhone: String(data.customerPhone || data.customer_phone || ''),
      customer_email: String(data.customerEmail || data.customer_email || ''),
      customerEmail: String(data.customerEmail || data.customer_email || ''),
      pickup_date: String(data.pickupDate || data.pickup_date || ''),
      pickupDate: String(data.pickupDate || data.pickup_date || ''),
      return_date: String(data.returnDate || data.return_date || ''),
      returnDate: String(data.returnDate || data.return_date || ''),
      pickup_location: String(data.pickupLocation || data.pickup_location || ''),
      pickupLocation: String(data.pickupLocation || data.pickup_location || ''),
      days: Number(data.days) || 1,
      need_chauffeur: Boolean(data.needChauffeur || data.need_chauffeur),
      needChauffeur: Boolean(data.needChauffeur || data.need_chauffeur),
      special_requests: String(data.specialRequests || data.special_requests || ''),
      specialRequests: String(data.specialRequests || data.special_requests || ''),
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    }

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
        booking.id, booking.booking_id, booking.status, booking.payment_status, booking.payment_method,
        booking.razorpay_order_id, booking.razorpay_payment_id, booking.razorpay_signature,
        booking.amount_paid, booking.car_id, booking.car_name, booking.customer_name, booking.customer_phone,
        booking.customer_email, booking.pickup_date, booking.return_date, booking.pickup_location,
        booking.days, booking.need_chauffeur, booking.special_requests, booking.created_at, booking.verified_at,
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
      booking.id, booking.bookingId, booking.status, booking.paymentStatus, booking.paymentMethod,
      booking.razorpay_order_id, booking.razorpay_payment_id, booking.razorpay_signature,
      booking.amountPaid, booking.carId, booking.carName, booking.customerName, booking.customerPhone,
      booking.customerEmail, booking.pickupDate, booking.returnDate, booking.pickupLocation,
      booking.days, booking.needChauffeur ? 1 : 0, booking.specialRequests, booking.createdAt, booking.verifiedAt
    )

    return booking
  },

  // --- SESSIONS ---
  async getSession(token) {
    await ensureReady()
    checkConnection()

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
        user: { username: row.username, role: row.role, name: row.name },
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
      user: { username: row.username, role: row.role, name: row.name },
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    }
  },

  async saveSession(session) {
    await ensureReady()
    checkConnection()

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
    checkConnection()

    if (!token) return

    if (activeEngine === 'postgres') {
      await pgPool.query('DELETE FROM admin_sessions WHERE token = $1', [token])
    } else {
      sqliteDb.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token)
    }
  },
}

export default appDb
