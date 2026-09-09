import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Calendar,
  MapPin,
  ArrowRight,
  CreditCard,
  Lock,
  Loader2,
  Download,
} from 'lucide-react'
import { pickupLocations } from '../config/business.js'
import { useCars } from '../context/CarContext.jsx'
import { formatPrice, formatDate, calculateDays, calculateTotal, todayStr } from '../utils/pricing.js'
import { createWhatsAppLink, createCallLink } from '../utils/whatsapp.js'
import { loadRazorpaySDK, createBackendOrder, verifyBackendPayment } from '../utils/razorpay.js'

const PHONE_REGEX = /^[6-9]\d{9}$/
const FALLBACK_CAR_IMAGE = 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80'

export default function BookingModal({ car, search, onClose }) {
  const { cars, updateCar, addInquiry } = useCars()

  // Ensure default car is always a real, existing car from inventory
  const initialCar = (car && car.id && car.brand) ? car : (cars[0] || {})
  const [selectedCarId, setSelectedCarId] = useState(String(initialCar.id || '1'))

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    pickupLocation: search?.pickupLocation || pickupLocations[0],
    pickupDate: search?.pickupDate || todayStr(),
    returnDate: search?.returnDate || '',
    needChauffeur: false,
    specialRequests: '',
  })

  const [errors, setErrors] = useState({})
  const [isPaying, setIsPaying] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [confirmedBookingData, setConfirmedBookingData] = useState(null)
  const [isOfflineSubmitted, setIsOfflineSubmitted] = useState(false)

  // Update selected car if prop changes
  useEffect(() => {
    if (car && car.id) {
      setSelectedCarId(String(car.id))
    } else if (cars.length > 0 && !selectedCarId) {
      setSelectedCarId(String(cars[0].id))
    }
  }, [car, cars])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Resolve selected car object reliably
  const selectedCar =
    cars.find((c) => String(c.id) === String(selectedCarId)) ||
    (car && car.brand ? car : cars[0]) ||
    {
      id: 1,
      brand: 'Maruti Suzuki',
      model: 'Swift',
      category: 'Hatchback',
      transmission: 'Manual',
      pricePerDay: 1499,
      image: FALLBACK_CAR_IMAGE,
    }

  const update = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: val }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Full name is required.'
    const rawPhone = form.phone.trim().replace(/\D/g, '')
    if (!PHONE_REGEX.test(rawPhone))
      next.phone = 'Enter a valid 10-digit Indian mobile number.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      next.email = 'Enter a valid email address.'
    if (!form.pickupDate) next.pickupDate = 'Pickup date is required.'
    if (!form.returnDate) next.returnDate = 'Return date is required.'
    if (form.pickupDate && form.returnDate && calculateDays(form.pickupDate, form.returnDate) === -1)
      next.returnDate = 'Return date must be on or after pickup date.'
    
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const days = calculateDays(form.pickupDate, form.returnDate)
  const validDays = days > 0 ? days : 1
  const dailyRate = Number(selectedCar?.pricePerDay) > 0 ? Number(selectedCar.pricePerDay) : 1499
  const priceInfo = calculateTotal(dailyRate, validDays)

  // --------------------------------------------------------------------------
  // Primary Action: Online Payment & Booking Confirmation via Razorpay
  // --------------------------------------------------------------------------
  const handleRazorpayPayment = async (e) => {
    e.preventDefault()
    setPaymentError('')

    if (!validate()) return

    if (!priceInfo || priceInfo.total <= 0) {
      setPaymentError('Invalid total booking amount. Please check the dates.')
      return
    }

    try {
      setIsPaying(true)

      // 1. Call backend to create Razorpay order securely
      const orderPayload = {
        carId: selectedCar.id,
        carName: `${selectedCar.brand} ${selectedCar.model}`,
        pricePerDay: dailyRate,
        pickupDate: form.pickupDate,
        returnDate: form.returnDate,
        pickupLocation: form.pickupLocation,
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        customerEmail: form.email.trim(),
        needChauffeur: form.needChauffeur,
        specialRequests: form.specialRequests.trim(),
      }

      const orderData = await createBackendOrder(orderPayload)

      if (!orderData || !orderData.orderId || !orderData.keyId) {
        throw new Error(
          orderData?.message || 'Server did not return a valid Razorpay order ID or Key ID.'
        )
      }

      // 2. Load official Razorpay Checkout SDK
      const sdkLoaded = await loadRazorpaySDK()
      if (!sdkLoaded) {
        throw new Error('Could not load Razorpay Checkout SDK. Please check your internet connection.')
      }

      // 3. Initialize Razorpay Checkout Options
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'BLR CRUIZ Self-Drive Bangalore',
        description: `Rental: ${selectedCar.brand} ${selectedCar.model} (${validDays} Days)`,
        image: selectedCar.image || FALLBACK_CAR_IMAGE,
        order_id: orderData.orderId,
        prefill: {
          name: form.name.trim(),
          email: form.email.trim(),
          contact: form.phone.trim(),
        },
        notes: {
          carId: String(selectedCar.id),
          pickupHub: form.pickupLocation,
          duration: `${validDays} Days`,
        },
        theme: {
          color: '#ff6a1a',
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false)
            setPaymentError('Payment was cancelled. No amount was charged.')
          },
        },
        handler: async (response) => {
          try {
            setIsVerifying(true)

            // 4. Send payment response to backend for cryptographic signature verification
            const verifyResult = await verifyBackendPayment(response, {
              ...orderPayload,
              grandTotal: priceInfo.total,
              days: validDays,
            })

            if (verifyResult.success) {
              setConfirmedBookingData(verifyResult.booking)

              // Mark car as booked/reserved
              if (selectedCar?.id) {
                updateCar(selectedCar.id, { available: false })
              }

              // Also log into centralized inquiries store
              addInquiry({
                name: form.name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                carName: `${selectedCar?.brand} ${selectedCar?.model}`,
                pickupDate: form.pickupDate,
                returnDate: form.returnDate,
                pickupLocation: form.pickupLocation,
                status: 'Paid & Confirmed',
                estimatedTotal: `₹${priceInfo.total}`,
                message: `[ONLINE PAYMENT PAID] Ref: ${verifyResult.bookingId} | Payment ID: ${response.razorpay_payment_id}`,
              })
            } else {
              throw new Error(verifyResult.message || 'Payment signature verification failed.')
            }
          } catch (verifyErr) {
            console.error('Verification error:', verifyErr)
            setPaymentError(verifyErr.message || 'Payment verification failed on the server.')
          } finally {
            setIsVerifying(false)
            setIsPaying(false)
          }
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (failResp) => {
        setIsPaying(false)
        setPaymentError(`Payment failed: ${failResp.error.description || 'Transaction declined.'}`)
      })

      rzp.open()
    } catch (err) {
      console.error('Order creation error:', err)
      setIsPaying(false)
      setPaymentError(
        err.message || 'Failed to initiate Razorpay order. You can also submit an inquiry via WhatsApp below.'
      )
    }
  }

  // --------------------------------------------------------------------------
  // Secondary Action: Offline / WhatsApp Request
  // --------------------------------------------------------------------------
  const handleOfflineSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    addInquiry({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      carName: `${selectedCar?.brand} ${selectedCar?.model}`,
      pickupDate: form.pickupDate,
      returnDate: form.returnDate,
      pickupLocation: form.pickupLocation,
      message: `${form.needChauffeur ? '[Chauffeur Requested] ' : ''}${form.specialRequests.trim()}`,
      estimatedTotal: priceInfo?.total || 0,
      status: 'Pending Verification',
    })

    setIsOfflineSubmitted(true)
  }

  const confirmedWhatsAppMessage = confirmedBookingData
    ? `Hello BLR CRUIZ team! I have completed my payment for Booking *#${confirmedBookingData.bookingId}*:
• *Vehicle*: ${selectedCar.brand} ${selectedCar.model}
• *Pickup Hub*: ${form.pickupLocation}
• *Dates*: ${formatDate(form.pickupDate)} to ${formatDate(form.returnDate)} (${validDays} Days)
• *Payment ID*: ${confirmedBookingData.razorpay_payment_id}
• *Amount Paid*: ₹${confirmedBookingData.amountPaid}
Please send vehicle handover details and dispatch contact.`
    : ''

  const offlineWhatsAppMessage = `Hello BLR CRUIZ team, I would like to reserve the *${selectedCar?.brand} ${selectedCar?.model}*:
• *Pickup Hub*: ${form.pickupLocation}
• *Duration*: ${formatDate(form.pickupDate)} to ${formatDate(form.returnDate)} (${validDays} days)
• *Name*: ${form.name}
• *Phone*: ${form.phone}
Please confirm vehicle availability and handover terms.`

  const modalJSX = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Booking and payment form"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94vh] w-full max-w-xl animate-scale-in overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl border border-slate-200"
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-slate-900">
              {confirmedBookingData
                ? 'Booking Confirmed & Paid'
                : isOfflineSubmitted
                ? 'Reservation Request Logged'
                : 'Secure Booking & Payment'}
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Close booking form"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ================================================================== */}
        {/* VIEW A: Verified Paid & Confirmed Screen */}
        {/* ================================================================== */}
        {confirmedBookingData ? (
          <div className="flex flex-col items-center px-5 py-8 text-center sm:px-8">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={32} />
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-[11px] font-bold text-emerald-700 mb-2">
              <Lock size={12} />
              <span>Payment Verified &amp; Confirmed</span>
            </span>

            <h4 className="font-display text-xl font-black text-slate-900">
              Booking Confirmed!
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Your vehicle reservation is locked and confirmed. Our Bangalore dispatch team has received your schedule.
            </p>

            {/* Receipt Summary Card */}
            <div className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Booking ID</span>
                <span className="font-mono font-bold text-accent-600 text-sm">
                  {confirmedBookingData.bookingId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment ID</span>
                <span className="font-mono font-semibold text-slate-700">
                  {confirmedBookingData.razorpay_payment_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Vehicle</span>
                <span className="font-bold text-slate-900">
                  {selectedCar.brand} {selectedCar.model} ({selectedCar.transmission || 'Automatic'})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Pickup Hub</span>
                <span className="font-semibold text-slate-800">{form.pickupLocation}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Rental Dates</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(form.pickupDate)} → {formatDate(form.returnDate)} ({validDays} Days)
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-900">Total Paid (All Inclusive)</span>
                <span className="font-display font-black text-slate-900 text-sm text-emerald-600">
                  {formatPrice(confirmedBookingData.amountPaid || priceInfo?.total)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
              <a
                href={createWhatsAppLink(confirmedWhatsAppMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp flex-1 py-2.5 text-xs font-bold justify-center"
              >
                <MessageCircle size={16} />
                <span>Get Handover on WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-outline flex-1 py-2.5 text-xs font-bold justify-center"
              >
                <Download size={14} />
                <span>Print / Save Receipt</span>
              </button>
            </div>
          </div>
        ) : isOfflineSubmitted ? (
          /* ================================================================ */
          /* VIEW B: Offline Request Submitted Screen                          */
          /* ================================================================ */
          <div className="flex flex-col items-center px-5 py-10 text-center sm:px-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-800">
              <CheckCircle2 size={32} />
            </div>

            <span className="section-eyebrow !mb-1.5">Request Ref #{Date.now().toString().slice(-6)}</span>
            <h4 className="font-display text-xl font-bold text-slate-900">
              Thank you, {form.name}!
            </h4>
            <p className="mt-1.5 max-w-md text-xs text-slate-600 leading-relaxed">
              Your inquiry for the <strong className="text-slate-900 font-bold">{selectedCar.brand} {selectedCar.model}</strong> has been logged. Our dispatch desk will reach out via WhatsApp shortly.
            </p>

            <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
              <a
                href={createWhatsAppLink(offlineWhatsAppMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp flex-1 py-2.5 text-xs font-bold justify-center"
              >
                <MessageCircle size={16} />
                <span>Confirm on WhatsApp</span>
              </a>
              <a
                href={createCallLink()}
                className="btn-outline flex-1 py-2.5 text-xs font-bold justify-center"
              >
                <Phone size={15} />
                <span>Call Dispatch Desk</span>
              </a>
            </div>
          </div>
        ) : (
          /* ================================================================ */
          /* VIEW C: Main Booking & Razorpay Payment Form                      */
          /* ================================================================ */
          <form onSubmit={handleRazorpayPayment} className="px-5 py-5 sm:px-7 space-y-4">
            
            {/* Error Notification Banner */}
            {paymentError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2 animate-fade-in">
                <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Payment Notice</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">{paymentError}</p>
                </div>
              </div>
            )}

            {/* Selected Car Highlight Banner */}
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="relative w-24 aspect-[16/9] shrink-0 overflow-hidden rounded-lg bg-slate-200 border border-slate-300/60">
                <img
                  src={selectedCar.image || FALLBACK_CAR_IMAGE}
                  alt={`${selectedCar.brand} ${selectedCar.model} rental car in Bangalore`}
                  className="h-full w-full object-cover object-center"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = FALLBACK_CAR_IMAGE
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {selectedCar.category || 'Vehicle'} • {selectedCar.transmission || 'Automatic'}
                </span>
                <h4 className="font-display text-sm font-bold text-slate-900 truncate">
                  {selectedCar.brand} {selectedCar.model}
                </h4>
                <p className="text-xs text-accent-600 font-black mt-0.5">
                  {formatPrice(dailyRate)}/day
                </p>
              </div>
            </div>

            {/* Vehicle Selector */}
            <div>
              <label htmlFor="b-car" className="label-field">Selected Vehicle</label>
              <select
                id="b-car"
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                className="input-field text-xs py-2 font-semibold"
              >
                {cars.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.brand} {c.model} ({c.category} • {c.transmission}) — {formatPrice(c.pricePerDay)}/day
                  </option>
                ))}
              </select>
            </div>

            {/* Full Name & Phone */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="b-name" className="label-field">Full Name *</label>
                <input
                  id="b-name"
                  type="text"
                  value={form.name}
                  onChange={update('name')}
                  className="input-field text-xs py-2 font-semibold"
                  placeholder="e.g. Rahul Sharma"
                />
                {errors.name && <FieldError msg={errors.name} />}
              </div>

              <div>
                <label htmlFor="b-phone" className="label-field">Mobile Number *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    +91
                  </span>
                  <input
                    id="b-phone"
                    type="tel"
                    value={form.phone}
                    onChange={update('phone')}
                    className="input-field pl-10 text-xs py-2 font-semibold"
                    placeholder="94482 77091"
                  />
                </div>
                {errors.phone && <FieldError msg={errors.phone} />}
              </div>
            </div>

            {/* Email & Pickup Hub */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="b-email" className="label-field">Email Address</label>
                <input
                  id="b-email"
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  className="input-field text-xs py-2 font-semibold"
                  placeholder="e.g. rahul@example.com"
                />
                {errors.email && <FieldError msg={errors.email} />}
              </div>

              <div>
                <label htmlFor="b-loc" className="label-field">Pickup Hub in Bangalore</label>
                <select
                  id="b-loc"
                  value={form.pickupLocation}
                  onChange={update('pickupLocation')}
                  className="input-field text-xs py-2 font-semibold"
                >
                  {pickupLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="b-pickup" className="label-field">Pickup Date *</label>
                <input
                  id="b-pickup"
                  type="date"
                  min={todayStr()}
                  value={form.pickupDate}
                  onChange={update('pickupDate')}
                  className="input-field text-xs py-2 font-semibold"
                />
                {errors.pickupDate && <FieldError msg={errors.pickupDate} />}
              </div>

              <div>
                <label htmlFor="b-return" className="label-field">Return Date *</label>
                <input
                  id="b-return"
                  type="date"
                  min={form.pickupDate || todayStr()}
                  value={form.returnDate}
                  onChange={update('returnDate')}
                  className="input-field text-xs py-2 font-semibold"
                />
                {errors.returnDate && <FieldError msg={errors.returnDate} />}
              </div>
            </div>

            {/* Fare Summary Breakdown */}
            {priceInfo && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Rental Duration</span>
                  <span className="font-semibold text-slate-900">{validDays} Day{validDays > 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Base Fare ({formatPrice(dailyRate)} × {validDays})</span>
                  <span className="font-semibold text-slate-900">{formatPrice(priceInfo.base)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (5%)</span>
                  <span className="font-semibold text-slate-900">{formatPrice(priceInfo.tax)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900">Total Payable Amount</span>
                  <span className="font-display text-base font-black text-slate-900">
                    {formatPrice(priceInfo.total)}
                  </span>
                </div>
              </div>
            )}

            {/* Payment & Submit Actions */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isPaying || isVerifying || !priceInfo || priceInfo.total <= 0}
                className="btn-accent w-full py-3 text-xs font-bold justify-center disabled:opacity-75 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
              >
                {isVerifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Payment Signature...</span>
                  </>
                ) : isPaying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Initiating Razorpay Checkout...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={15} />
                    <span>Pay {formatPrice(priceInfo?.total || 0)} &amp; Confirm with Razorpay</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <ShieldCheck size={13} />
                  <span>256-Bit SSL Encrypted</span>
                </span>
                <span>UPI • Cards • NetBanking</span>
              </div>

              {/* Alternative Offline Request Button */}
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Prefer manual booking?</span>
                <button
                  type="button"
                  onClick={handleOfflineSubmit}
                  className="text-xs font-bold text-accent-600 hover:text-accent-700 underline"
                >
                  Submit Inquiry via WhatsApp
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : null
}

function FieldError({ msg }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-600">
      <AlertCircle size={12} className="shrink-0" />
      <span>{msg}</span>
    </p>
  )
}
