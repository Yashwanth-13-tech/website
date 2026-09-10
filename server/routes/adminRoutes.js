import express from 'express'
import adminController from '../controllers/adminController.js'
import { verifyAdminAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

// All admin routes require verifyAdminAuth
router.use(verifyAdminAuth)

// Dashboard Stats
router.get('/stats', adminController.getDashboardStats)

// Vehicle Management
router.get('/vehicles', adminController.getVehicles)
router.post('/vehicles', adminController.createVehicle)
router.put('/vehicles/:id', adminController.updateVehicle)
router.patch('/vehicles/:id/status', adminController.patchVehicleStatus)
router.delete('/vehicles/all', adminController.deleteAllVehicles)
router.post('/vehicles/delete-all', adminController.deleteAllVehicles)
router.delete('/vehicles/:id', adminController.deleteVehicle)

// Unavailability & Maintenance Blocks
router.get('/vehicles/:id/blocks', adminController.getBlocks)
router.post('/vehicles/:id/block', adminController.addBlock)
router.delete('/vehicles/blocks/:blockId', adminController.deleteBlock)

// Location Management
router.get('/locations', adminController.getLocations)
router.post('/locations', adminController.createLocation)
router.put('/locations/:id', adminController.updateLocation)
router.delete('/locations/:id', adminController.deleteLocation)

// Supabase Storage Image Upload
router.post('/upload-image', adminController.uploadImage)
router.post('/upload-images', adminController.uploadMultipleImages)

export default router

