import express from 'express'
import vehicleController from '../controllers/vehicleController.js'
import { verifyAdminAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public routes
router.get('/', vehicleController.getAllVehicles)
router.post('/sync', vehicleController.syncVehicles)
router.get('/:id', vehicleController.getVehicleById)

// Admin protected routes
router.post('/', verifyAdminAuth, vehicleController.createVehicle)
router.put('/:id', verifyAdminAuth, vehicleController.updateVehicle)
router.delete('/all', verifyAdminAuth, vehicleController.deleteAllVehicles)
router.post('/delete-all', verifyAdminAuth, vehicleController.deleteAllVehicles)
router.post('/reset', verifyAdminAuth, vehicleController.resetVehicles)
router.delete('/:id', verifyAdminAuth, vehicleController.deleteVehicle)

export default router
