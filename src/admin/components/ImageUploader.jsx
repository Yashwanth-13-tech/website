import React, { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Star, Plus, Link, AlertCircle, Check, Sparkles } from 'lucide-react'
import { imageService } from '../../services/imageService.js'

const PRESET_PHOTOS = [
  { name: 'SUV (Creta)', url: 'https://images.unsplash.com/photo-1669882705938-1493a3141dd6?auto=format&fit=crop&w=800&q=80' },
  { name: 'Sedan (City)', url: 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&w=800&q=80' },
  { name: 'Hatchback (Swift)', url: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80' },
  { name: 'Luxury (BMW)', url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80' },
]

export default function ImageUploader({ images = [], onChange }) {
  const [urlInput, setUrlInput] = useState('')
  const [uploadMode, setUploadMode] = useState('upload') // 'upload' | 'url'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    setError(null)
    setLoading(true)
    try {
      const processed = await imageService.processAndUploadMultiple(files)
      onChange([...images, ...processed])
    } catch (err) {
      setError(err.message || 'Failed to process and upload image.')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleAddUrl = (e) => {
    if (e) e.preventDefault()
    if (!urlInput.trim()) return
    onChange([...images, urlInput.trim()])
    setUrlInput('')
  }

  const handleAddPreset = (url) => {
    if (!images.includes(url)) {
      onChange([...images, url])
    }
  }

  const handleRemove = (index) => {
    const next = images.filter((_, i) => i !== index)
    onChange(next)
  }

  const handleSetPrimary = (index) => {
    if (index === 0) return
    const selected = images[index]
    const remaining = images.filter((_, i) => i !== index)
    onChange([selected, ...remaining])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <label className="label-field !mb-0 text-charcoal-900 font-bold">Car Photos &amp; Gallery</label>
          <p className="text-[11px] text-charcoal-500">
            {images.length === 0
              ? 'Upload at least one photo. The first photo will be used as the main listing thumbnail.'
              : `${images.length} photo${images.length !== 1 ? 's' : ''} uploaded (First photo is primary)`}
          </p>
        </div>

        {/* Upload Mode Switcher */}
        <div className="flex items-center gap-1 bg-charcoal-100 p-0.5 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setUploadMode('upload')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              uploadMode === 'upload' ? 'bg-white text-charcoal-900 shadow-xs' : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
          >
            <Upload size={12} />
            <span>Upload</span>
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('url')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              uploadMode === 'url' ? 'bg-white text-charcoal-900 shadow-xs' : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
          >
            <Link size={12} />
            <span>URL</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-200">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Image Gallery Grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-charcoal-500">
            <span>Live 16:9 Website Previews:</span>
            <span className="text-accent-600 font-semibold">Centered &amp; Auto-Fitted</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className={`group relative w-full aspect-[16/9] overflow-hidden rounded-2xl border-2 transition-all bg-charcoal-900 ${
                  idx === 0 ? 'border-accent-500 ring-2 ring-accent-500/20 shadow-xs' : 'border-charcoal-900/10'
                }`}
              >
                <img
                  src={img}
                  alt={`Car view ${idx + 1}`}
                  className="h-full w-full object-cover object-center"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'
                  }}
                />
                
                {/* Overlay controls */}
                <div className="absolute inset-0 bg-charcoal-950/60 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2 p-2">
                  {idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      title="Make Main Thumbnail"
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-charcoal-900 hover:bg-accent-500 hover:text-white transition-colors shadow-sm"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    title="Remove Photo"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                  >
                    <X size={14} />
                  </button>
                </div>

                {idx === 0 && (
                  <span className="absolute bottom-2 left-2 rounded-lg bg-accent-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                    Primary (Main)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode 1: File Dropzone */}
      {uploadMode === 'upload' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-charcoal-900/15 bg-charcoal-50/50 p-6 text-center transition-colors hover:border-accent-500 hover:bg-accent-50/20 cursor-pointer"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-charcoal-900/5 mb-2.5">
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
            ) : (
              <Upload size={20} className="text-accent-500" />
            )}
          </div>

          <p className="text-xs sm:text-sm font-bold text-charcoal-900">
            {loading ? 'Optimizing and compressing photos...' : 'Click or drop vehicle photos here'}
          </p>
          <p className="mt-1 text-[11px] text-charcoal-500">
            Supports PNG, JPG, WebP. High resolution with auto-compression.
          </p>
        </div>
      )}

      {/* Mode 2: Direct URL Input */}
      {uploadMode === 'url' && (
        <div className="space-y-3 rounded-2xl border border-charcoal-900/10 bg-charcoal-50/60 p-4 animate-fade-in">
          <form onSubmit={handleAddUrl} className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste photo URL (e.g. https://images.unsplash.com/...)"
              className="input-field text-xs py-2 flex-1"
            />
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="btn-dark text-xs !py-2 !px-4 shrink-0"
            >
              <Plus size={14} />
              <span>Add URL</span>
            </button>
          </form>

          {/* Quick Presets for Demo / Testing */}
          <div className="pt-2 border-t border-charcoal-900/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-400 block mb-1.5">
              Or quick-pick a stock vehicle image:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PHOTOS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleAddPreset(preset.url)}
                  className="rounded-lg bg-white border border-charcoal-900/10 px-2.5 py-1 text-[11px] font-semibold text-charcoal-700 hover:border-accent-400 hover:text-accent-600 transition-colors"
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
