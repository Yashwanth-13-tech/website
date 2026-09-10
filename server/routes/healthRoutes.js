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
  const isStorageConfigured = supabaseStorage.isConfigured

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

  const storageStatus = isStorageConfigured
    ? 'supabase'
    : (isProduction ? 'unconfigured' : 'local-inline')

  return res.status(statusCode).json({
    status: isHealthy ? (isStorageConfigured ? 'healthy' : 'healthy') : 'unhealthy',
    service: 'BLR CRUIZ Express API',
    database: isDbHealthy ? 'connected' : 'disconnected',
    engine: appDb.engine,
    storage: storageStatus,
    storageBucket: supabaseStorage.bucketName,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    port: Number(process.env.PORT) || 5000,
    razorpayConfigured,
    razorpayMode: keyId.startsWith('rzp_live') ? 'live' : 'test',
    counts,
    ...(isHealthy ? {} : {
      error: isProduction && appDb.engine !== 'postgres'
        ? 'PostgreSQL is required in production. Please configure DATABASE_URL in Render Dashboard.'
        : (appDb.dbError || 'Database connection check failed.'),
    }),
    ...(!isStorageConfigured && isProduction ? {
      storageNotice: 'Supabase Storage is unconfigured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render Environment to activate storage: supabase.',
    } : {}),
  })
})

export default router
