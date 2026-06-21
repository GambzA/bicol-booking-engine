import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useAdminAuthStore } from './store/adminAuthStore'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { PropertiesPage } from './pages/admin/PropertiesPage'
import { PropertyDetailPage } from './pages/admin/PropertyDetailPage'
import { PlansPage } from './pages/admin/PlansPage'
import { InvoicesPage } from './pages/admin/InvoicesPage'
import { InvoiceDetailPage } from './pages/admin/InvoiceDetailPage'
import { PaymentsPage } from './pages/admin/PaymentsPage'
import { CommissionsPage } from './pages/admin/CommissionsPage'
import { CommissionDetailPage } from './pages/admin/CommissionDetailPage'
import { AuditLogsPage } from './pages/admin/AuditLogsPage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { AdminLayout } from './components/admin/AdminLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function AdminProtectedRoute() {
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/admin/login" replace />
}

function AdminPublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Property routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        {/* Admin public */}
        <Route path="/admin/login" element={<AdminPublicRoute><AdminLogin /></AdminPublicRoute>} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Admin protected - all wrapped in AdminLayout */}
        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/properties" element={<PropertiesPage />} />
            <Route path="/admin/properties/:id" element={<PropertyDetailPage />} />
            <Route path="/admin/plans" element={<PlansPage />} />
            <Route path="/admin/invoices" element={<InvoicesPage />} />
            <Route path="/admin/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/admin/payments" element={<PaymentsPage />} />
            <Route path="/admin/commissions" element={<CommissionsPage />} />
            <Route path="/admin/commissions/:id" element={<CommissionDetailPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
