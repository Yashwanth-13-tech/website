import React, { useState, useEffect } from 'react'
import { Car, CheckCircle2, XCircle, Star, MessageSquare, DollarSign, Plus, ArrowRight, TrendingUp, Calendar, MapPin, Eye } from 'lucide-react'
import { useCars } from '../../context/CarContext.jsx'
import { formatPrice } from '../../utils/pricing.js'
import StatCard from '../components/StatCard.jsx'
import CarFormModal from '../components/CarFormModal.jsx'
import InquiryDetailsModal from '../components/InquiryDetailsModal.jsx'

export default function AdminDashboard({ setActiveTab }) {
  const { cars, inquiries, addCar, updateInquiryStatus, deleteInquiry, refreshData } = useCars()
  const [showAddCarModal, setShowAddCarModal] = useState(false)
  const [selectedInquiry, setSelectedInquiry] = useState(null)
  const [savingCar, setSavingCar] = useState(false)

  useEffect(() => {
    if (typeof refreshData === 'function') {
      refreshData()
    }
  }, [refreshData])

  // Computed Metrics
  const totalCars = cars.length
  const availableCars = cars.filter((c) => c.available).length
  const bookedCars = totalCars - availableCars
  const popularCars = cars.filter((c) => c.popular).length
  const totalInquiries = inquiries.length
  const newInquiries = inquiries.filter((i) => i.status === 'New').length

  const avgPrice = totalCars > 0
    ? Math.round(cars.reduce((sum, c) => sum + Number(c.pricePerDay || 0), 0) / totalCars)
    : 0

  // Category breakdown
  const categoryCounts = cars.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1
    return acc
  }, {})

  const handleAddCar = async (carData) => {
    setSavingCar(true)
    const res = await addCar(carData)
    setSavingCar(false)
    if (res.success) {
      setShowAddCarModal(false)
    } else {
      alert(res.error || 'Failed to add car')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome Banner */}
      <div className="flex flex-col gap-4 rounded-3xl bg-charcoal-950 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <span className="inline-block rounded-full bg-accent-500/20 border border-accent-500/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-400 mb-2">
            Fleet Operations
          </span>
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
            Welcome to BLR CRUIZ Hub
          </h2>
          <p className="mt-1 text-xs text-white/70 sm:text-sm max-w-xl">
            You currently have <strong className="text-white">{availableCars} active vehicles</strong> ready for rental across Bangalore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddCarModal(true)}
            className="btn-accent text-xs !py-3 !px-4"
          >
            <Plus size={16} />
            <span>Add New Car</span>
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className="btn-outline text-xs !py-3 !px-4"
          >
            <MessageSquare size={16} />
            <span>View Leads ({newInquiries} new)</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Total Fleet"
          value={totalCars}
          subtitle="Vehicles registered"
          icon={Car}
          color="charcoal"
        />
        <StatCard
          title="Available"
          value={availableCars}
          subtitle="Ready to rent"
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          title="Booked / Out"
          value={bookedCars}
          subtitle="On active trips"
          icon={XCircle}
          color="amber"
        />
        <StatCard
          title="Featured"
          value={popularCars}
          subtitle="Highlighted cars"
          icon={Star}
          color="accent"
        />
        <StatCard
          title="Total Leads"
          value={totalInquiries}
          subtitle={`${newInquiries} uncontacted`}
          icon={MessageSquare}
          color="blue"
        />
        <StatCard
          title="Avg Daily Rate"
          value={formatPrice(avgPrice)}
          subtitle="Across all categories"
          icon={DollarSign}
          color="accent"
        />
      </div>

      {/* Fleet Distribution & Quick Category Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-bold text-charcoal-900">Fleet by Category</h3>
          <button
            onClick={() => setActiveTab('cars')}
            className="text-xs font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1"
          >
            Manage Fleet <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['Hatchback', 'Sedan', 'SUV', 'Luxury'].map((cat) => {
            const count = categoryCounts[cat] || 0
            const percentage = totalCars > 0 ? Math.round((count / totalCars) * 100) : 0
            return (
              <div
                key={cat}
                onClick={() => setActiveTab('cars')}
                className="group cursor-pointer rounded-2xl border border-charcoal-900/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card hover:border-accent-500/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal-500">{cat}</span>
                  <span className="font-display text-xl font-extrabold text-charcoal-900">{count}</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-charcoal-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-500 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-charcoal-400 font-medium">{percentage}% of total fleet</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2-Column Grid: Recent Cars & Recent Inquiries */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Cars */}
        <div className="rounded-3xl border border-charcoal-900/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-charcoal-900/10">
            <div>
              <h3 className="font-display text-base font-bold text-charcoal-900">Recent Vehicles</h3>
              <p className="text-xs text-charcoal-400">Latest cars in inventory</p>
            </div>
            <button
              onClick={() => setActiveTab('cars')}
              className="text-xs font-semibold text-accent-600 hover:text-accent-700"
            >
              View all ({cars.length})
            </button>
          </div>

          <div className="divide-y divide-charcoal-900/5 mt-2">
            {cars.length === 0 ? (
              <div className="py-8 text-center text-xs text-charcoal-400">
                No vehicles in inventory yet. Click &quot;Add New Car&quot; to list your first vehicle.
              </div>
            ) : (
              cars.slice(0, 5).map((car) => (
                <div key={car.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-20 aspect-[16/9] shrink-0 overflow-hidden rounded-xl bg-charcoal-100 ring-1 ring-charcoal-900/10">
                      <img
                        src={car.image}
                        alt={car.model}
                        className="h-full w-full object-cover object-center"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=800&q=80'
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-display text-sm font-bold text-charcoal-900">
                        {car.brand} {car.model}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-charcoal-500">
                        <span>{car.category}</span>
                        <span>•</span>
                        <span>{car.transmission}</span>
                        <span>•</span>
                        <span>{car.seats} seats</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-charcoal-900">
                      {formatPrice(car.pricePerDay)}<span className="text-[10px] font-normal text-charcoal-400">/day</span>
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        car.available ? 'bg-emerald-100 text-emerald-700' : 'bg-charcoal-200 text-charcoal-700'
                      }`}
                    >
                      {car.available ? 'Available' : 'Booked'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Inquiries */}
        <div className="rounded-3xl border border-charcoal-900/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-charcoal-900/10">
            <div>
              <h3 className="font-display text-base font-bold text-charcoal-900">Recent Customer Leads</h3>
              <p className="text-xs text-charcoal-400">Inquiries submitted by customers</p>
            </div>
            <button
              onClick={() => setActiveTab('inquiries')}
              className="text-xs font-semibold text-accent-600 hover:text-accent-700"
            >
              Manage all ({inquiries.length})
            </button>
          </div>

          <div className="divide-y divide-charcoal-900/5 mt-2">
            {inquiries.length === 0 ? (
              <div className="py-8 text-center text-xs text-charcoal-400">
                No customer inquiries yet.
              </div>
            ) : (
              inquiries.slice(0, 5).map((inq) => (
                <div
                  key={inq.id}
                  onClick={() => setSelectedInquiry(inq)}
                  className="flex items-center justify-between py-3 hover:bg-charcoal-50/70 rounded-xl px-2 -mx-2 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-sm font-bold text-charcoal-900">{inq.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                          inq.status === 'New'
                            ? 'bg-accent-100 text-accent-700'
                            : inq.status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-charcoal-100 text-charcoal-700'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-500 mt-0.5">
                      Interested in <strong className="text-charcoal-800">{inq.carName}</strong> • {inq.phone}
                    </p>
                  </div>

                  <button className="flex h-8 w-8 items-center justify-center rounded-lg text-charcoal-400 hover:bg-white hover:text-accent-600 shadow-sm border border-charcoal-900/5">
                    <Eye size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Car Modal */}
      {showAddCarModal && (
        <CarFormModal
          onSave={handleAddCar}
          onClose={() => setShowAddCarModal(false)}
          loading={savingCar}
        />
      )}

      {/* Inquiry Details Modal */}
      {selectedInquiry && (
        <InquiryDetailsModal
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onUpdateStatus={updateInquiryStatus}
          onDelete={deleteInquiry}
        />
      )}
    </div>
  )
}
