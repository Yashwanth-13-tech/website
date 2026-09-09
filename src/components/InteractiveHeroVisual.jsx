import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Sparkles,
  Shield,
  Zap,
  MapPin,
  Gauge,
  Star,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { useCars } from '../context/CarContext.jsx'

const SHOWCASE_CARS = [
  {
    id: 'luxury',
    name: 'BMW 3 Series M-Sport',
    category: 'Luxury Sedan',
    price: '₹7,999/day',
    speed: '0-100 in 5.8s',
    fuel: 'TwinPower Turbo',
    tag: 'Executive Prestige',
    badge: 'German Luxury',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1400&q=85',
  },
  {
    id: 'suv',
    name: 'Hyundai Creta SX(O)',
    category: 'Panoramic SUV',
    price: '₹2,799/day',
    speed: 'High Clearance',
    fuel: 'Smartstream Petrol',
    tag: 'Bangalore Favourite',
    badge: 'Most Popular',
    image: 'https://images.unsplash.com/photo-1669882705938-1493a3141dd6?auto=format&fit=crop&w=1400&q=85',
  },
  {
    id: 'sedan',
    name: 'Honda City ZX',
    category: 'Comfort Sedan',
    price: '₹2,099/day',
    speed: 'i-VTEC Engine',
    fuel: 'Automatic CVT',
    tag: 'Airport & Highway',
    badge: 'Smooth Cruiser',
    image: 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?auto=format&fit=crop&w=1400&q=85',
  },
]

