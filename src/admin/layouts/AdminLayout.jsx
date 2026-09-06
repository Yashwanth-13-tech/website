import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import AdminNavbar from '../components/AdminNavbar.jsx'
import AdminSidebar from '../components/AdminSidebar.jsx'
import AdminLogin from '../pages/AdminLogin.jsx'
import AdminDashboard from '../pages/AdminDashboard.jsx'
import AdminCars from '../pages/AdminCars.jsx'
import AdminInquiries from '../pages/AdminInquiries.jsx'
import AdminLocations from '../pages/AdminLocations.jsx'
import AdminSettings from '../pages/AdminSettings.jsx'
import AdminErrorBoundary from '../components/AdminErrorBoundary.jsx'

export default function AdminLayout({ initialTab = 'dashboard' }) {
  const { isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Route protection: If not logged in, render AdminLogin page
  if (!isAuthenticated) {
    return <AdminLogin />
  }

  return (
    <AdminErrorBoundary title="Admin Portal Notice">
      <div className="flex min-h-screen bg-charcoal-50/60 font-body antialiased">
        {/* Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminNavbar
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <AdminErrorBoundary title={`Error loading ${activeTab} section`}>
                {activeTab === 'dashboard' && <AdminDashboard setActiveTab={setActiveTab} />}
                {activeTab === 'cars' && <AdminCars />}
                {activeTab === 'inquiries' && <AdminInquiries />}
                {activeTab === 'locations' && <AdminLocations />}
                {activeTab === 'settings' && <AdminSettings />}
              </AdminErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </AdminErrorBoundary>
  )
}
