import express from 'express'
import authController from '../controllers/authController.js'
import { verifyAdminAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/login', authController.login)
router.get('/verify', verifyAdminAuth, authController.verify)
router.post('/logout', authController.logout)

export default router
