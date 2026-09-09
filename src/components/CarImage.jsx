import React, { useState, useEffect } from 'react'

export const FALLBACK_CAR_IMAGE =
  'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'

/**
 * Standardized Responsive Car Image Component for BLR CRUIZ
 *
 * Ensures all vehicle images automatically fit a unified 16:9 aspect ratio frame
 * without stretching, distortion, or unexpected layout shifts across desktop, tablet, and mobile.
 */
export default function CarImage({
  src,
  alt = 'BLR CRUIZ rental car in Bangalore',
  className = '',
  containerClassName = '',
  aspectRatio = 'aspect-[16/9]',
  objectFit = 'object-cover',
  objectPosition = 'object-center',
  loading = 'lazy',
  fallbackSrc = FALLBACK_CAR_IMAGE,
  onClick,
  showSkeleton = true,
}) {
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Sync internal source if prop changes
  useEffect(() => {
    if (src && typeof src === 'string' && src.trim().length > 0) {
      setImgSrc(src)
      setHasError(false)
    } else {
      setImgSrc(fallbackSrc)
      setHasError(false)
    }
  }, [src, fallbackSrc])

  const handleError = () => {
    if (!hasError) {
      setHasError(true)
      setImgSrc(fallbackSrc)
    }
  }

  const handleLoad = () => {
    setIsLoaded(true)
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-100 ${aspectRatio} ${containerClassName}`}
      onClick={onClick}
    >
      {/* Skeleton / Shimmer placeholder while loading */}
      {showSkeleton && !isLoaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse z-0" />
      )}

      {/* Main Standardized Image */}
      <img
        src={imgSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`h-full w-full ${objectFit} ${objectPosition} transition-all duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />
    </div>
  )
}
