import express from 'express'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 1. Load environment variables
dotenv.config()

// 2. Import middleware & database
import { corsMiddleware } from './middleware/corsMiddleware.js'
import { errorHandler } from './middleware/errorMiddleware.js'
import appDb from './config/database.js'

// 3. Import modular route handlers
import authRoutes from './routes/authRoutes.js'
import vehicleRoutes from './routes/vehicleRoutes.js'
import locationRoutes from './routes/locationRoutes.js'
import inquiryRoutes from './routes/inquiryRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import healthRoutes from './routes/healthRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000
const HOST = '0.0.0.0'

// --- Core Middlewares ---
app.use(corsMiddleware)
app.use(express.json({ limit: '15mb' }))
app.use(express.urlencoded({ extended: true, limit: '15mb' }))

// Ensure all /api responses declare application/json header
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json')
  next()
})

// --- Mount Modular API Endpoints ---
app.use('/api/auth', authRoutes)
app.use('/api/cars', vehicleRoutes)
app.use('/api/locations', locationRoutes)
app.use('/api/inquiries', inquiryRoutes)
app.use('/api', paymentRoutes)
app.use('/api', healthRoutes)
app.use('/', healthRoutes) // exposes /health at root for Render health check pings

// --- Static Assets & SEO ---
const DIST_DIR = path.resolve(__dirname, '../dist')

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false }))
}

app.get('/robots.txt', (req, res) => {
  const distRobots = path.join(DIST_DIR, 'robots.txt')
  const publicRobots = path.resolve(__dirname, '../public/robots.txt')
  const target = fs.existsSync(distRobots) ? distRobots : publicRobots
  if (fs.existsSync(target)) {
    res.setHeader('Content-Type', 'text/plain')
    return res.sendFile(target)
  }
  return res.type('text/plain').send("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://blrcruiz.in/sitemap.xml\n")
})

app.get('/sitemap.xml', (req, res) => {
  const distSitemap = path.join(DIST_DIR, 'sitemap.xml')
  const publicSitemap = path.resolve(__dirname, '../public/sitemap.xml')
  const target = fs.existsSync(distSitemap) ? distSitemap : publicSitemap
  if (fs.existsSync(target)) {
    res.setHeader('Content-Type', 'application/xml')
    return res.sendFile(target)
  }
  return res.status(404).send('Sitemap not found')
})

// --- SPA Fallback & API 404 Handler ---
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    })
  }

  if (req.method === 'GET') {
    const indexPath = path.join(DIST_DIR, 'index.html')
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath)
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>BLR CRUIZ | Car Rental Bangalore</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #1e293b; padding: 2rem 2.5rem; border-radius: 1.5rem; border: 1px solid #334155; max-width: 500px; }
            h1 { color: #f97316; margin-bottom: 0.5rem; font-size: 1.5rem; }
            p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
            a { color: #f97316; font-weight: bold; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>BLR CRUIZ Server is Online</h1>
            <p>Express API is running. Building frontend assets...</p>
            <p><a href="/api/health">Check API Health &rarr;</a></p>
          </div>
        </body>
      </html>
    `)
  }

  next()
})

// --- Global Error Handler ---
app.use(errorHandler)

// --- Start Server ---
app.listen(PORT, HOST, () => {
  console.log(`[BLR CRUIZ Server] Running on http://${HOST}:${PORT}`)
  console.log(`[Database Engine] Active: ${appDb.engine.toUpperCase()}`)
  console.log(`[Environment] NODE_ENV: ${process.env.NODE_ENV || 'production'}`)
})

export default app
