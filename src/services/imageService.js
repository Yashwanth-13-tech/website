/**
 * Service for handling car image uploads, compression, validation, and storage.
 * Compresses vehicle photos to compact high-quality WebP/JPEG data URLs
 * to ensure fast uploads and prevent "request entity too large" payload errors.
 */
export const imageService = {
  /**
   * Validate image file format and size (max 15MB before compression)
   */
  validateFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/avif']
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Unsupported image format. Please upload JPG, PNG, or WebP.',
      }
    }
    const maxSizeBytes = 15 * 1024 * 1024 // 15MB
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: 'File size exceeds 15MB limit. Please upload a smaller image.',
      }
    }
    return { valid: true }
  },

  /**
   * Compress and convert an image file to a high-quality, lightweight WebP/JPEG data URL
   * @param {File} file
   * @param {number} maxWidth - default 960px (ideal for high-DPI thumbnails & modal galleries)
   * @param {number} quality - default 0.78
   */
  async processAndCompress(file, maxWidth = 960, quality = 0.78) {
    const validation = this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target.result

        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img

          // Keep aspect ratio within maxWidth and maxHeight (720px)
          const maxHeight = 720
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // Try WebP compression first with fallback to JPEG
          let dataUrl = ''
          try {
            dataUrl = canvas.toDataURL('image/webp', quality)
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/jpeg', quality)
            }
          } catch {
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          }

          // If still over 400KB, do a quick second pass with slightly lower quality
          if (dataUrl.length > 400 * 1024) {
            try {
              dataUrl = canvas.toDataURL('image/jpeg', 0.65)
            } catch {
              // keep previous dataUrl
            }
          }

          resolve(dataUrl)
        }

        img.onerror = () => reject(new Error('Failed to load image for processing.'))
      }

      reader.onerror = () => reject(new Error('Failed to read file.'))
    })
  },

  /**
   * Process multiple files in parallel (up to 8 images per car)
   */
  async processMultipleFiles(files) {
    const limitedFiles = Array.from(files).slice(0, 8)
    const promises = limitedFiles.map((file) => this.processAndCompress(file))
    return await Promise.all(promises)
  },

  /**
   * Upload a compressed data URL to backend Supabase Storage endpoint
   * @param {string} dataUrl
   * @param {string} [token]
   * @param {string|number} [vehicleId]
   * @returns {Promise<string>} public Supabase CDN URL
   */
  async uploadToStorage(dataUrl, token, vehicleId = null) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return dataUrl // Already a hosted URL
    }

    try {
      const authToken = token || localStorage.getItem('blrcruiz_admin_token') || ''
      const headers = { 'Content-Type': 'application/json' }
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dataUrl, prefix: 'cars', vehicleId }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.warn('[ImageService] Supabase Storage upload HTTP notice:', errData.message || res.statusText)
        return dataUrl
      }

      const json = await res.json()
      return json.url || dataUrl
    } catch (err) {
      console.warn('[ImageService] Network notice during Supabase Storage upload:', err.message)
      return dataUrl
    }
  },

  /**
   * Process, compress, and upload multiple files to Supabase Storage
   * @param {FileList|File[]} files
   * @param {string} [token]
   * @param {string|number} [vehicleId]
   * @returns {Promise<string[]>} array of public URLs
   */
  async processAndUploadMultiple(files, token, vehicleId = null) {
    const dataUrls = await this.processMultipleFiles(files)
    const uploadPromises = dataUrls.map((dataUrl) => this.uploadToStorage(dataUrl, token, vehicleId))
    return await Promise.all(uploadPromises)
  },
}

export default imageService


