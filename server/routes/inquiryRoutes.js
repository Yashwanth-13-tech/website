import express from 'express'
import inquiryController from '../controllers/inquiryController.js'
import { verifyAdminAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public routes
router.get('/', inquiryController.getAllInquiries)
router.post('/', inquiryController.createInquiry)

// Admin protected routes
router.put('/:id', verifyAdminAuth, inquiryController.updateInquiry)
router.delete('/:id', verifyAdminAuth, inquiryController.deleteInquiry)
router.post('/reset', verifyAdminAuth, inquiryController.resetInquiries)

export default router
