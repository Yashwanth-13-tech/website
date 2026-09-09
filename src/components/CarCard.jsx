import React, { useState, useEffect, useMemo, memo } from 'react'
import {
  Users,
  Settings,
  Fuel,
  Star,
  Heart,
  MessageCircle,
  ArrowRight,
  Eye,
  CheckCircle2,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatPrice, calculateTotal } from '../utils/pricing.js'
import { createWhatsAppLink } from '../utils/whatsapp.js'
import { useInView } from '../hooks/useInView.js'

// Automatic slideshow interval in milliseconds (1000ms = 1 second)
const AUTO_SLIDE_INTERVAL = 1000

// Fallback image in case vehicle images are missing or fail to load
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'

const CarCard = memo(function CarCard({
  car,
  days,
  locationMap = {},
  isFavorite,
  onToggleFavorite,
  onViewDetails,
  onBookNow,
}) {
  // Normalize images array to ensure valid non-empty string URLs
  const images = useMemo(() => {
    if (Array.isArray(car.images) && car.images.length > 0) {
      const validImages = car.images.filter(
        (img) => typeof img === 'string' && img.trim().length > 0
      )
      if (validImages.length > 0) return validImages
    }
    if (car.image && typeof car.image === 'string' && car.image.trim().length > 0) {
      return [car.image]
    }
    return [FALLBACK_IMAGE]
  }, [car.images, car.image])

  // Independent carousel state per vehicle card
  const [activeImgIndex, setActiveImgIndex] = useState(0)
  const [heartPopped, setHeartPopped] = useState(false)
  const [cardRef, isInView] = useInView({ threshold: 0.1, triggerOnce: true })

  // Keep active index within bounds if images change
  useEffect(() => {
    setActiveImgIndex(0)
  }, [images.length])

  // Automatic slideshow with clean timer lifecycle to prevent duplicate intervals and memory leaks
  useEffect(() => {
    if (images.length <= 1) return

    const timer = setInterval(() => {
      setActiveImgIndex((prev) => (prev + 1) % images.length)
    }, AUTO_SLIDE_INTERVAL)

    return () => clearInterval(timer)
  }, [images.length])

  const estimatedTotal = days > 0 ? calculateTotal(car.pricePerDay, days) : null

  const whatsappMsg = `Hello BLR CRUIZ team, I would like to book the ${car.brand} ${car.model} (${car.year} ${car.transmission})${
    days > 0 ? ` for ${days} days` : ''
  }. Please confirm availability and terms.`

  const handleFavoriteClick = (e) => {
    e.stopPropagation()
    setHeartPopped(true)
    setTimeout(() => setHeartPopped(false), 300)
    onToggleFavorite(car.id)
  }

  const handlePrevImg = (e) => {
    e.stopPropagation()
    setActiveImgIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNextImg = (e) => {
    e.stopPropagation()
    setActiveImgIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  return (
    <div
      ref={cardRef}
      className="hover-lift group relative flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs transition-all duration-500 hover:border-slate-300 hover:shadow-md"
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView
          ? 'translate3d(0, 0, 0) scale(1)'
          : 'translate3d(0, 24px, 0) scale(0.97)',
        transition:
          'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease, box-shadow 200ms ease',
        willChange: isInView ? 'auto' : 'opacity, transform',
      }}
    >
      {/* Top Image Preview Box with Standardized 16:9 Ratio & Cross-Fade Slideshow */}
      <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-100">
        {images.map((imgSrc, idx) => (
          <img
            key={`${imgSrc}-${idx}`}
            src={imgSrc}
            alt={`${car.brand} ${car.model} for rent in Bangalore - photo ${idx + 1}`}
            className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-500 ease-in-out group-hover:scale-105 ${
              idx === activeImgIndex
                ? 'opacity-100 scale-100 z-[1]'
                : 'opacity-0 scale-[1.02] pointer-events-none z-0'
            }`}
            loading={idx === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = FALLBACK_IMAGE
            }}
          />
        ))}

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 z-10">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold shadow-2xs ${
              car.available
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-white/80'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                car.available ? 'bg-emerald-300' : 'bg-slate-400'
              }`}
            />
            {car.available ? 'Available' : 'Booked'}
          </span>

          {car.popular && (
            <span className="rounded-md bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
              ⭐ Featured
            </span>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'Remove from saved' : 'Save vehicle'}
          className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-xs transition-all duration-200 active:scale-75 ${
            heartPopped ? 'scale-125' : 'scale-100'
          } ${
            isFavorite
              ? 'bg-accent-500 text-white ring-2 ring-accent-400'
              : 'bg-white/90 text-slate-700 hover:bg-white hover:text-accent-500'
          }`}
        >
          <Heart
            size={15}
            className={`transition-transform duration-200 ${
              isFavorite ? 'fill-white text-white' : ''
            }`}
          />
        </button>

        {/* Multi-Image Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevImg}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/60 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-slate-900"
              aria-label="Previous photo"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextImg}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/60 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-slate-900"
              aria-label="Next photo"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Multi-Image Indicator Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-auto">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/40 backdrop-blur-xs border border-white/10">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveImgIndex(idx)
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeImgIndex === idx
                      ? 'w-4 bg-accent-500 shadow-xs'
                      : 'w-1.5 bg-white/70 hover:bg-white'
                  }`}
                  aria-label={`View photo ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Body - Compact Specs & Info */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Title, Category & Rating */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {car.category} • {car.year}
            </span>
            <h3 className="font-display text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-accent-600 transition-colors truncate">
              {car.brand} {car.model}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 text-xs font-bold text-amber-900">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            <span>{car.rating}</span>
          </div>
        </div>

        {/* Key Specs Pills */}
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold text-slate-600">
          <div className="flex items-center justify-center gap-1 rounded-lg bg-slate-50 border border-slate-100 py-1">
            <Users size={12} className="text-slate-400 shrink-0" />
            <span>{car.seats} Seats</span>
          </div>
          <div className="flex items-center justify-center gap-1 rounded-lg bg-slate-50 border border-slate-100 py-1 truncate">
            <Settings size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{car.transmission}</span>
          </div>
          <div className="flex items-center justify-center gap-1 rounded-lg bg-slate-50 border border-slate-100 py-1">
            <Fuel size={12} className="text-slate-400 shrink-0" />
            <span>{car.fuel}</span>
          </div>
        </div>

        {/* Location Availability */}
        {Array.isArray(car.locations) && car.locations.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <MapPin size={12} className="text-accent-500 shrink-0" />
            <span className="truncate">
              {car.locations
                .map((lid) => locationMap[lid] || lid.replace('loc_', '').replace(/_/g, ' '))
                .slice(0, 2)
                .join(', ')}
              {car.locations.length > 2 && (
                <span className="text-accent-600 font-bold ml-0.5">
                  +{car.locations.length - 2}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Pricing & Actions Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[10px] font-medium text-slate-400 block">Daily Tariff</span>
              <p className="font-display text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
                {formatPrice(car.pricePerDay)}
                <span className="text-xs font-normal text-slate-500">/day</span>
              </p>
            </div>

            {estimatedTotal !== null ? (
              <div className="text-right">
                <span className="text-[10px] font-bold text-accent-600 block">{days} Days Total</span>
                <span className="font-display text-sm font-extrabold text-slate-900">
                  {formatPrice(estimatedTotal)}
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Free Doorstep
              </span>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="grid grid-cols-5 gap-1.5">
            <button
              type="button"
              onClick={() => onViewDetails(car)}
              className="col-span-2 btn-outline text-xs !py-1.5 font-bold justify-center"
              title="View full car details"
            >
              <Eye size={13} />
              <span>Details</span>
            </button>

            <button
              type="button"
              onClick={() => onBookNow(car)}
              className="col-span-2 btn-accent text-xs !py-1.5 font-bold justify-center"
            >
              <span>Book</span>
              <ArrowRight size={13} />
            </button>

            <a
              href={createWhatsAppLink(whatsappMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-1 btn-whatsapp !p-0 !py-1.5 justify-center"
              title="Chat on WhatsApp"
            >
              <MessageCircle size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})

export default CarCard
