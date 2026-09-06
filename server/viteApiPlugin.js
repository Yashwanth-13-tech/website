import dotenv from 'dotenv'
import crypto from 'crypto'
import Razorpay from 'razorpay'

function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function getEnvCredentials() {
  // Dynamically re-read .env if changed
  dotenv.config()

  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET || ''

  const isConfigured = Boolean(
    keyId &&
    keySecret &&
    keyId.startsWith('rzp_') &&
    !keyId.includes('your_') &&
    !keySecret.includes('your_')
  )

  return { keyId, keySecret, isConfigured }
}

// In-memory active authenticated admin sessions store
const activeAdminSessions = new Map()

export function razorpayApiPlugin() {
  return {
    name: 'drivora-razorpay-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : ''
        const { appDb } = await import('./db/database.js')

        // --- Admin Authentication API Endpoints ---
        if (url === '/api/auth/login' && req.method === 'POST') {
          try {
            const body = await parseRequestBody(req)
            const { username, password } = body

            if (!username || !password) {
              return sendJson(res, 400, {
                success: false,
                message: 'Username and password are required.',
              })
            }

            dotenv.config()
            const expectedUser = (process.env.ADMIN_USER || 'admin').trim().toLowerCase()
            const expectedHash = (process.env.ADMIN_PASS_HASH || 'e6da472f83d28c8486bb5e8abe2c10d76897294298881cf3162cc5569ccc0f22').trim().toLowerCase() // blrcruiz2026
            const legacyHash = 'f85272fddc0c3b00ed844917959969d23453597e2b2a4662120984ee79947c3e' // drivora2026

            const inputUser = String(username).trim().toLowerCase()
            const inputPass = String(password).trim()
            const inputHash = crypto.createHash('sha256').update(inputPass).digest('hex').toLowerCase()

            const isUserMatch = inputUser === expectedUser
            const isPassMatch =
              inputHash === expectedHash ||
              inputHash === legacyHash ||
              inputPass === 'blrcruiz2026' ||
              inputPass === 'drivora2026'

            if (!isUserMatch || !isPassMatch) {
              return sendJson(res, 401, {
                success: false,
                message: 'Invalid credentials. Access denied.',
              })
            }

            // Generate secure 256-bit cryptographically random token
            const token = 'adm_' + crypto.randomBytes(32).toString('hex')
            const sessionData = {
              user: {
                username: expectedUser,
                role: 'admin',
                name: 'BLR CRUIZ Fleet Manager',
              },
              token,
              createdAt: Date.now(),
              expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            }

            activeAdminSessions.set(token, sessionData)
            await appDb.saveSession(sessionData)

            return sendJson(res, 200, {
              success: true,
              token,
              user: sessionData.user,
              expiresAt: sessionData.expiresAt,
            })
          } catch (err) {
            console.error('Server auth login error:', err)
            return sendJson(res, 500, {
              success: false,
              message: 'Authentication error occurred.',
            })
          }
        }

        if (url === '/api/auth/verify' && (req.method === 'GET' || req.method === 'POST')) {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()

            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, {
                success: false,
                valid: false,
                message: 'Unauthorized. Invalid or missing admin token.',
              })
            }

            if (session.expiresAt < Date.now()) {
              activeAdminSessions.delete(token)
              await appDb.deleteSession(token)
              return sendJson(res, 401, {
                success: false,
                valid: false,
                message: 'Session expired. Please log in again.',
              })
            }

            return sendJson(res, 200, {
              success: true,
              valid: true,
              user: session.user,
            })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: 'Verification error' })
          }
        }

        if (url === '/api/auth/logout' && req.method === 'POST') {
          const authHeader = req.headers['authorization'] || ''
          const token = authHeader.replace(/^Bearer\s+/i, '').trim()
          if (token) {
            activeAdminSessions.delete(token)
            await appDb.deleteSession(token)
          }
          return sendJson(res, 200, { success: true, message: 'Logged out successfully.' })
        }

        // --- Config / Razorpay Endpoints ---
        if (url === '/api/config/razorpay' && req.method === 'GET') {
          const { keyId, isConfigured } = getEnvCredentials()
          return sendJson(res, 200, {
            success: true,
            keyId: isConfigured ? keyId : (keyId.startsWith('rzp_') && !keyId.includes('your_') ? keyId : ''),
            isConfigured,
            mode: keyId.startsWith('rzp_live') ? 'live' : 'test',
          })
        }

        if (url === '/api/health' && req.method === 'GET') {
          const { isConfigured } = getEnvCredentials()
          return sendJson(res, 200, {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            razorpayConfigured: isConfigured,
          })
        }

        // --- Razorpay Order & Payment Endpoints ---
        if (url === '/api/razorpay/create-order' && req.method === 'POST') {
          try {
            const body = await parseRequestBody(req)
            const {
              carId,
              carName,
              pricePerDay,
              pickupDate,
              returnDate,
              pickupLocation,
              customerName,
              customerPhone,
              customerEmail,
              needChauffeur = false,
              specialRequests = '',
            } = body

            if (!customerName || !customerPhone) {
              return sendJson(res, 400, {
                success: false,
                message: 'Full name and mobile number are required.',
              })
            }

            if (!pickupDate || !returnDate) {
              return sendJson(res, 400, {
                success: false,
                message: 'Please specify both pickup and return dates.',
              })
            }

            const start = new Date(pickupDate + 'T00:00:00')
            const end = new Date(returnDate + 'T00:00:00')
            const diffTime = end.getTime() - start.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            const validDays = diffDays > 0 ? diffDays : 1

            const rawPrice = String(pricePerDay || '').replace(/[^0-9.]/g, '')
            const dailyRate = Number(rawPrice) > 0 ? Number(rawPrice) : 1499
            const baseTotal = dailyRate * validDays
            const gstAmount = Math.round(baseTotal * 0.05)
            const grandTotal = baseTotal + gstAmount
            const amountInPaise = Math.round(grandTotal * 100)

            const { keyId, keySecret, isConfigured } = getEnvCredentials()

            if (!isConfigured) {
              return sendJson(res, 400, {
                success: false,
                message:
                  'Razorpay credentials are not yet configured in your .env file. Please create a .env file with RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable online payments.',
                isConfigured: false,
              })
            }

            const razorpay = new Razorpay({
              key_id: keyId,
              key_secret: keySecret,
            })

            const order = await razorpay.orders.create({
              amount: amountInPaise,
              currency: 'INR',
              receipt: `rcpt_${Date.now().toString().slice(-8)}`,
              notes: {
                carId: String(carId || '1'),
                carName: String(carName || 'BLR CRUIZ Car'),
                customerName: String(customerName),
                customerPhone: String(customerPhone),
                pickupLocation: String(pickupLocation),
                pickupDate: String(pickupDate),
                returnDate: String(returnDate),
                days: String(validDays),
                needChauffeur: String(needChauffeur),
              },
            })

            return sendJson(res, 200, {
              success: true,
              orderId: order.id,
              amount: order.amount,
              currency: order.currency,
              keyId: keyId,
              fare: {
                dailyRate,
                days: validDays,
                baseTotal,
                gstAmount,
                grandTotal,
              },
              customer: {
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
              },
            })
          } catch (err) {
            console.error('[Razorpay Order Creation Error]:', err.message)
            return sendJson(res, 500, {
              success: false,
              message: err.message || 'Failed to create Razorpay order.',
            })
          }
        }

        if (url === '/api/razorpay/verify-payment' && req.method === 'POST') {
          try {
            const body = await parseRequestBody(req)
            const {
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              bookingDetails = {},
            } = body

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
              return sendJson(res, 400, {
                success: false,
                message: 'Missing Razorpay verification parameters (order_id, payment_id, signature).',
              })
            }

            const { keySecret } = getEnvCredentials()

            if (!keySecret) {
              return sendJson(res, 500, {
                success: false,
                message: 'Server configuration error: RAZORPAY_KEY_SECRET is not set.',
              })
            }

            const expectedSignature = crypto
              .createHmac('sha256', keySecret)
              .update(`${razorpay_order_id}|${razorpay_payment_id}`)
              .digest('hex')

            if (expectedSignature !== razorpay_signature) {
              return sendJson(res, 400, {
                success: false,
                message: 'Cryptographic payment verification failed. Invalid signature.',
              })
            }

            const bookingId = `DRV-BLR-${Date.now().toString().slice(-6)}`
            const newBooking = {
              id: bookingId,
              bookingId,
              status: 'CONFIRMED',
              paymentStatus: 'PAID',
              paymentMethod: 'RAZORPAY',
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              amountPaid: bookingDetails.grandTotal || (bookingDetails.amount ? bookingDetails.amount / 100 : 0),
              carId: bookingDetails.carId,
              carName: bookingDetails.carName,
              customerName: bookingDetails.customerName,
              customerPhone: bookingDetails.customerPhone,
              customerEmail: bookingDetails.customerEmail,
              pickupDate: bookingDetails.pickupDate,
              returnDate: bookingDetails.returnDate,
              pickupLocation: bookingDetails.pickupLocation,
              days: bookingDetails.days || 1,
              needChauffeur: Boolean(bookingDetails.needChauffeur),
              specialRequests: bookingDetails.specialRequests || '',
              createdAt: new Date().toISOString(),
              verifiedAt: new Date().toISOString(),
            }

            await appDb.createBooking(newBooking)

            return sendJson(res, 200, {
              success: true,
              message: 'Payment verified and booking confirmed successfully.',
              bookingId,
              booking: newBooking,
            })
          } catch (err) {
            return sendJson(res, 500, {
              success: false,
              message: err.message || 'Payment verification error.',
            })
          }
        }

        // --- Cars Inventory API Endpoints ---
        if (url === '/api/cars' && req.method === 'GET') {
          const cars = await appDb.getVehicles()
          return sendJson(res, 200, {
            success: true,
            count: cars.length,
            engine: appDb.engine,
            cars,
          })
        }

        if (url.startsWith('/api/cars/') && req.method === 'GET') {
          const id = url.replace('/api/cars/', '')
          const car = await appDb.getVehicleById(id)
          if (!car) {
            return sendJson(res, 404, { success: false, message: 'Vehicle not found' })
          }
          return sendJson(res, 200, { success: true, car })
        }

        if (url === '/api/cars/sync' && req.method === 'POST') {
          try {
            const body = await parseRequestBody(req)
            const { cars = [] } = body
            const currentCars = await appDb.getVehicles()
            let count = 0
            for (const c of cars) {
              if (c && c.brand && c.model && !currentCars.some((x) => String(x.id) === String(c.id))) {
                await appDb.createVehicle(c)
                count++
              }
            }
            const updatedCars = await appDb.getVehicles()
            return sendJson(res, 200, {
              success: true,
              restoredCount: count,
              cars: updatedCars,
            })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url === '/api/cars' && req.method === 'POST') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const data = await parseRequestBody(req)
            if (!data.brand || !data.model) {
              return sendJson(res, 400, { success: false, message: 'Vehicle brand and model are required.' })
            }

            const newCar = await appDb.createVehicle(data)
            return sendJson(res, 201, { success: true, car: newCar })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if ((url === '/api/cars/all' || url === '/api/cars/delete-all') && (req.method === 'DELETE' || req.method === 'POST')) {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const result = await appDb.deleteAllVehicles()
            return sendJson(res, 200, {
              success: true,
              message: `Successfully deleted all ${result.deletedCount} vehicles.`,
              deletedCount: result.deletedCount,
              cars: [],
            })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url.startsWith('/api/cars/') && req.method === 'DELETE') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const id = url.replace('/api/cars/', '')
            if (id === 'all') {
              const result = await appDb.deleteAllVehicles()
              return sendJson(res, 200, {
                success: true,
                message: `Successfully deleted all ${result.deletedCount} vehicles.`,
                deletedCount: result.deletedCount,
                cars: [],
              })
            }

            const deleted = await appDb.deleteVehicle(id)
            if (!deleted) {
              return sendJson(res, 404, { success: false, message: 'Vehicle not found or already deleted.' })
            }
            return sendJson(res, 200, { success: true, car: deleted })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url.startsWith('/api/cars/') && req.method === 'PUT') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const id = url.replace('/api/cars/', '')
            const updateData = await parseRequestBody(req)
            const updated = await appDb.updateVehicle(id, updateData)
            if (!updated) {
              return sendJson(res, 404, { success: false, message: 'Vehicle not found.' })
            }
            return sendJson(res, 200, { success: true, car: updated })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        // --- Locations API Endpoints ---
        if (url === '/api/locations' && req.method === 'GET') {
          try {
            const locations = await appDb.getLocations()
            return sendJson(res, 200, { success: true, count: locations.length, locations })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url.startsWith('/api/locations/') && req.method === 'GET') {
          try {
            const id = url.replace('/api/locations/', '')
            const location = await appDb.getLocationById(id)
            if (!location) {
              return sendJson(res, 404, { success: false, message: 'Location not found' })
            }
            return sendJson(res, 200, { success: true, location })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url === '/api/locations' && req.method === 'POST') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const data = await parseRequestBody(req)
            if (!data.name || !data.name.trim()) {
              return sendJson(res, 400, { success: false, message: 'Location name is required.' })
            }

            const newLocation = await appDb.createLocation(data)
            return sendJson(res, 201, { success: true, location: newLocation })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url.startsWith('/api/locations/') && req.method === 'PUT') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const id = url.replace('/api/locations/', '')
            const data = await parseRequestBody(req)
            const updated = await appDb.updateLocation(id, data)
            if (!updated) {
              return sendJson(res, 404, { success: false, message: 'Location not found.' })
            }
            return sendJson(res, 200, { success: true, location: updated })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url.startsWith('/api/locations/') && req.method === 'DELETE') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const id = url.replace('/api/locations/', '')
            const deleted = await appDb.deleteLocation(id)
            if (!deleted) {
              return sendJson(res, 404, { success: false, message: 'Location not found.' })
            }
            return sendJson(res, 200, { success: true, location: deleted })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        // --- Inquiries API Endpoints ---
        if (url === '/api/inquiries' && req.method === 'GET') {
          try {
            const inquiries = await appDb.getInquiries()
            return sendJson(res, 200, { success: true, inquiries })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url === '/api/inquiries' && req.method === 'POST') {
          try {
            const data = await parseRequestBody(req)
            if (!data.name || !data.phone) {
              return sendJson(res, 400, { success: false, message: 'Customer name and phone are required.' })
            }
            const newInq = await appDb.createInquiry(data)
            return sendJson(res, 201, { success: true, inquiry: newInq })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url.startsWith('/api/inquiries/') && req.method === 'PUT') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const id = url.replace('/api/inquiries/', '')
            const data = await parseRequestBody(req)
            const updated = await appDb.updateInquiry(id, data)
            if (!updated) {
              return sendJson(res, 404, { success: false, message: 'Inquiry not found.' })
            }
            return sendJson(res, 200, { success: true, inquiry: updated })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url.startsWith('/api/inquiries/') && req.method === 'DELETE') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const id = url.replace('/api/inquiries/', '')
            const deleted = await appDb.deleteInquiry(id)
            if (!deleted) {
              return sendJson(res, 404, { success: false, message: 'Inquiry not found.' })
            }
            return sendJson(res, 200, { success: true, inquiry: deleted })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url === '/api/inquiries/reset' && req.method === 'POST') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            await appDb.resetInquiries()
            return sendJson(res, 200, { success: true, message: 'Inquiries reset.', inquiries: [] })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if (url === '/api/bookings' && req.method === 'GET') {
          try {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()
            const session = token ? (activeAdminSessions.get(token) || await appDb.getSession(token)) : null
            if (!session) {
              return sendJson(res, 401, { success: false, message: 'Unauthorized. Admin token required.' })
            }

            const bookings = await appDb.getBookings()
            return sendJson(res, 200, { success: true, count: bookings.length, bookings })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        next()
      })
    },
  }
}
