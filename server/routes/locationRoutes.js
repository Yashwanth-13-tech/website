import express from 'express'
import locationController from '../controllers/locationController.js'
import { verifyAdminAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public routes
router.get('/', locationController.getAllLocations)
router.get('/:id', locationController.getLocationById)

// Admin protected routes
router.post('/', verifyAdminAuth, locationController.createLocation)
router.put('/:id', verifyAdminAuth, locationController.updateLocation)
router.delete('/:id', verifyAdminAuth, locationController.deleteLocation)

export default router
