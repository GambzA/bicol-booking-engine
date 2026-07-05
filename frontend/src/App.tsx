import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useAdminAuthStore } from './store/adminAuthStore'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { PropertyLayout } from './components/property/PropertyLayout'
import { PropertyDashboard } from './pages/property/PropertyDashboard'
import { AccommodationsPage } from './pages/property/accommodations/AccommodationsPage'
import { CreateAccommodationPage } from './pages/property/accommodations/CreateAccommodationPage'
import { EditAccommodationPage } from './pages/property/accommodations/EditAccommodationPage'
import { AvailabilityPage } from './pages/property/accommodations/AvailabilityPage'
import { RateCalendarPage } from './pages/property/accommodations/RateCalendarPage'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { PropertiesPage } from './pages/admin/PropertiesPage'
import { PropertyDetailPage } from './pages/admin/PropertyDetailPage'
import { CreatePropertyPage } from './pages/admin/CreatePropertyPage'
import { EditPropertyPage } from './pages/admin/EditPropertyPage'
import { PlansPage } from './pages/admin/PlansPage'
import { InvoicesPage } from './pages/admin/InvoicesPage'
import { InvoiceDetailPage } from './pages/admin/InvoiceDetailPage'
import { PaymentsPage } from './pages/admin/PaymentsPage'
import { CommissionsPage } from './pages/admin/CommissionsPage'
import { CommissionDetailPage } from './pages/admin/CommissionDetailPage'
import { AuditLogsPage } from './pages/admin/AuditLogsPage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { AdminLayout } from './components/admin/AdminLayout'
import { RatePlansPage } from './pages/property/rate-plans/RatePlansPage'
import { CreateRatePlanPage } from './pages/property/rate-plans/CreateRatePlanPage'
import { EditRatePlanPage } from './pages/property/rate-plans/EditRatePlanPage'
import { PromotionsPage } from './pages/property/promotions/PromotionsPage'
import { CreatePromotionPage } from './pages/property/promotions/CreatePromotionPage'
import { EditPromotionPage } from './pages/property/promotions/EditPromotionPage'
import { PackagesPage } from './pages/property/packages/PackagesPage'
import { CreatePackagePage } from './pages/property/packages/CreatePackagePage'
import { EditPackagePage } from './pages/property/packages/EditPackagePage'
import { BillableItemsPage } from './pages/property/billable-items/BillableItemsPage'
import { CreateBillableItemPage } from './pages/property/billable-items/CreateBillableItemPage'
import { EditBillableItemPage } from './pages/property/billable-items/EditBillableItemPage'
import { SettingsPage } from './pages/property/settings/SettingsPage'
import { TaxesPage } from './pages/property/settings/taxes/TaxesPage'
import { CreateTaxPage } from './pages/property/settings/taxes/CreateTaxPage'
import { EditTaxPage } from './pages/property/settings/taxes/EditTaxPage'
import { PaymentMethodsPage } from './pages/property/settings/payment-methods/PaymentMethodsPage'
import { CreatePaymentMethodPage } from './pages/property/settings/payment-methods/CreatePaymentMethodPage'
import { EditPaymentMethodPage } from './pages/property/settings/payment-methods/EditPaymentMethodPage'
import { BookingsPage } from './pages/property/bookings/BookingsPage'
import { CreateBookingPage } from './pages/property/bookings/CreateBookingPage'
import { BookingDetailPage } from './pages/property/bookings/BookingDetailPage'
import { GuestsPage } from './pages/property/guests/GuestsPage'
import { CreateGuestPage } from './pages/property/guests/CreateGuestPage'
import { EditGuestPage } from './pages/property/guests/EditGuestPage'
import { GuestProfilePage } from './pages/property/guests/GuestProfilePage'

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
        {/* Property public routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Property protected routes */}
        <Route element={<ProtectedRoute><PropertyLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<PropertyDashboard />} />
          <Route path="/accommodations" element={<AccommodationsPage />} />
          <Route path="/accommodations/new" element={<CreateAccommodationPage />} />
          <Route path="/accommodations/availability" element={<AvailabilityPage />} />
          <Route path="/accommodations/rate-calendar" element={<RateCalendarPage />} />
          <Route path="/accommodations/:id/edit" element={<EditAccommodationPage />} />
          <Route path="/rate-plans" element={<RatePlansPage />} />
          <Route path="/rate-plans/new" element={<CreateRatePlanPage />} />
          <Route path="/rate-plans/:id/edit" element={<EditRatePlanPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/promotions/new" element={<CreatePromotionPage />} />
          <Route path="/promotions/:id/edit" element={<EditPromotionPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/packages/new" element={<CreatePackagePage />} />
          <Route path="/packages/:id/edit" element={<EditPackagePage />} />
          <Route path="/billable-items" element={<BillableItemsPage />} />
          <Route path="/billable-items/new" element={<CreateBillableItemPage />} />
          <Route path="/billable-items/:id/edit" element={<EditBillableItemPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/bookings/new" element={<CreateBookingPage />} />
          <Route path="/bookings/:id" element={<BookingDetailPage />} />
          <Route path="/guests" element={<GuestsPage />} />
          <Route path="/guests/new" element={<CreateGuestPage />} />
          <Route path="/guests/:id" element={<GuestProfilePage />} />
          <Route path="/guests/:id/edit" element={<EditGuestPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/taxes" element={<TaxesPage />} />
          <Route path="/settings/taxes/new" element={<CreateTaxPage />} />
          <Route path="/settings/taxes/:id/edit" element={<EditTaxPage />} />
          <Route path="/settings/payment-methods" element={<PaymentMethodsPage />} />
          <Route path="/settings/payment-methods/new" element={<CreatePaymentMethodPage />} />
          <Route path="/settings/payment-methods/:id/edit" element={<EditPaymentMethodPage />} />
        </Route>

        {/* Admin public */}
        <Route path="/admin/login" element={<AdminPublicRoute><AdminLogin /></AdminPublicRoute>} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Admin protected - all wrapped in AdminLayout */}
        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/properties" element={<PropertiesPage />} />
            <Route path="/admin/properties/new" element={<CreatePropertyPage />} />
            <Route path="/admin/properties/:id/edit" element={<EditPropertyPage />} />
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
