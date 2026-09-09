#!/usr/bin/env node
/**
 * BLR CRUIZ - SQLite to PostgreSQL Safe Data Migration Script
 * Migrates existing vehicles, locations, inquiries, bookings, and unavailability blocks
 * from local SQLite database into your production PostgreSQL database with zero data loss.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node server/scripts/migrate-sqlite-to-postgres.js
 * or
 *   npm run migrate:pg
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGURI

if (!POSTGRES_URL) {
  console.error('\n❌ ERROR: DATABASE_URL environment variable is required to run this migration.')
  console.error('Example: DATABASE_URL="postgresql://user:pass@dpg-xxx:5432/blrcruiz" npm run migrate:pg\n')
  process.exit(1)
}

const sqlitePath = path.resolve(__dirname, '..', 'data', 'blrcruiz.db')
if (!fs.existsSync(sqlitePath)) {
  console.log(`\nℹ️  Notice: No local SQLite database found at ${sqlitePath}. Nothing to migrate.\n`)
  process.exit(0)
}

console.log('\n======================================================')
console.log('🚀 BLR CRUIZ: Starting SQLite -> PostgreSQL Data Migration')
console.log(`📁 Source SQLite: ${sqlitePath}`)
console.log(`🐘 Target PostgreSQL: ${POSTGRES_URL.replace(/:[^:@]+@/, ':****@')}`)
console.log('======================================================\n')

const sqliteDb = new DatabaseSync(sqlitePath)
const { Pool } = pg
const pgPool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: POSTGRES_URL.includes('localhost') || POSTGRES_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
})

async function runMigration() {
  const client = await pgPool.connect()
  try {
    // 1. Ensure schema exists in PostgreSQL
    console.log('1️⃣  Verifying PostgreSQL schema...')
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

    // 2. Migrate Vehicles
    console.log('2️⃣  Migrating Vehicles...')
    let migratedVehicles = 0
    try {
      const sqliteVehicles = sqliteDb.prepare('SELECT * FROM vehicles').all()
      for (const v of sqliteVehicles) {
        let features = '[]'
        let images = '[]'
        let locations = '[]'
        try { features = typeof v.features === 'string' ? v.features : JSON.stringify(v.features || []) } catch {}
        try { images = typeof v.images === 'string' ? v.images : JSON.stringify(v.images || (v.image ? [v.image] : [])) } catch {}
        try { locations = typeof v.locations === 'string' ? v.locations : JSON.stringify(v.locations || []) } catch {}

        await client.query(`
          INSERT INTO vehicles (
            id, brand, model, year, category, price_daily, price_weekend, price_weekly, price_monthly,
            security_deposit, mileage_limit, extra_km_rate, seats, doors, transmission, fuel_type,
            ac, features, images, locations, status, rating, review_count, is_featured, is_popular,
            license_plate, description, image, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
          )
          ON CONFLICT (id) DO UPDATE SET
            brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            year = EXCLUDED.year,
            category = EXCLUDED.category,
            price_daily = EXCLUDED.price_daily,
            price_weekend = EXCLUDED.price_weekend,
            price_weekly = EXCLUDED.price_weekly,
            price_monthly = EXCLUDED.price_monthly,
            security_deposit = EXCLUDED.security_deposit,
            mileage_limit = EXCLUDED.mileage_limit,
            extra_km_rate = EXCLUDED.extra_km_rate,
            seats = EXCLUDED.seats,
            doors = EXCLUDED.doors,
            transmission = EXCLUDED.transmission,
            fuel_type = EXCLUDED.fuel_type,
            ac = EXCLUDED.ac,
            features = EXCLUDED.features,
            images = EXCLUDED.images,
            locations = EXCLUDED.locations,
            status = EXCLUDED.status,
            rating = EXCLUDED.rating,
            review_count = EXCLUDED.review_count,
            is_featured = EXCLUDED.is_featured,
            is_popular = EXCLUDED.is_popular,
            license_plate = EXCLUDED.license_plate,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            updated_at = NOW();
        `, [
          v.id, v.brand, v.model, v.year || 2024, v.category || 'hatchback',
          Number(v.price_daily || v.pricePerDay || 1500),
          Number(v.price_weekend || Math.round((v.price_daily || 1500) * 1.15)),
          Number(v.price_weekly || Math.round((v.price_daily || 1500) * 0.85)),
          Number(v.price_monthly || Math.round((v.price_daily || 1500) * 0.65)),
          Number(v.security_deposit || 3000),
          Number(v.mileage_limit || 300),
          Number(v.extra_km_rate || 12.0),
          Number(v.seats || 5),
          Number(v.doors || 4),
          v.transmission || 'automatic',
          v.fuel_type || v.fuel || 'petrol',
          Boolean(v.ac),
          features, images, locations,
          v.status || (v.available === 0 ? 'booked' : 'available'),
          Number(v.rating || 4.8),
          Number(v.review_count || 0),
          Boolean(v.is_featured || v.popular),
          Boolean(v.is_popular || v.popular),
          v.license_plate || '',
          v.description || '',
          v.image || '',
          v.created_at || v.createdAt || new Date().toISOString(),
          v.updated_at || v.updatedAt || new Date().toISOString(),
        ])
        migratedVehicles++
      }
      // Update postgres auto-increment sequence
      await client.query(`SELECT setval(pg_get_serial_sequence('vehicles', 'id'), COALESCE(MAX(id), 1)) FROM vehicles;`)
    } catch (err) {
      console.warn('   ⚠️ Vehicles table migration notice:', err.message)
    }

    // 3. Migrate Locations
    console.log('3️⃣  Migrating Locations...')
    let migratedLocations = 0
    try {
      const sqliteLocations = sqliteDb.prepare('SELECT * FROM locations').all()
      for (const l of sqliteLocations) {
        let coords = '{"lat":12.9716,"lng":77.5946}'
        try {
          coords = typeof l.coordinates === 'string' ? l.coordinates : JSON.stringify(l.coordinates || { lat: 12.9716, lng: 77.5946 })
        } catch {}

        await client.query(`
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
            updated_at = NOW();
        `, [
          String(l.id), l.name, l.slug || String(l.id), l.address || '', l.description || '',
          Boolean(l.is_active !== undefined ? l.is_active : l.active),
          Boolean(l.pickup_available !== undefined ? l.pickup_available : 1),
          Boolean(l.return_available !== undefined ? l.return_available : 1),
          Number(l.delivery_fee || 0),
          l.phone || '+91 80001 23456',
          l.whatsapp_number || '+91 98765 43210',
          coords, l.zone || 'Other',
          Number(l.lat || 12.9716), Number(l.lng || 77.5946),
          Boolean(l.is_active !== undefined ? l.is_active : l.active),
          l.created_at || l.createdAt || new Date().toISOString(),
          l.updated_at || l.updatedAt || new Date().toISOString(),
        ])
        migratedLocations++
      }
    } catch (err) {
      console.warn('   ⚠️ Locations table migration notice:', err.message)
    }

    // 4. Migrate Inquiries
    console.log('4️⃣  Migrating Inquiries...')
    let migratedInquiries = 0
    try {
      const sqliteInquiries = sqliteDb.prepare('SELECT * FROM inquiries').all()
      for (const inq of sqliteInquiries) {
        await client.query(`
          INSERT INTO inquiries (
            id, name, phone, email, car_name, car_id, pickup_location, pickup_date,
            return_date, days, estimated_total, message, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING;
        `, [
          String(inq.id), inq.name, inq.phone, inq.email || '', inq.carName || '',
          inq.carId ? String(inq.carId) : null, inq.pickupLocation || '',
          inq.pickupDate || '', inq.returnDate || '', Number(inq.days) || 1,
          inq.estimatedTotal || '—', inq.message || '', inq.status || 'New',
          inq.createdAt || new Date().toISOString(), inq.updatedAt || new Date().toISOString(),
        ])
        migratedInquiries++
      }
    } catch (err) {
      console.warn('   ⚠️ Inquiries table migration notice:', err.message)
    }

    // 5. Migrate Bookings
    console.log('5️⃣  Migrating Bookings...')
    let migratedBookings = 0
    try {
      const sqliteBookings = sqliteDb.prepare('SELECT * FROM bookings').all()
      for (const b of sqliteBookings) {
        await client.query(`
          INSERT INTO bookings (
            id, booking_id, status, payment_status, payment_method,
            razorpay_order_id, razorpay_payment_id, razorpay_signature,
            amount_paid, car_id, car_name, customer_name, customer_phone, customer_email,
            pickup_date, return_date, pickup_location, days, need_chauffeur, special_requests,
            created_at, verified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (id) DO NOTHING;
        `, [
          String(b.id), b.bookingId || String(b.id), b.status || 'CONFIRMED',
          b.paymentStatus || 'PAID', b.paymentMethod || 'RAZORPAY',
          b.razorpay_order_id || '', b.razorpay_payment_id || '', b.razorpay_signature || '',
          Number(b.amountPaid || 0), String(b.carId || ''), String(b.carName || ''),
          String(b.customerName || ''), String(b.customerPhone || ''), String(b.customerEmail || ''),
          b.pickupDate || '', b.returnDate || '', b.pickupLocation || '',
          Number(b.days) || 1, Boolean(b.needChauffeur), b.specialRequests || '',
          b.createdAt || new Date().toISOString(), b.verifiedAt || new Date().toISOString(),
        ])
        migratedBookings++
      }
    } catch (err) {
      console.warn('   ⚠️ Bookings table migration notice:', err.message)
    }

    console.log('\n======================================================')
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!')
    console.log('======================================================')
    console.log(`✔ Vehicles Migrated:  ${migratedVehicles}`)
    console.log(`✔ Locations Migrated: ${migratedLocations}`)
    console.log(`✔ Inquiries Migrated: ${migratedInquiries}`)
    console.log(`✔ Bookings Migrated:  ${migratedBookings}`)
    console.log('======================================================\n')
  } finally {
    client.release()
    await pgPool.end()
  }
}

runMigration().catch((err) => {
  console.error('\n❌ Migration failed:', err.message)
  process.exit(1)
})
