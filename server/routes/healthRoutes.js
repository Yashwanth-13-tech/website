import express from 'express'
import appDb from '../config/database.js'

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
  const counts = await appDb.getCounts()

  return res.status(200).json({
    status: isDbHealthy ? 'healthy' : 'degraded',
    service: 'BLR CRUIZ Express API',
    database: isDbHealthy ? 'connected' : 'error',
    engine: appDb.engine,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    port: process.env.PORT || 5000,
    razorpayConfigured,
    razorpayMode: keyId.startsWith('rzp_live') ? 'live' : 'test',
    counts,
  })
})

export default router
