import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Users,
  Settings,
  Fuel,
  Snowflake,
  Star,
  MapPin,
  Calendar,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatPrice, formatDate, calculateDays, calculateTotal, todayStr } from '../utils/pricing.js'
import { createWhatsAppLink } from '../utils/whatsapp.js'
import { pickupLocations } from '../config/business.js'
import { useCars } from '../context/CarContext.jsx'

const HIGHLIGHTS = [
  'Full Tank & Deep Sanitized Delivery',
  'Comprehensive Insurance Included',
  'Free Doorstep Handover in Bangalore',
  '24/7 On-Ground Roadside Assistance',
  'Flexible Cancellation & Zero Hidden Fees',
]

export default function CarDetailsModal({ car, search, onClose, onContinueBooking }) {
  const { cars, locations } = useCars()
  const allImages = Array.isArray(car?.images) && car.images.length > 0 ? car.images : (car?.image ? [car.image] : [])
  const [activeImgIndex, setActiveImgIndex] = useState(0)

  // Map location IDs to full location objects
  const carLocations = (Array.isArray(car?.locations) && car.locations.length > 0)
    ? car.locations
        .map((lid) => locations.find((l) => l.id === lid))
        .filter(Boolean)
    : locations

  // In-modal date editing
  const [pickupDate, setPickupDate] = useState(search.pickupDate || todayStr())
  const [returnDate, setReturnDate] = useState(search.returnDate || '')
  const [pickupLocation, setPickupLocation] = useState(search.pickupLocation || pickupLocations[0])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!car) return null

  const days = calculateDays(pickupDate, returnDate)
  const validDays = days > 0 ? days : 0
  const total = validDays > 0 ? calculateTotal(car.pricePerDay, validDays) : null

  const whatsappMsg = `Hello BLR CRUIZ, I am interested in renting the ${car.brand} ${car.model} in Bangalore${
    validDays > 0
      ? ` from ${formatDate(pickupDate)} to ${formatDate(returnDate)} (${validDays} days)`
      : ''
  } from ${pickupLocation}. Please confirm availability and best price.`

  const currentImage = allImages[activeImgIndex] || car.image

  // Related cars from same category
  const relatedCars = cars.filter((c) => c.category === car.category && c.id !== car.id).slice(0, 3)

  const modalJSX = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${car.brand} ${car.model} details`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94vh] w-full max-w-4xl animate-scale-in overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl overscroll-contain border border-slate-200"
      >
        {/* Modal Top Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent-50 text-accent-700 px-2 py-0.5 text-xs font-bold uppercase">
              {car.category}
            </span>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
              {car.brand} {car.model} ({car.year})
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Close details"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content: Split Screen on Tablet/Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-7">
          
          {/* Left Column: Gallery & Highlights (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Main Image Box */}
            <div className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100 border border-slate-200">
              <img
                src={currentImage}
                alt={`${car.brand} ${car.model} rental car in Bangalore`}
                className="h-full w-full object-cover object-center"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'
                }}
              />

              {/* Prev / Next buttons if multiple photos */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImgIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))}
                    aria-label="Previous vehicle image"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImgIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))}
                    aria-label="Next vehicle image"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}

              {/* Rating Pill */}
              <span className="absolute top-3 left-3 rounded-md bg-slate-900/80 px-2.5 py-0.5 text-xs font-bold text-white shadow-2xs">
                ⭐ {car.rating} / 5.0
              </span>
            </div>

            {/* Thumbnail selector row */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImgIndex(i)}
                    aria-label={`View ${car.brand} ${car.model} photo ${i + 1}`}
                    className={`h-12 w-20 aspect-[16/9] shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      activeImgIndex === i
                        ? 'border-accent-500 ring-2 ring-accent-500/30'
                        : 'border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${car.brand} ${car.model} photo ${i + 1}`} className="h-full w-full object-cover object-center" />
                  </button>
                ))}
              </div>
            )}

            {/* Car Specs Matrix */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Technical Specifications
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <Users size={15} className="text-accent-500" />
                  <span>{car.seats} Seater</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <Settings size={15} className="text-accent-500" />
                  <span className="truncate">{car.transmission}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <Fuel size={15} className="text-accent-500" />
                  <span>{car.fuel}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                  <Snowflake size={15} className="text-accent-500" />
                  <span>AC Climate</span>
                </div>
              </div>
            </div>

            {/* Available Locations Badges */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Available Pickup Hubs in Bangalore
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {carLocations.map((loc) => (
                  <span
                    key={loc.id || loc.name}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    <MapPin size={12} className="text-accent-500" />
                    <span>{loc.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Highlights List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                What's Included With BLR CRUIZ
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-slate-700">
                {HIGHLIGHTS.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Pricing & Booking Action (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Rental Tariff
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-display text-2xl font-black text-slate-900">
                    {formatPrice(car.pricePerDay)}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ 24 hours</span>
                </div>
              </div>

              {/* Date & Location Selectors */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="label-field">
                    <MapPin size={12} className="mr-1 inline text-accent-500" />
                    Pickup Location
                  </label>
                  <select
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="input-field text-xs py-2 font-semibold"
                  >
                    {pickupLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-field">
                      <Calendar size={12} className="mr-1 inline text-accent-500" />
                      Pickup Date
                    </label>
                    <input
                      type="date"
                      min={todayStr()}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="input-field text-xs py-2 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="label-field">
                      <Calendar size={12} className="mr-1 inline text-accent-500" />
                      Return Date
                    </label>
                    <input
                      type="date"
                      min={pickupDate || todayStr()}
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="input-field text-xs py-2 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Price Calculation Table */}
              {validDays > 0 && total && (
                <div className="rounded-xl bg-white border border-slate-200 p-3.5 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Fare ({validDays} days @ {formatPrice(car.pricePerDay)})</span>
                    <span className="font-semibold text-slate-800">{formatPrice(total.base)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-slate-800">{formatPrice(total.tax)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">Estimated Total</span>
                    <span className="font-display text-base font-black text-slate-900">
                      {formatPrice(total.total)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onContinueBooking({
                    ...car,
                    pickupDate,
                    returnDate,
                    pickupLocation,
                  })
                }}
                className="btn-accent w-full py-2.5 text-xs font-bold justify-center"
              >
                <span>Continue to Reservation</span>
                <ArrowRight size={14} />
              </button>

              <a
                href={createWhatsAppLink(whatsappMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp w-full py-2.5 text-xs font-bold justify-center"
              >
                <MessageCircle size={15} />
                <span>Instant WhatsApp Booking</span>
              </a>

              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 text-center pt-1">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>Instant booking confirmation. Free cancellation anytime.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Vehicles in Same Category */}
        {relatedCars.length > 0 && (
          <div className="p-5 sm:p-7 border-t border-slate-200 bg-slate-50/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Similar {car.category} Vehicles Available
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {relatedCars.map((rc) => (
                <div
                  key={rc.id}
                  className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-2.5 shadow-2xs"
                >
                  <div className="w-16 aspect-[16/9] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    <img
                      src={rc.image}
                      alt={`${rc.brand} ${rc.model} rental in Bangalore`}
                      className="h-full w-full object-cover object-center"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {rc.brand} {rc.model}
                    </p>
                    <p className="text-[11px] font-semibold text-accent-600">
                      {formatPrice(rc.pricePerDay)}/day
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : null
}
