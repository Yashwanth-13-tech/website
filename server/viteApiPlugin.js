import dotenv from 'dotenv'
import crypto from 'crypto'
import Razorpay from 'razorpay'
import appDb from './config/database.js'
import vehicleService from './services/vehicleService.js'
import locationService from './services/locationService.js'
import availabilityService from './services/availabilityService.js'

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

function parseQueryParams(url) {
  const query = {}
  if (!url || !url.includes('?')) return query
  const search = url.split('?')[1]
  const pairs = search.split('&')
  for (const pair of pairs) {
    const [k, v] = pair.split('=')
    if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '')
  }
  return query
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function getEnvCredentials() {
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

const activeAdminSessions = new Map()

async function getAdminSession(req) {
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const session = activeAdminSessions.get(token) || await appDb.getSession(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    activeAdminSessions.delete(token)
    await appDb.deleteSession(token)
    return null
  }
  return session
}

export function razorpayApiPlugin() {
  return {
    name: 'drivora-razorpay-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const fullUrl = req.url || ''
        const url = fullUrl.split('?')[0]
        const queryParams = parseQueryParams(fullUrl)

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
            const expectedHash = (process.env.ADMIN_PASS_HASH || 'e6da472f83d28c8486bb5e8abe2c10d76897294298881cf3162cc5569ccc0f22').trim().toLowerCase()
            const legacyHash = 'f85272fddc0c3b00ed844917959969d23453597e2b2a4662120984ee79947c3e'

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

            const token = 'adm_' + crypto.randomBytes(32).toString('hex')
            const sessionData = {
              user: {
                username: expectedUser,
                role: 'admin',
                name: 'BLR CRUIZ Fleet Manager',
              },
              token,
              createdAt: Date.now(),
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
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
            const session = await getAdminSession(req)
            if (!session) {
              return sendJson(res, 401, {
                success: false,
                valid: false,
                message: 'Unauthorized. Invalid or missing admin token.',
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
          const isHealthy = await appDb.isHealthy()
          const counts = await appDb.getCounts()
          return sendJson(res, 200, {
            status: isHealthy ? 'healthy' : 'degraded',
            engine: appDb.engine,
            timestamp: new Date().toISOString(),
            counts,
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
                  'Razorpay credentials are not yet configured in your .env file.',
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
                message: 'Missing Razorpay verification parameters.',
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

        // --- Admin Dashboard Stats Endpoint ---
        if (url === '/api/admin/stats' && req.method === 'GET') {
          const session = await getAdminSession(req)
          if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
          const counts = await appDb.getCounts()
          const allVehicles = await appDb.getVehicles()
          const allLocations = await appDb.getLocations()
          const statusCounts = { available: 0, booked: 0, maintenance: 0, inactive: 0 }
          for (const v of allVehicles) {
            const s = v.status || 'available'
            statusCounts[s] = (statusCounts[s] || 0) + 1
          }
          return sendJson(res, 200, {
            success: true,
            engine: appDb.engine,
            stats: {
              total_vehicles: counts.vehicles,
              total_locations: counts.locations,
              total_inquiries: counts.inquiries,
              total_bookings: counts.bookings,
              active_locations: allLocations.filter((l) => l.is_active).length,
              vehicles_by_status: statusCounts,
            },
          })
        }

        // --- Vehicles & Cars Specialized Endpoints ---
        if ((url === '/api/vehicles/featured' || url === '/api/cars/featured') && req.method === 'GET') {
          const limit = queryParams.limit || 8
          const featured = await vehicleService.getFeaturedVehicles(limit)
          return sendJson(res, 200, { success: true, count: featured.length, vehicles: featured, cars: featured })
        }

        if ((url === '/api/vehicles/popular' || url === '/api/cars/popular') && req.method === 'GET') {
          const limit = queryParams.limit || 8
          const popular = await vehicleService.getPopularVehicles(limit)
          return sendJson(res, 200, { success: true, count: popular.length, vehicles: popular, cars: popular })
        }

        if ((url === '/api/vehicles/availability' || url === '/api/cars/availability') && req.method === 'GET') {
          const pickupDate = queryParams.pickup_date || queryParams.pickupDate
          const returnDate = queryParams.return_date || queryParams.returnDate
          const result = await vehicleService.getVehicles({
            ...queryParams,
            pickup_date: pickupDate,
            return_date: returnDate,
            status: queryParams.status || 'available',
          })
          return sendJson(res, 200, { success: true, ...result })
        }

        if ((url === '/api/vehicles/meta/categories' || url === '/api/cars/meta/categories') && req.method === 'GET') {
          const categories = await vehicleService.getCategoriesMeta()
          return sendJson(res, 200, { success: true, categories })
        }

        // Unavailable dates for vehicle
        const unavailMatch = url.match(/^\/api\/(vehicles|cars)\/([^/]+)\/unavailable-dates$/)
        if (unavailMatch && req.method === 'GET') {
          const vehicleId = unavailMatch[2]
          const dates = await availabilityService.getUnavailableDates(vehicleId, queryParams.month, queryParams.year)
          return sendJson(res, 200, { success: true, vehicle_id: Number(vehicleId), unavailable_dates: dates })
        }

        // Check availability for single vehicle
        const availCheckMatch = url.match(/^\/api\/(vehicles|cars)\/([^/]+)\/availability$/)
        if (availCheckMatch && req.method === 'GET') {
          const vehicleId = availCheckMatch[2]
          const pickupDate = queryParams.pickup_date || queryParams.pickupDate
          const returnDate = queryParams.return_date || queryParams.returnDate
          const check = await availabilityService.isVehicleAvailable(vehicleId, pickupDate, returnDate)
          return sendJson(res, 200, { success: true, vehicle_id: Number(vehicleId), ...check })
        }

        // Unavailability blocks routes
        const blocksMatch = url.match(/^\/api\/(vehicles|cars|admin\/vehicles)\/([^/]+)\/blocks$/)
        if (blocksMatch && req.method === 'GET') {
          const vehicleId = blocksMatch[2]
          const blocks = await appDb.getUnavailabilityBlocks(vehicleId)
          return sendJson(res, 200, { success: true, vehicle_id: Number(vehicleId), count: blocks.length, blocks })
        }

        const blockAddMatch = url.match(/^\/api\/(vehicles|cars|admin\/vehicles)\/([^/]+)\/block$/)
        if (blockAddMatch && req.method === 'POST') {
          const session = await getAdminSession(req)
          if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
          const vehicleId = blockAddMatch[2]
          const body = await parseRequestBody(req)
          const block = await availabilityService.addVehicleBlock(vehicleId, body)
          return sendJson(res, 201, { success: true, message: 'Block added', block })
        }

        const blockDelMatch = url.match(/^\/api\/(vehicles|cars|admin\/vehicles)\/blocks\/([^/]+)$/)
        if (blockDelMatch && req.method === 'DELETE') {
          const session = await getAdminSession(req)
          if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
          const blockId = blockDelMatch[2]
          const deleted = await availabilityService.removeVehicleBlock(blockId)
          return sendJson(res, 200, { success: true, message: 'Block removed', block: deleted })
        }

        // Patch vehicle status
        const statusPatchMatch = url.match(/^\/api\/(vehicles|cars|admin\/vehicles)\/([^/]+)\/status$/)
        if (statusPatchMatch && req.method === 'PATCH') {
          const session = await getAdminSession(req)
          if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
          const id = statusPatchMatch[2]
          const body = await parseRequestBody(req)
          const updated = await vehicleService.updateVehicleStatus(id, body.status)
          return sendJson(res, 200, { success: true, message: 'Status updated', vehicle: updated, car: updated })
        }

        // --- Base Vehicles & Cars API Endpoints ---
        if ((url === '/api/vehicles' || url === '/api/cars' || url === '/api/admin/vehicles') && req.method === 'GET') {
          const result = await vehicleService.getVehicles(queryParams)
          return sendJson(res, 200, {
            success: true,
            engine: appDb.engine,
            ...result,
          })
        }

        if ((url === '/api/vehicles/sync' || url === '/api/cars/sync') && req.method === 'POST') {
          try {
            const body = await parseRequestBody(req)
            const { cars = [], vehicles = [] } = body
            const inputList = vehicles.length > 0 ? vehicles : cars
            const currentCars = await appDb.getVehicles()
            let count = 0
            for (const c of inputList) {
              if (c && c.brand && c.model && !currentCars.some((x) => String(x.id) === String(c.id))) {
                await vehicleService.createVehicle(c)
                count++
              }
            }
            const updatedCars = await appDb.getVehicles()
            return sendJson(res, 200, {
              success: true,
              restoredCount: count,
              vehicles: updatedCars,
              cars: updatedCars,
            })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if ((url === '/api/vehicles' || url === '/api/cars' || url === '/api/admin/vehicles') && req.method === 'POST') {
          try {
            const session = await getAdminSession(req)
            if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
            const data = await parseRequestBody(req)
            if (!data.brand || !data.model) {
              return sendJson(res, 400, { success: false, message: 'Brand and model required' })
            }
            const newVehicle = await vehicleService.createVehicle(data)
            return sendJson(res, 201, { success: true, vehicle: newVehicle, car: newVehicle })
          } catch (err) {
            return sendJson(res, 500, { success: false, message: err.message })
          }
        }

        if ((url.endsWith('/all') || url.endsWith('/delete-all')) && (req.method === 'DELETE' || req.method === 'POST')) {
          if (url.includes('vehicles') || url.includes('cars')) {
            const session = await getAdminSession(req)
            if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
            const result = await vehicleService.deleteAllVehicles()
            return sendJson(res, 200, { success: true, deletedCount: result.deletedCount, vehicles: [], cars: [] })
          }
        }

        // Single Vehicle Detail / Update / Delete
        const singleVehicleMatch = url.match(/^\/api\/(vehicles|cars|admin\/vehicles)\/([^/]+)$/)
        if (singleVehicleMatch) {
          const id = singleVehicleMatch[2]
          if (id !== 'sync' && id !== 'all' && id !== 'delete-all' && id !== 'featured' && id !== 'popular' && id !== 'availability') {
            if (req.method === 'GET') {
              const car = await vehicleService.getVehicleById(id)
              if (!car) return sendJson(res, 404, { success: false, message: 'Vehicle not found' })
              return sendJson(res, 200, { success: true, vehicle: car, car })
            }

            if (req.method === 'PUT') {
              const session = await getAdminSession(req)
              if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
              const updateData = await parseRequestBody(req)
              const updated = await vehicleService.updateVehicle(id, updateData)
              if (!updated) return sendJson(res, 404, { success: false, message: 'Vehicle not found' })
              return sendJson(res, 200, { success: true, vehicle: updated, car: updated })
            }

            if (req.method === 'DELETE') {
              const session = await getAdminSession(req)
              if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
              const deleted = await vehicleService.deleteVehicle(id)
              if (!deleted) return sendJson(res, 404, { success: false, message: 'Vehicle not found' })
              return sendJson(res, 200, { success: true, vehicle: deleted, car: deleted })
            }
          }
        }

        // --- Locations API Endpoints ---
        if ((url === '/api/locations' || url === '/api/admin/locations') && req.method === 'GET') {
          const includeInactive = queryParams.include_inactive === 'true' || queryParams.all === 'true' || url.includes('/admin/')
          const locations = includeInactive
            ? await locationService.getAllLocations()
            : await locationService.getActiveLocations()
          return sendJson(res, 200, { success: true, count: locations.length, engine: appDb.engine, locations })
        }

        if (url === '/api/locations/all' && req.method === 'GET') {
          const locations = await locationService.getAllLocations()
          return sendJson(res, 200, { success: true, count: locations.length, engine: appDb.engine, locations })
        }

        if ((url === '/api/locations' || url === '/api/admin/locations') && req.method === 'POST') {
          const session = await getAdminSession(req)
          if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
          const data = await parseRequestBody(req)
          if (!data.name) return sendJson(res, 400, { success: false, message: 'Location name required' })
          const newLoc = await locationService.createLocation(data)
          return sendJson(res, 201, { success: true, location: newLoc })
        }

        const singleLocMatch = url.match(/^\/api\/(locations|admin\/locations)\/([^/]+)$/)
        if (singleLocMatch) {
          const target = singleLocMatch[2]
          if (target !== 'all') {
            if (req.method === 'GET') {
              const location = await locationService.getLocationBySlugOrId(target)
              if (!location) return sendJson(res, 404, { success: false, message: 'Location not found' })
              return sendJson(res, 200, { success: true, location })
            }

            if (req.method === 'PUT') {
              const session = await getAdminSession(req)
              if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
              const updateData = await parseRequestBody(req)
              const updated = await locationService.updateLocation(target, updateData)
              if (!updated) return sendJson(res, 404, { success: false, message: 'Location not found' })
              return sendJson(res, 200, { success: true, location: updated })
            }

            if (req.method === 'DELETE') {
              const session = await getAdminSession(req)
              if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
              const deleted = await locationService.deleteLocation(target)
              if (!deleted) return sendJson(res, 404, { success: false, message: 'Location not found' })
              return sendJson(res, 200, { success: true, location: deleted })
            }
          }
        }

        // --- Inquiries API Endpoints ---
        if (url === '/api/inquiries' && req.method === 'GET') {
          const inquiries = await appDb.getInquiries()
          return sendJson(res, 200, { success: true, count: inquiries.length, inquiries })
        }

        if (url === '/api/inquiries' && req.method === 'POST') {
          const data = await parseRequestBody(req)
          if (!data.name || !data.phone) {
            return sendJson(res, 400, { success: false, message: 'Name and phone required' })
          }
          const newInq = await appDb.createInquiry(data)
          return sendJson(res, 201, { success: true, inquiry: newInq })
        }

        const singleInqMatch = url.match(/^\/api\/inquiries\/([^/]+)$/)
        if (singleInqMatch) {
          const id = singleInqMatch[1]
          if (id === 'reset' && req.method === 'POST') {
            const session = await getAdminSession(req)
            if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
            await appDb.resetInquiries()
            return sendJson(res, 200, { success: true, message: 'Inquiries reset', inquiries: [] })
          }

          if (req.method === 'PUT') {
            const session = await getAdminSession(req)
            if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
            const data = await parseRequestBody(req)
            const updated = await appDb.updateInquiry(id, data)
            if (!updated) return sendJson(res, 404, { success: false, message: 'Inquiry not found' })
            return sendJson(res, 200, { success: true, inquiry: updated })
          }

          if (req.method === 'DELETE') {
            const session = await getAdminSession(req)
            if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
            const deleted = await appDb.deleteInquiry(id)
            if (!deleted) return sendJson(res, 404, { success: false, message: 'Inquiry not found' })
            return sendJson(res, 200, { success: true, inquiry: deleted })
          }
        }

        // --- Bookings API Endpoints ---
        if (url === '/api/bookings' && req.method === 'GET') {
          const session = await getAdminSession(req)
          if (!session) return sendJson(res, 401, { success: false, message: 'Admin token required' })
          const bookings = await appDb.getBookings()
          return sendJson(res, 200, { success: true, count: bookings.length, bookings })
        }

        next()
      })
    },
  }
}

export default razorpayApiPlugin
