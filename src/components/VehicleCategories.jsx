import React, { useMemo } from 'react'
import { ArrowRight, Sparkles, Shield, Compass, Crown } from 'lucide-react'
import { useCars } from '../context/CarContext.jsx'
import { formatPrice } from '../utils/pricing.js'

const CATEGORY_DEFAULTS = {
  hatchback: {
    name: 'City Hatchbacks',
    icon: Compass,
    badge: 'Fuel Efficient',
    image: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=600&q=80',
    text: 'Agile city driving and easy parking across Bangalore.',
  },
  sedan: {
    name: 'Executive Sedans',
    icon: Shield,
    badge: 'Highway Comfort',
    image: 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&w=600&q=80',
    text: 'Refined highway comfort and generous boot space.',
  },
  suv: {
    name: 'Family & Highway SUVs',
    icon: Sparkles,
    badge: 'Most Popular',
    image: 'https://images.unsplash.com/photo-1669882705938-1493a3141dd6?auto=format&fit=crop&w=600&q=80',
    text: 'Elevated ground clearance and 5-7 passenger seating.',
  },
  luxury: {
    name: 'Luxury Fleet',
    icon: Crown,
    badge: 'VIP Prestige',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80',
    text: 'Prestige German luxury for executive and VIP travel.',
  },
}

export default function VehicleCategories({ onBrowseCategory }) {
  const { cars } = useCars()

  // Dynamically compute only categories that have at least 1 car
  const activeCategories = useMemo(() => {
    if (!cars || cars.length === 0) return []

    const categoryMap = new Map()

    for (const car of cars) {
      const rawCat = car.category ? String(car.category).trim() : 'Hatchback'
      const key = rawCat.toLowerCase()

      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          rawCategory: rawCat,
          cars: [],
        })
      }
      categoryMap.get(key).cars.push(car)
    }

    const result = []

    for (const [key, { rawCategory, cars: catCars }] of categoryMap.entries()) {
      // STRICT REQUIREMENT: Only display categories with at least 1 car
      if (catCars.length === 0) continue

      const defaultMeta = CATEGORY_DEFAULTS[key]
      const minPrice = Math.min(...catCars.map((c) => Number(c.pricePerDay) || 1499))
      const firstCarWithImage = catCars.find((c) => c.image || (Array.isArray(c.images) && c.images[0]))

      result.push({
        rawCategory,
        name: defaultMeta?.name || `${rawCategory} Fleet`,
        category: rawCategory,
        icon: defaultMeta?.icon || Sparkles,
        badge: defaultMeta?.badge || 'Available Fleet',
        image:
          defaultMeta?.image ||
          firstCarWithImage?.image ||
          firstCarWithImage?.images?.[0] ||
          'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=600&q=80',
        text:
          defaultMeta?.text ||
          `Sanitized and verified ${rawCategory.toLowerCase()} rentals available for immediate booking.`,
        count: catCars.length,
        minPrice,
      })
    }

    // Sort in consistent order (Hatchback -> Sedan -> SUV -> Luxury -> Custom)
    const order = ['hatchback', 'sedan', 'suv', 'luxury']
    return result.sort((a, b) => {
      const idxA = order.indexOf(a.category.toLowerCase())
      const idxB = order.indexOf(b.category.toLowerCase())
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  }, [cars])

  // Hide section completely if no cars are available in inventory
  if (activeCategories.length === 0) {
    return null
  }

  return (
    <section id="categories" className="py-16 sm:py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8 sm:mb-10 gap-4">
          <div>
            <span className="section-eyebrow">Fleet Categories</span>
            <h2 className="section-heading">
              Browse by Vehicle Type
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Economical city hatchbacks to executive sedans and family SUVs.
            </p>
          </div>

          <button
            onClick={() => onBrowseCategory('All')}
            className="btn-outline self-start md:self-auto text-xs !py-2 !px-4"
          >
            <span>View All {cars.length} Cars</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Dynamic Categories Grid */}
        <div
          className={`grid grid-cols-1 gap-5 ${
            activeCategories.length === 1
              ? 'sm:grid-cols-1 max-w-md mx-auto'
              : activeCategories.length === 2
              ? 'sm:grid-cols-2 max-w-3xl mx-auto'
              : activeCategories.length === 3
              ? 'sm:grid-cols-2 lg:grid-cols-3'
              : 'sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {activeCategories.map((c) => (
            <div
              key={c.category}
              onClick={() => onBrowseCategory(c.category)}
              className="hover-lift group relative flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md cursor-pointer"
            >
              {/* Photo container with zoom */}
              <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                <img
                  src={c.image}
                  alt={`${c.name} available for rent in Bangalore`}
                  className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

                {/* Top category badge */}
                <span className="absolute left-3 top-3 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                  {c.badge}
                </span>

                {/* Car Count badge (Calculated dynamically) */}
                <span className="absolute bottom-2.5 left-3 text-xs font-bold text-white drop-shadow-sm">
                  {c.count} vehicle{c.count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Body Details */}
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <c.icon size={15} className="text-accent-500" />
                  <h3 className="font-display text-base font-extrabold text-slate-900 group-hover:text-accent-600 transition-colors">
                    {c.name}
                  </h3>
                </div>

                <p className="text-xs leading-relaxed text-slate-500 flex-1">
                  {c.text}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-medium text-slate-400 block">From</span>
                    <span className="font-display text-base font-extrabold text-slate-900">
                      {formatPrice(c.minPrice)}
                      <span className="text-[11px] font-normal text-slate-500">/day</span>
                    </span>
                  </div>

                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all duration-200 group-hover:bg-accent-500 group-hover:text-white">
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
