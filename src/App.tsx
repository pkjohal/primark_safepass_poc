import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { hasMinRole } from './lib/permissions'

// Layout
import NavBar from './components/layout/NavBar'
import Sidebar from './components/layout/Sidebar'
import EvacuationBanner from './components/layout/EvacuationBanner'

// Screens
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import VisitorSearchScreen from './screens/VisitorSearchScreen'
import VisitorProfileScreen from './screens/VisitorProfileScreen'
import VisitorFormScreen from './screens/VisitorFormScreen'
import ScheduleVisitScreen from './screens/ScheduleVisitScreen'
import CheckInScreen from './screens/CheckInScreen'
import InboxScreen from './screens/InboxScreen'
import SelfServiceScreen from './screens/SelfServiceScreen'
import PreApprovalScreen from './screens/PreApprovalScreen'
import DenyListScreen from './screens/DenyListScreen'
import SiteConfigScreen from './screens/SiteConfigScreen'
import EvacuationScreen from './screens/EvacuationScreen'
import AdminScreen from './screens/AdminScreen'
import UpcomingVisitsScreen from './screens/UpcomingVisitsScreen'

function ProtectedLayout() {
  const { user, activeEvacuation } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <div className="min-h-screen bg-light-grey flex flex-col">
      <NavBar onMenuToggle={() => setSidebarOpen((o) => !o)} />
      {activeEvacuation && <EvacuationBanner event={activeEvacuation} />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function RoleGuard({ minRole, children }: { minRole: string; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user || !hasMinRole(user.role, minRole)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginScreen />}
      />
      <Route path="/self-service/:token" element={<SelfServiceScreen />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/visitors" element={<VisitorSearchScreen />} />
        <Route path="/visitors/new" element={<VisitorFormScreen />} />
        <Route path="/visitors/:id" element={<VisitorProfileScreen />} />
        <Route path="/upcoming" element={<UpcomingVisitsScreen />} />
        <Route path="/schedule" element={<ScheduleVisitScreen />} />
        <Route
          path="/checkin/:visitId"
          element={
            <RoleGuard minRole="reception">
              <CheckInScreen />
            </RoleGuard>
          }
        />
        <Route path="/inbox" element={<InboxScreen />} />
        <Route path="/pre-approvals" element={<PreApprovalScreen />} />
        <Route
          path="/deny-list"
          element={
            <RoleGuard minRole="site_admin">
              <DenyListScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/site-config"
          element={
            <RoleGuard minRole="site_admin">
              <SiteConfigScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/evacuation"
          element={
            <RoleGuard minRole="site_admin">
              <EvacuationScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleGuard minRole="site_admin">
              <AdminScreen />
            </RoleGuard>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
              fontSize: '14px',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
