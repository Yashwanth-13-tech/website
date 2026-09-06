import express from 'express'
import paymentController from '../controllers/paymentController.js'
import { verifyAdminAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public payment configuration and processing
router.get('/config/razorpay', paymentController.getConfig)
router.post('/razorpay/create-order', paymentController.createOrder)
router.post('/razorpay/verify-payment', paymentController.verifyPayment)

// Admin protected bookings
router.get('/bookings', verifyAdminAuth, paymentController.getBookings)

export default router
