import React, { useState, useMemo, useEffect } from 'react'
import {
  Car,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Star,
  Users,
  Fuel,
  Settings,
  Eye,
  RotateCcw,
  Sparkles,
  MapPin,
  Calendar,
  Images,
} from 'lucide-react'
import { useCars } from '../../context/CarContext.jsx'
import { formatPrice } from '../../utils/pricing.js'
import CarFormModal from '../components/CarFormModal.jsx'
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx'
import DeleteAllConfirmModal from '../components/DeleteAllConfirmModal.jsx'

const STATUS_OPTIONS = ['All Statuses', 'Available', 'Booked', 'Popular']

export default function AdminCars() {
  const {
    cars = [],
    addCar,
    updateCar,
    deleteCar,
    deleteAllCars,
    toggleAvailability,
    togglePopular,
    resetCars,
    loading = false,
    locations = [],
    refreshData,
  } = useCars() || {}

  useEffect(() => {
    if (typeof refreshData === 'function') {
      refreshData()
    }
  }, [refreshData])

  // Build a quick location id→name lookup
  const locationMap = useMemo(() => {
    const m = {}
    const locList = Array.isArray(locations) ? locations : []
    for (const loc of locList) {
      if (loc && loc.id) m[loc.id] = loc
    }
    return m
  }, [locations])

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [sortBy, setSortBy] = useState('id-asc')

  // Modals state
  const [editingCar, setEditingCar] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingCar, setDeletingCar] = useState(null)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState(null)

  const safeCarsList = Array.isArray(cars) ? cars : []

  // Dynamically compute category filters based on current cars
  const dynamicCategories = useMemo(() => {
    const raw = Array.from(new Set(safeCarsList.map((c) => c?.category).filter(Boolean)))
    return ['All', ...raw]
  }, [safeCarsList])

  // Filter and sort logic
  const filteredCars = useMemo(() => {
    let result = safeCarsList.filter((car) => {
      if (!car) return false

      // Category match
      const matchCat = categoryFilter === 'All' || car.category === categoryFilter

      // Status match
      let matchStatus = true
      if (statusFilter === 'Available') matchStatus = car.available === true
      if (statusFilter === 'Booked') matchStatus = car.available === false
      if (statusFilter === 'Popular') matchStatus = car.popular === true

      // Search query match
      const q = query.trim().toLowerCase()
      const matchQuery =
        !q ||
        (car.brand || '').toLowerCase().includes(q) ||
        (car.model || '').toLowerCase().includes(q) ||
        (car.category || '').toLowerCase().includes(q) ||
        (car.transmission || '').toLowerCase().includes(q) ||
        (car.fuel || '').toLowerCase().includes(q) ||
        String(car.year || '').includes(q)

      return matchCat && matchStatus && matchQuery
    })

    // Sort
    switch (sortBy) {
      case 'price-asc':
        return [...result].sort((a, b) => (Number(a?.pricePerDay) || 0) - (Number(b?.pricePerDay) || 0))
      case 'price-desc':
        return [...result].sort((a, b) => (Number(b?.pricePerDay) || 0) - (Number(a?.pricePerDay) || 0))
      case 'rating-desc':
        return [...result].sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0))
      case 'year-desc':
        return [...result].sort((a, b) => (Number(b?.year) || 0) - (Number(a?.year) || 0))
      case 'id-desc':
        return [...result].sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0))
      case 'id-asc':
      default:
        return [...result].sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0))
    }
  }, [safeCarsList, query, categoryFilter, statusFilter, sortBy])

  // Save handler for Add / Edit
  const handleSaveCar = async (formData) => {
    setActionLoading(true)
    let res
    if (editingCar) {
      res = await updateCar(editingCar.id, formData)
    } else {
      res = await addCar(formData)
    }
    setActionLoading(false)

    if (res && res.success) {
      setEditingCar(null)
      setShowAddModal(false)
      setNotification({
        type: 'success',
        message: editingCar ? 'Vehicle updated successfully.' : 'Vehicle added to inventory successfully.',
      })
      setTimeout(() => setNotification(null), 4000)
    } else {
      setNotification({
        type: 'error',
        message: res?.error || 'Failed to save vehicle details',
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  // Delete single car handler
  const handleConfirmDelete = async () => {
    if (!deletingCar) return
    setActionLoading(true)
    setNotification(null)
    const carName = `${deletingCar.brand || 'Vehicle'} ${deletingCar.model || ''}`.trim()
    const res = await deleteCar(deletingCar.id)
    setActionLoading(false)

    if (res && res.success) {
      setDeletingCar(null)
      setNotification({
        type: 'success',
        message: `Vehicle "${carName}" was permanently deleted from inventory.`,
      })
      setTimeout(() => setNotification(null), 4000)
    } else {
      setNotification({
        type: 'error',
        message: res?.error || 'Failed to delete vehicle from server.',
      })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  // Delete all vehicles handler
  const handleConfirmDeleteAll = async () => {
    setActionLoading(true)
    setNotification(null)
    const res = await deleteAllCars()
    setActionLoading(false)
    setShowDeleteAllModal(false)

    if (res && res.success) {
      setNotification({
        type: 'success',
        message: `All ${res.deletedCount || 0} vehicles were permanently deleted from inventory.`,
      })
      setTimeout(() => setNotification(null), 5000)
    } else {
      setNotification({
        type: 'error',
        message: res?.error || 'Failed to delete all vehicles from server.',
      })
      setTimeout(() => setNotification(null), 6000)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-charcoal-900">
            Car Inventory ({safeCarsList.length})
          </h2>
          <p className="text-xs text-charcoal-500">
            Manage your live vehicle catalog. Changes immediately update the public website.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {safeCarsList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAllModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50/80 px-3.5 py-2.5 text-xs font-bold text-red-600 shadow-xs hover:bg-red-100 hover:border-red-400 hover:text-red-700 transition-all active:scale-95"
              title="Permanently delete all vehicles from inventory"
            >
              <Trash2 size={15} className="shrink-0 text-red-500" />
              <span>Delete All Vehicles</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn-accent text-xs !py-2.5 !px-4"
          >
            <Plus size={16} />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-3.5 text-xs font-semibold animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <XCircle size={16} className="text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-charcoal-900/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by brand, model, transmission, fuel, year..."
              className="input-field pl-10 text-xs py-2.5"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-auto text-xs py-2"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field w-auto text-xs py-2"
              aria-label="Sort inventory"
            >
              <option value="id-asc">Sort: Default Order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="year-desc">Newest Year</option>
              <option value="rating-desc">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-charcoal-900/5">
          {dynamicCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                categoryFilter === cat
                  ? 'bg-accent-500 text-white shadow-sm'
                  : 'bg-charcoal-100 text-charcoal-700 hover:bg-charcoal-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table / Grid / Empty State */}
      {filteredCars.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-charcoal-900/10 bg-white py-16 text-center shadow-sm px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal-100 text-charcoal-400 mb-3">
            <Car size={32} />
          </div>
          <h3 className="font-display text-base font-bold text-charcoal-900">
            {safeCarsList.length === 0 ? 'No vehicles in inventory' : 'No matching vehicles found'}
          </h3>
          <p className="text-xs text-charcoal-500 mt-1 max-w-sm">
            {safeCarsList.length === 0
              ? 'Your fleet catalog is currently empty. Click "Add Vehicle" to add your first car to the live inventory.'
              : 'Try adjusting your search terms or filter criteria.'}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {safeCarsList.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="btn-accent text-xs !py-2.5 !px-5"
              >
                <Plus size={15} />
                <span>Add First Vehicle</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setCategoryFilter('All')
                  setStatusFilter('All Statuses')
                }}
                className="btn-dark text-xs !py-2 !px-4"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-charcoal-900/10 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-charcoal-900/10 bg-charcoal-50/70 text-[11px] font-bold uppercase tracking-wider text-charcoal-500">
                <tr>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Specs</th>
                  <th className="px-4 py-3.5">Daily Rate</th>
                  <th className="px-4 py-3.5">Locations</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Featured</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-900/5 font-medium text-charcoal-700">
                {filteredCars.map((car) => {
                  const carImages = Array.isArray(car?.images) && car.images.length > 0
                    ? car.images
                    : (car?.image ? [car.image] : [])
                  const imageCount = carImages.length
                  const displayImage = carImages[0] || 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'

                  return (
                    <tr key={car.id} className="hover:bg-charcoal-50/50 transition-colors">
                      {/* Vehicle image & brand */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-charcoal-100 ring-1 ring-charcoal-900/10">
                            <img
                              src={displayImage}
                              alt={`${car.brand || 'Vehicle'} ${car.model || ''}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {imageCount > 1 && (
                              <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-charcoal-950/75 px-1 py-0.2 text-[9px] font-bold text-white backdrop-blur-xs">
                                <Images size={9} /> {imageCount}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-display text-sm font-bold text-charcoal-900">
                              {car.brand} {car.model}
                            </p>
                            <p className="text-[11px] text-charcoal-400 font-medium">
                              {car.year || 2026} Model • ID #{car.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4">
                        <span className="rounded-lg bg-charcoal-100 px-2.5 py-1 text-[11px] font-bold text-charcoal-800">
                          {car.category || 'Standard'}
                        </span>
                      </td>

                      {/* Specs */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1 text-[11px] text-charcoal-600">
                          <span className="flex items-center gap-1">
                            <Settings size={12} className="text-charcoal-400" /> {car.transmission || 'Automatic'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Fuel size={12} className="text-charcoal-400" /> {car.fuel || 'Petrol'} • {car.seats || 5} Seats
                          </span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-4 font-display font-extrabold text-sm text-charcoal-900">
                        {formatPrice(car.pricePerDay || 1500)}
                        <span className="text-[10px] font-normal text-charcoal-400">/day</span>
                      </td>

                      {/* Locations */}
                      <td className="px-4 py-4 max-w-[160px]">
                        {Array.isArray(car.locations) && car.locations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {car.locations.slice(0, 2).map((lid) => {
                              const loc = locationMap[lid]
                              return loc ? (
                                <span
                                  key={lid}
                                  className="inline-flex items-center gap-0.5 rounded-md bg-accent-50 border border-accent-200/60 px-1.5 py-0.5 text-[10px] font-bold text-accent-700 truncate max-w-[120px]"
                                >
                                  <MapPin size={9} className="shrink-0" />
                                  <span className="truncate">{(loc.name || '').split(' ')[0]}</span>
                                </span>
                              ) : null
                            })}
                            {car.locations.length > 2 && (
                              <span className="rounded-md bg-charcoal-100 px-1.5 py-0.5 text-[10px] font-bold text-charcoal-600">
                                +{car.locations.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-charcoal-400">All Hubs</span>
                        )}
                      </td>

                      {/* Availability Toggle */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => toggleAvailability && toggleAvailability(car.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all shadow-xs ${
                            car.available
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-charcoal-200 text-charcoal-700 hover:bg-charcoal-300'
                          }`}
                          title="Click to toggle availability"
                        >
                          {car.available ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-600" /> Available
                            </>
                          ) : (
                            <>
                              <XCircle size={12} className="text-charcoal-500" /> Booked
                            </>
                          )}
                        </button>
                      </td>

                      {/* Popular / Featured Toggle */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => togglePopular && togglePopular(car.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                            car.popular
                              ? 'bg-accent-50 text-accent-700 hover:bg-accent-100 border border-accent-200'
                              : 'text-charcoal-400 hover:text-charcoal-700 bg-charcoal-50'
                          }`}
                          title="Click to toggle featured status"
                        >
                          <Star
                            size={12}
                            className={car.popular ? 'fill-accent-500 text-accent-500' : ''}
                          />
                          {car.popular ? 'Featured' : 'Standard'}
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingCar(car)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-900/10 text-charcoal-600 hover:bg-charcoal-100 hover:text-charcoal-900 transition-colors"
                            title="Edit Vehicle"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCar(car)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-900/10 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            title="Delete Vehicle"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(showAddModal || editingCar) && (
        <CarFormModal
          car={editingCar}
          onSave={handleSaveCar}
          onClose={() => {
            setShowAddModal(false)
            setEditingCar(null)
          }}
          loading={actionLoading}
        />
      )}

      {/* Delete Single Car Confirmation Modal */}
      {deletingCar && (
        <DeleteConfirmModal
          title={`Delete ${deletingCar.brand || 'Vehicle'} ${deletingCar.model || ''}?`}
          message={`Are you sure you want to delete this vehicle from your inventory? It will immediately disappear from the public website and booking options.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingCar(null)}
          loading={actionLoading}
        />
      )}

      {/* Delete All Vehicles Safety Confirmation Modal */}
      {showDeleteAllModal && (
        <DeleteAllConfirmModal
          carsCount={safeCarsList.length}
          onConfirm={handleConfirmDeleteAll}
          onCancel={() => setShowDeleteAllModal(false)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
