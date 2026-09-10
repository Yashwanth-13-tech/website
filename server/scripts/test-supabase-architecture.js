import { appDb } from '../config/database.js'
import { supabaseStorage } from '../services/supabaseStorage.js'
import vehicleService from '../services/vehicleService.js'

async function runTests() {
  console.log('=== TEST SUITE: SUPABASE DATABASE & STORAGE ARCHITECTURE ===\n')

  // 1. Check health
  console.log('1. Testing DB health and counts...')
  const healthy = await appDb.isHealthy()
  console.log('   DB is healthy:', healthy)
  const counts = await appDb.getCounts()
  console.log('   Current Counts:', counts)

  // 2. Test Supabase Storage service
  console.log('\n2. Testing Supabase Storage service...')
  console.log('   Storage isConfigured:', supabaseStorage.isConfigured)
  console.log('   Storage bucketName:', supabaseStorage.bucketName)

  // Test extractStoragePath helper
  const sampleStorageUrl = 'https://xyz.supabase.co/storage/v1/object/public/car-images/cars/vehicle-101/photo.webp'
  const extractedPath = supabaseStorage.extractStoragePath(sampleStorageUrl)
  console.log('   Extracted storage path:', extractedPath)
  if (extractedPath !== 'cars/vehicle-101/photo.webp') {
    throw new Error(`Path extraction failed: expected 'cars/vehicle-101/photo.webp', got '${extractedPath}'`)
  }

  // Simulate upload of a sample image dataUrl
  const sampleDataUrl = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
  const uploadResult = await supabaseStorage.uploadImage({
    dataUrl: sampleDataUrl,
    prefix: 'cars',
    vehicleId: 'test-999',
  })
  console.log('   Upload Result Success:', uploadResult.success)
  console.log('   Upload Provider:', uploadResult.provider)
  console.log('   Upload URL:', uploadResult.url)
  console.log('   Upload Path:', uploadResult.path)

  // 3. Test Vehicle Creation with Automatic Base64 Interception
  console.log('\n3. Testing Vehicle Creation with Base64 Interception...')
  const createdCar = await vehicleService.createVehicle({
    brand: 'TestSupabase',
    model: 'Cruizer 2026',
    year: 2026,
    category: 'SUV',
    price_daily: 2500,
    images: [sampleDataUrl],
  })
  console.log('   Created vehicle ID:', createdCar.id, createdCar.brand, createdCar.model)
  console.log('   Vehicle image stored is valid URL:', typeof createdCar.image === 'string' && createdCar.image.length > 0)

  // 4. Test Vehicle Update & Image Replacement
  console.log('\n4. Testing Vehicle Update & Image Replacement...')
  const updatedCar = await vehicleService.updateVehicle(createdCar.id, {
    model: 'Cruizer 2026 Ultra',
    images: ['https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'],
  })
  console.log('   Updated car model:', updatedCar.model)
  console.log('   Updated car primary image:', updatedCar.image)

  // 5. Test Image Migration Function
  console.log('\n5. Testing Image Migration Logic...')
  const migrationResult = await vehicleService.migrateExistingBase64Images()
  console.log('   Migration Result:', migrationResult)

  // 6. Test Vehicle Deletion & Cleanup
  console.log('\n6. Testing Vehicle Deletion & Storage Cleanup...')
  const deletedCar = await vehicleService.deleteVehicle(createdCar.id)
  console.log('   Deleted test vehicle ID:', deletedCar?.id)

  const verifyDeleted = await appDb.getVehicleById(createdCar.id)
  console.log('   Vehicle confirmed deleted from DB:', verifyDeleted === null)

  console.log('\n=== ALL SUPABASE ARCHITECTURE TESTS COMPLETED SUCCESSFULLY! ===')
}

runTests().then(() => process.exit(0)).catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
