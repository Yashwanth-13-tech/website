import express from 'express'
import appDb from '../config/database.js'
import supabaseStorage from '../services/supabaseStorage.js'

const router = express.Router()

router.get('/health', async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET || ''
  const razorpayConfigured = Boolean(
    keyId &&
    keySecret &&
    keyId.startsWith('rzp_') &&
    !keyId.includes('your_') &&
    !keySecret.includes('your_')
  )

  const isDbHealthy = await appDb.isHealthy()
  const isProduction = process.env.NODE_ENV === 'production'

  // In production, database must be healthy and engine must be postgres
  const isHealthy = isDbHealthy && (!isProduction || appDb.engine === 'postgres')
  const statusCode = isHealthy ? 200 : 503

  let counts = null
  if (isDbHealthy) {
    try {
      counts = await appDb.getCounts()
    } catch {
      counts = null
    }
  }

  return res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'BLR CRUIZ Express API',
    database: isDbHealthy ? 'connected' : 'disconnected',
    engine: appDb.engine,
    storage: supabaseStorage.isConfigured ? 'supabase' : 'local-inline',
    storageBucket: supabaseStorage.bucketName,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 5000,
    razorpayConfigured,
    razorpayMode: keyId.startsWith('rzp_live') ? 'live' : 'test',
    counts,
    ...(isHealthy ? {} : {
      error: isProduction && appDb.engine !== 'postgres'
        ? 'PostgreSQL is required in production. Please configure DATABASE_URL in Render Dashboard.'
        : (appDb.dbError || 'Database connection check failed.'),
    }),
  })
})

export default router
