import crypto from 'crypto'
import Razorpay from 'razorpay'
import appDb from '../config/database.js'

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret || keyId.includes('your_') || keySecret.includes('your_')) {
    return null
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  })
}

export const paymentController = {
  getConfig(req, res) {
    const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || ''
    const isConfigured = Boolean(
      (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID) &&
      process.env.RAZORPAY_KEY_SECRET &&
      !keyId.includes('your_')
    )

    return res.status(200).json({
      success: true,
      keyId: isConfigured ? keyId : '',
      isConfigured,
      mode: keyId.startsWith('rzp_live') ? 'live' : 'test',
    })
  },

  async createOrder(req, res) {
    try {
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
      } = req.body || {}

      if (!customerName || !customerPhone) {
        return res.status(400).json({
          success: false,
          message: 'Customer name and 10-digit mobile number are required.',
        })
      }

      if (!pickupDate || !returnDate) {
        return res.status(400).json({
          success: false,
          message: 'Please select both pickup date and return date.',
        })
      }

      const start = new Date(pickupDate)
      const end = new Date(returnDate)
      const diffTime = end.getTime() - start.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      const validDays = diffDays > 0 ? diffDays : 1

      const dailyRate = Number(pricePerDay) > 0 ? Number(pricePerDay) : 1499
      const baseTotal = dailyRate * validDays
      const gstAmount = Math.round(baseTotal * 0.05)
      const grandTotal = baseTotal + gstAmount
      const amountInPaise = grandTotal * 100

      const razorpay = getRazorpayInstance()
      if (!razorpay) {
        return res.status(400).json({
          success: false,
          message:
            'Razorpay credentials are not yet configured in .env. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.',
          isConfigured: false,
        })
      }

      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now().toString().slice(-8)}`,
        notes: {
          carId: String(carId || '1'),
          carName: String(carName || 'BLR CRUIZ Fleet Car'),
          customerName: String(customerName),
          customerPhone: String(customerPhone),
          pickupLocation: String(pickupLocation || 'Bangalore Hub'),
          pickupDate: String(pickupDate),
          returnDate: String(returnDate),
          days: String(validDays),
          needChauffeur: String(needChauffeur),
        },
      }

      const order = await razorpay.orders.create(options)

      return res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
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
    } catch (error) {
      console.error('[PaymentController createOrder Error]:', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create Razorpay order.',
      })
    }
  },

  async verifyPayment(req, res) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingDetails = {},
      } = req.body || {}

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing Razorpay payment verification parameters (order_id, payment_id, signature).',
        })
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET
      if (!keySecret) {
        return res.status(500).json({
          success: false,
          message: 'Server configuration error: RAZORPAY_KEY_SECRET is not set in environment.',
        })
      }

      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')

      const isAuthentic = expectedSignature === razorpay_signature
      if (!isAuthentic) {
        console.warn('[Payment Verification Failed]: Signature mismatch', {
          received: razorpay_signature,
          expected: expectedSignature,
        })
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed. Invalid cryptographic signature.',
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

      const savedBooking = await appDb.createBooking(newBooking)
      console.log(`[BOOKING CONFIRMED] ${bookingId} for ${newBooking.customerName} - Payment ID: ${razorpay_payment_id}`)

      return res.status(200).json({
        success: true,
        message: 'Payment verified and booking confirmed successfully.',
        bookingId,
        booking: savedBooking || newBooking,
      })
    } catch (error) {
      console.error('[PaymentController verifyPayment Error]:', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error during payment verification.',
      })
    }
  },

  async getBookings(req, res) {
    try {
      const bookings = await appDb.getBookings()
      return res.status(200).json({
        success: true,
        count: bookings.length,
        bookings,
      })
    } catch (err) {
      console.error('[PaymentController getBookings Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch bookings.',
      })
    }
  },
}

export default paymentController
