import express from 'express'
import vehicleController from '../controllers/vehicleController.js'
import { verifyAdminAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public search, filter, and meta endpoints
router.get('/', vehicleController.getAllVehicles)
router.get('/featured', vehicleController.getFeaturedVehicles)
router.get('/popular', vehicleController.getPopularVehicles)
router.get('/availability', vehicleController.getAvailableVehicles)
router.get('/meta/categories', vehicleController.getCategoriesMeta)
router.post('/sync', vehicleController.syncVehicles)

// Detail and availability endpoints
router.get('/:id/unavailable-dates', vehicleController.getUnavailableDates)
router.get('/:id/availability', vehicleController.checkAvailability)
router.get('/:id', vehicleController.getVehicleById)

// Admin management operations
router.post('/', verifyAdminAuth, vehicleController.createVehicle)
router.put('/:id', verifyAdminAuth, vehicleController.updateVehicle)
router.patch('/:id/status', verifyAdminAuth, vehicleController.updateVehicleStatus)
router.post('/:id/block', verifyAdminAuth, vehicleController.addUnavailabilityBlock)
router.get('/:id/blocks', verifyAdminAuth, vehicleController.getUnavailabilityBlocks)
router.delete('/blocks/:blockId', verifyAdminAuth, vehicleController.deleteUnavailabilityBlock)
router.delete('/all', verifyAdminAuth, vehicleController.deleteAllVehicles)
router.post('/delete-all', verifyAdminAuth, vehicleController.deleteAllVehicles)
router.post('/reset', verifyAdminAuth, vehicleController.resetVehicles)
router.delete('/:id', verifyAdminAuth, vehicleController.deleteVehicle)

export default router
