import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'car-images'

let supabaseClient = null

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    console.log(`[Supabase Storage] Initialized storage client for bucket '${BUCKET_NAME}'`)
  } catch (err) {
    console.warn('[Supabase Storage] Initialization notice:', err.message)
  }
} else {
  console.log('[Supabase Storage] Notice: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured yet.')
}

let bucketVerified = false

async function ensureBucket() {
  if (!supabaseClient || bucketVerified) return true
  try {
    const { data: buckets, error } = await supabaseClient.storage.listBuckets()
    if (error) {
      console.warn('[Supabase Storage] Could not list buckets:', error.message)
      return false
    }

    const exists = buckets && buckets.some((b) => b.name === BUCKET_NAME)
    if (!exists) {
      console.log(`[Supabase Storage] Bucket '${BUCKET_NAME}' not found. Attempting to create public bucket...`)
      const { error: createError } = await supabaseClient.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 15 * 1024 * 1024, // 15MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/avif'],
      })
      if (createError) {
        console.warn(`[Supabase Storage] Bucket creation notice: ${createError.message}`)
      } else {
        console.log(`[Supabase Storage] Successfully created public bucket '${BUCKET_NAME}'.`)
      }
    }
    bucketVerified = true
    return true
  } catch (err) {
    console.warn('[Supabase Storage] ensureBucket error:', err.message)
    return false
  }
}

export const supabaseStorage = {
  get isConfigured() {
    return Boolean(supabaseClient && SUPABASE_URL && SUPABASE_KEY)
  },

  get bucketName() {
    return BUCKET_NAME
  },

  /**
   * Upload an image (base64 Data URL, Buffer, or File) to Supabase Storage
   * @param {Object} options
   * @param {string} [options.dataUrl] - Base64 Data URL (e.g. data:image/webp;base64,...)
   * @param {Buffer} [options.buffer] - Binary Buffer
   * @param {string} [options.mimeType] - MIME type (e.g. 'image/webp', 'image/jpeg')
   * @param {string} [options.originalName] - Original filename
   * @param {string} [options.prefix] - Folder prefix inside bucket (default: 'vehicles')
   */
  async uploadImage({ dataUrl, buffer, mimeType = 'image/webp', originalName = '', prefix = 'vehicles' }) {
    let fileBuffer = buffer
    let detectedMime = mimeType

    // 1. If base64 dataUrl is provided, parse buffer and mimeType
    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
      if (match) {
        detectedMime = match[1]
        fileBuffer = Buffer.from(match[2], 'base64')
      } else {
        throw new Error('Invalid data URL format for image upload.')
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('No image buffer or data provided for upload.')
    }

    // Determine clean file extension
    let ext = 'webp'
    if (detectedMime.includes('jpeg') || detectedMime.includes('jpg')) ext = 'jpg'
    else if (detectedMime.includes('png')) ext = 'png'
    else if (detectedMime.includes('avif')) ext = 'avif'

    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '')
    const randomSuffix = Math.random().toString(36).substring(2, 9)
    const fileName = `car_${Date.now()}_${randomSuffix}.${ext}`
    const storagePath = `${cleanPrefix}/${fileName}`

    // 2. If Supabase is configured, upload directly to Supabase Storage
    if (this.isConfigured) {
      await ensureBucket()

      const { data, error } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType: detectedMime,
          cacheControl: 'public, max-age=31536000, immutable',
          upsert: true,
        })

      if (error) {
        console.error('[Supabase Storage Upload Error]:', error.message)
        throw new Error(`Supabase Storage upload failed: ${error.message}`)
      }

      // Retrieve public URL from Supabase CDN
      const { data: urlData } = supabaseClient.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath)

      const publicUrl = urlData?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`

      return {
        success: true,
        url: publicUrl,
        path: storagePath,
        bucket: BUCKET_NAME,
        size: fileBuffer.length,
        mimeType: detectedMime,
        provider: 'supabase',
      }
    }

    // 3. Fallback if Supabase credentials are not supplied yet (e.g. offline dev):
    // Return compressed dataUrl so frontend/admin workflow continues without failure
    console.warn('[Supabase Storage Notice] SUPABASE_URL not configured. Using compressed payload.')
    return {
      success: true,
      url: dataUrl || `data:${detectedMime};base64,${fileBuffer.toString('base64')}`,
      path: storagePath,
      bucket: 'local',
      size: fileBuffer.length,
      mimeType: detectedMime,
      provider: 'local-inline',
    }
  },

  /**
   * Delete an image from Supabase Storage by its path or public URL
   * @param {string} urlOrPath - Either relative storage path or full Supabase public URL
   */
  async deleteImage(urlOrPath) {
    if (!this.isConfigured || !urlOrPath || typeof urlOrPath !== 'string') return { success: false }

    try {
      let storagePath = urlOrPath
      const publicPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`
      if (urlOrPath.includes(publicPrefix)) {
        storagePath = urlOrPath.split(publicPrefix)[1]
      } else if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        const parts = urlOrPath.split(`/${BUCKET_NAME}/`)
        if (parts.length > 1) {
          storagePath = parts[1]
        }
      }

      const { error } = await supabaseClient.storage.from(BUCKET_NAME).remove([storagePath])
      if (error) {
        console.warn(`[Supabase Storage] Delete error for '${storagePath}':`, error.message)
        return { success: false, error: error.message }
      }
      return { success: true, path: storagePath }
    } catch (err) {
      console.warn('[Supabase Storage] deleteImage error:', err.message)
      return { success: false, error: err.message }
    }
  },
}

export default supabaseStorage