export default function InteractiveHeroVisual({ onSelectModel }) {
  const { cars } = useCars()
  const [activeCarIdx, setActiveCarIdx] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [progress, setProgress] = useState(0)

  // Dynamically select showcase cars from live inventory
  const showcaseCars = useMemo(() => {
    if (!cars || cars.length === 0) return []

    const available = cars.filter((c) => c.available !== false)
    const pool = available.length > 0 ? available : cars
    const popular = pool.filter((c) => c.popular)
    const selected = (popular.length >= 2 ? popular : pool).slice(0, 3)

    return selected.map((car) => ({
      id: String(car.id),
      name: `${car.brand} ${car.model}`,
      category: car.category || 'Hatchback',
      rawCategory: car.category,
      price: `₹${Number(car.pricePerDay).toLocaleString('en-IN')}/day`,
      speed: `${car.seats || 5} Seater • ${car.transmission || 'Automatic'}`,
      fuel: `${car.fuel || 'Petrol'} Engine`,
      tag: car.popular ? 'Bangalore Favourite' : 'Available for Booking',
      badge: `${car.brand} Fleet`,
      image:
        car.image ||
        (Array.isArray(car.images) && car.images[0]) ||
        'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1400&q=85',
    }))
  }, [cars])

  // Motion state driven by 60fps lerp
  const [motionState, setMotionState] = useState({
    scale: 0.9,
    translateY: 36,
    carInnerScale: 0.95,
    opacity: 0.92,
    scrollProgress: 0,
    mouseX: 0,
    mouseY: 0,
  })

  const containerRef = useRef(null)
  const animFrameRef = useRef(null)

  // Targets for smooth interpolation
  const targetScrollProgress = useRef(0)
  const currentScrollProgress = useRef(0)
  const targetMouse = useRef({ x: 0, y: 0 })
  const currentMouse = useRef({ x: 0, y: 0 })

  const safeIdx = (showcaseCars.length > 0 && activeCarIdx < showcaseCars.length) ? activeCarIdx : 0
  const activeCar = showcaseCars[safeIdx] || null

  // Continuous Scroll Progress & Mouse Tracker with 60fps lerp
  useEffect(() => {
    const calculateScrollProgress = () => {
      if (!containerRef.current) return
      const scrollY = window.scrollY || window.pageYOffset || 0
      const maxScrollDistance = 320
      const rawProgress = Math.min(1, Math.max(0, scrollY / maxScrollDistance))
      targetScrollProgress.current = rawProgress
    }

    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const y = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
      targetMouse.current = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      }
    }

    const handleMouseEnter = () => setIsHovered(true)
    const handleMouseLeave = () => {
      setIsHovered(false)
      targetMouse.current = { x: 0, y: 0 }
    }

    window.addEventListener('scroll', calculateScrollProgress, { passive: true })
    calculateScrollProgress()

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove, { passive: true })
      container.addEventListener('mouseenter', handleMouseEnter)
      container.addEventListener('mouseleave', handleMouseLeave)
    }

    const lerp = (a, b, n) => (1 - n) * a + n * b

    const updateLoop = () => {
      currentScrollProgress.current = lerp(currentScrollProgress.current, targetScrollProgress.current, 0.12)
      currentMouse.current.x = lerp(currentMouse.current.x, targetMouse.current.x, 0.08)
      currentMouse.current.y = lerp(currentMouse.current.y, targetMouse.current.y, 0.08)

      const sp = currentScrollProgress.current
      const scale = 0.90 + sp * 0.16
      const translateY = (1 - sp) * 36
      const carInnerScale = 0.95 + sp * 0.08
      const opacity = 0.92 + sp * 0.08

      setMotionState({
        scale: Number(scale.toFixed(4)),
        translateY: Number(translateY.toFixed(2)),
        carInnerScale: Number(carInnerScale.toFixed(4)),
        opacity: Number(opacity.toFixed(3)),
        scrollProgress: Number(sp.toFixed(3)),
        mouseX: Number(currentMouse.current.x.toFixed(4)),
        mouseY: Number(currentMouse.current.y.toFixed(4)),
      })

      animFrameRef.current = requestAnimationFrame(updateLoop)
    }

    animFrameRef.current = requestAnimationFrame(updateLoop)

    return () => {
      window.removeEventListener('scroll', calculateScrollProgress)
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove)
        container.removeEventListener('mouseenter', handleMouseEnter)
        container.removeEventListener('mouseleave', handleMouseLeave)
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // Auto-switch car showcase with smooth progress timer (paused on hover)
  useEffect(() => {
    if (isHovered) return

    const duration = 7000
    const intervalTime = 50
    const step = (intervalTime / duration) * 100

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveCarIdx((curr) => (curr + 1) % SHOWCASE_CARS.length)
          return 0
        }
        return prev + step
      })
    }, intervalTime)

    return () => clearInterval(timer)
  }, [isHovered, activeCarIdx])

  const rotateX = -motionState.mouseY * 5 * motionState.scrollProgress
  const rotateY = motionState.mouseX * 7 * motionState.scrollProgress
  const mouseTranslateX = motionState.mouseX * 8 * motionState.scrollProgress
  const mouseTranslateY = motionState.mouseY * 6 * motionState.scrollProgress

  const scrollToCars = () => {
    if (typeof onSelectModel === 'function' && activeCar?.rawCategory) {
      onSelectModel(activeCar.rawCategory)
    } else {
      const el = document.getElementById('cars')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (!activeCar || showcaseCars.length === 0) {
    return (
      <div
        ref={containerRef}
        className="relative mx-auto mt-4 sm:mt-6 max-w-4xl px-3 sm:px-6 select-none"
      >
        <div className="relative z-10 mx-auto rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white/95 via-white/85 to-slate-50/90 p-6 sm:p-8 text-center shadow-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 mx-auto mb-3">
            <ShieldCheck size={24} />
          </div>
          <h3 className="font-display text-lg sm:text-xl font-extrabold text-slate-900">
            Bangalore's Premier Self-Drive Car Rental
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            10+ pickup hubs across Bangalore • Sanitized vehicles • Instant booking & doorstep delivery.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              onClick={scrollToCars}
              className="btn-accent text-xs !py-2.5 !px-4"
            >
              <span>Explore Fleet</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto mt-4 sm:mt-6 max-w-7xl xl:max-w-[1360px] px-3 sm:px-6 lg:px-8 select-none perspective-[1400px]"
    >
      {/* Background Animated Kinetic Road & Ambient Light Trails */}
      <div
        className="absolute -inset-x-8 -top-20 -bottom-16 pointer-events-none flex items-center justify-center overflow-visible transition-all duration-300"
        style={{
          transform: `scale(${0.85 + motionState.scrollProgress * 0.25})`,
          opacity: 0.5 + motionState.scrollProgress * 0.5,
        }}
      >
        {/* Layer 1: Dual Breathing Ambient Glow Orbs with Feathered Gaussian Blur */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 h-[420px] w-full max-w-3xl rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(234,88,12,0.25)_0%,_rgba(255,106,26,0.10)_45%,_transparent_65%)] blur-[75px] pointer-events-none animate-pulse-subtle transition-transform duration-700"
          style={{
            transform: `translate3d(${mouseTranslateX * 1.6}px, ${mouseTranslateY * 1.6}px, 0)`,
          }}
        />
        <div
          className="absolute -bottom-10 right-10 h-56 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.12)_0%,_transparent_65%)] blur-[50px] animate-float-slow pointer-events-none"
        />

        {/* Layer 2: Animated Kinetic Highway Perspective Lines */}
        <div className="absolute inset-x-8 bottom-2 h-20 opacity-60">
          <svg className="w-full h-full" viewBox="0 0 900 80" preserveAspectRatio="none" fill="none">
            <line x1="0" y1="78" x2="900" y2="78" stroke="#e2e8f0" strokeWidth="1" />
            <line
              x1="0"
              y1="78"
              x2="900"
              y2="78"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="16 16"
              className="animate-road-dash"
            />
            <line
              x1="120"
              y1="78"
              x2="410"
              y2="15"
              stroke="#ff6a1a"
              strokeWidth="1.5"
              strokeOpacity="0.45"
              strokeDasharray="12 12"
              className="animate-road-dash"
            />
            <line
              x1="780"
              y1="78"
              x2="490"
              y2="15"
              stroke="#ff6a1a"
              strokeWidth="1.5"
              strokeOpacity="0.45"
              strokeDasharray="12 12"
              className="animate-road-dash"
            />
          </svg>
        </div>

        {/* Layer 3: Moving Speed Light Streaks */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 overflow-hidden pointer-events-none opacity-40">
          <div className="h-full w-48 bg-gradient-to-r from-transparent via-accent-400 to-transparent animate-light-streak" />
        </div>
      </div>

      {/* Floating Orbit Badge 1 (Top Left) */}
      <div
        className="hidden lg:flex absolute -left-2 top-8 z-20 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur-sm animate-float pointer-events-none transition-transform duration-200"
        style={{
          transform: `translate3d(${-mouseTranslateX * 0.7}px, ${-mouseTranslateY * 0.7 + (1 - motionState.scrollProgress) * 20}px, 40px) scale(${0.85 + motionState.scrollProgress * 0.15})`,
          opacity: 0.6 + motionState.scrollProgress * 0.4,
        }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <KeyRound size={12} />
        </span>
        <span>Key Handover in 5 Mins</span>
      </div>

      {/* Floating Orbit Badge 2 (Top Right) */}
      <div
        className="hidden lg:flex absolute -right-2 top-14 z-20 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur-sm animate-float-delayed pointer-events-none transition-transform duration-200"
        style={{
          transform: `translate3d(${mouseTranslateX * 0.7}px, ${mouseTranslateY * 0.7 + (1 - motionState.scrollProgress) * 20}px, 40px) scale(${0.85 + motionState.scrollProgress * 0.15})`,
          opacity: 0.6 + motionState.scrollProgress * 0.4,
        }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <ShieldCheck size={13} />
        </span>
        <span>Sanitized &amp; Inspected</span>
      </div>

      {/* Main 3D Showcase Panel (Prominent, Wide & Immersive) */}
      <div
        className="relative z-10 mx-auto rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white/95 via-white/85 to-slate-50/90 p-6 sm:p-8 lg:p-9 xl:p-10 shadow-[0_20px_54px_-12px_rgba(15,23,42,0.14)] backdrop-blur-xs transition-shadow duration-300"
        style={{
          transform: `translate3d(${mouseTranslateX}px, ${motionState.translateY + mouseTranslateY}px, 0) scale(${motionState.scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          opacity: motionState.opacity,
          transformStyle: 'preserve-3d',
          willChange: 'transform, opacity',
        }}
      >
        {/* Top Header Bar: Category Switcher Tabs & Live Status */}
        <div className="relative pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Category Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
              {showcaseCars.map((car, idx) => (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => {
                    setActiveCarIdx(idx)
                    setProgress(0)
                  }}
                  className={`relative rounded-lg px-2.5 sm:px-3 py-1 text-[11px] font-bold transition-all ${
                    safeIdx === idx
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {car.category}
                </button>
              ))}
            </div>

            {/* Live Model Badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent-700 bg-accent-50/90 border border-accent-200/70 px-2.5 py-1 rounded-lg shadow-2xs">
              <Sparkles size={12} className="text-accent-500" />
              <span>{activeCar.tag}</span>
            </div>
          </div>

          {/* Micro Progress Bar */}
          <div className="absolute -bottom-[1px] left-0 h-[2px] bg-slate-100 w-full overflow-hidden rounded-full">
            <div
              className="h-full bg-accent-500 transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Central Vehicle Visual Stage (Large & Prominent) */}
        <div className="relative mt-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-8 min-h-[340px] sm:min-h-[400px] lg:min-h-[460px]">
          
          {/* Left Column: Information & Specs Matrix */}
          <div
            className="lg:col-span-4 xl:col-span-4 space-y-4 text-left transition-transform duration-200"
            style={{
              transform: `translate3d(${-mouseTranslateX * 0.4}px, ${-mouseTranslateY * 0.4}px, 20px)`,
            }}
          >
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Instant Availability • Bangalore
              </span>
              <h3 className="font-display text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {activeCar.name}
              </h3>
            </div>

            <div>
              <span className="text-xs font-medium text-slate-400 block mb-0.5">Special Tariff</span>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900">
                  {activeCar.price}
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 rounded-md px-2 py-0.5">
                  ✓ Doorstep Delivery
                </span>
              </div>
            </div>

            {/* Performance Spec Badges */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                <Gauge size={15} className="text-accent-500 shrink-0" />
                <span className="truncate">{activeCar.speed}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                <Zap size={15} className="text-accent-500 shrink-0" />
                <span className="truncate">{activeCar.fuel}</span>
              </div>
            </div>

            {/* Instant Fleet Link */}
            <div className="pt-2">
              <button
                type="button"
                onClick={scrollToCars}
                className="btn-dark w-full sm:w-auto text-xs !py-2.5 !px-4 justify-center"
              >
                <span>View {activeCar.category} in Fleet</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Right Column: Large High-Impact Vehicle Photo */}
          <div className="relative lg:col-span-8 xl:col-span-8 flex flex-col items-center justify-center">
            
            {/* Ambient Ground Shadow */}
            <div
              className="absolute -bottom-1 h-5 w-4/5 rounded-full bg-slate-900/20 blur-md transition-all duration-300"
              style={{
                transform: `scale(${motionState.scale * (1 + Math.abs(motionState.mouseX) * 0.08)}) translate3d(${mouseTranslateX * 0.5}px, 0, 0)`,
                opacity: 0.4 + motionState.scrollProgress * 0.6,
              }}
            />

            {/* Large Vehicle Photo Frame */}
            <div
              className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/90 bg-slate-100 aspect-[16/9] shadow-xs transition-transform duration-200 animate-float"
              style={{
                transform: `translate3d(${mouseTranslateX * 0.7}px, ${mouseTranslateY * 0.7}px, 30px) scale(${motionState.carInnerScale})`,
                transformStyle: 'preserve-3d',
              }}
            >
              <img
                key={activeCar.image}
                src={activeCar.image}
                alt={`${activeCar.name} self-drive car rental in Bangalore`}
                className="h-full w-full object-cover object-center transition-all duration-700 animate-fade-in"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1400&q=85'
                }}
              />
              
              {/* Glass Glare Sweep Overlay */}
              <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none animate-shine-sweep" />

              {/* Floating Live Badge inside photo */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ready for Handover Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Badges Bar */}
        <div
          className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-semibold text-slate-700 transition-transform duration-200"
          style={{
            transform: `translate3d(${mouseTranslateX * 0.25}px, ${mouseTranslateY * 0.25}px, 15px)`,
          }}
        >
          <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-slate-50/80">
            <MapPin size={12} className="text-accent-500 shrink-0" />
            <span className="truncate">10+ Bangalore Hubs</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-slate-50/80">
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
            <span className="truncate">Free Doorstep Delivery</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-slate-50/80">
            <Shield size={12} className="text-accent-500 shrink-0" />
            <span className="truncate">All-Inclusive Insurance</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-slate-50/80">
            <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
            <span className="truncate">500+ Verified Trips</span>
          </div>
        </div>
      </div>
    </div>
  )
}
