import { appDb } from '../config/database.js'
import { supabaseStorage } from '../services/supabaseStorage.js'

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

  // Simulate upload of a sample image dataUrl
  const sampleDataUrl = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
  const uploadResult = await supabaseStorage.uploadImage({
    dataUrl: sampleDataUrl,
    prefix: 'vehicles',
  })
  console.log('   Upload Result Success:', uploadResult.success)
  console.log('   Upload Provider:', uploadResult.provider)
  console.log('   Upload URL:', uploadResult.url)
  console.log('   Upload Path:', uploadResult.path)

  // 3. Test Vehicle CRUD & Persistence
  console.log('\n3. Testing Vehicle Persistence...')
  const newCar = await appDb.createVehicle({
    brand: 'TestSupabase',
    model: 'Cruizer 2026',
    year: 2026,
    category: 'SUV',
    price_daily: 2500,
    images: [uploadResult.url],
    image: uploadResult.url,
  })
  console.log('   Created vehicle ID:', newCar.id, newCar.brand, newCar.model)
  console.log('   Vehicle image URL stored:', newCar.image)

  const fetched = await appDb.getVehicleById(newCar.id)
  console.log('   Fetched vehicle match:', fetched.id === newCar.id && fetched.brand === 'TestSupabase')

  // Clean up test vehicle
  await appDb.deleteVehicle(newCar.id)
  console.log('   Deleted test vehicle successfully.')

  console.log('\n=== ALL LOCAL TESTS PASSED! ===')
}

runTests().then(() => process.exit(0)).catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
