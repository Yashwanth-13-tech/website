import cors from 'cors'

// CORS configuration supporting Vercel previews, production domains, and localhost
const allowedOrigins = [
  'https://blrcruiz.in',
  'https://www.blrcruiz.in',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]

if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach((url) => {
    const trimmed = url.trim().replace(/\/+$/, '')
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed)
    }
  })
}

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (server-to-server, health checks, curl, mobile apps)
    if (!origin) return callback(null, true)

    // Check exact allowed domains
    if (allowedOrigins.includes(origin)) return callback(null, true)

    // Allow all *.vercel.app preview and production domains
    if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(origin)) return callback(null, true)

    // In non-production or if FRONTEND_URL is '*', allow
    if (process.env.NODE_ENV !== 'production' || process.env.FRONTEND_URL === '*') {
      return callback(null, true)
    }

    return callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}

export const corsMiddleware = cors(corsOptions)
export default corsMiddleware
