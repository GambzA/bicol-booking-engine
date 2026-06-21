import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Building2, FileText, CreditCard, Percent, ClipboardList, BarChart3,
  Layers, LogOut, LayoutDashboard,
} from 'lucide-react'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import { adminAuthApi } from '../../api/admin/auth'
import { Avatar } from '../common/Avatar'

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/properties', label: 'Properties', icon: Building2 },
  { to: '/admin/plans', label: 'Subscription Plans', icon: Layers },
  { to: '/admin/invoices', label: 'Invoices', icon: FileText },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/commissions', label: 'Commissions', icon: Percent },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
]

export function AdminLayout() {
  const { admin, refreshToken, clearAuth } = useAdminAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      if (refreshToken) await adminAuthApi.logout(refreshToken)
    } catch {
      // best-effort
    }
    clearAuth()
    navigate('/admin/login')
  }

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="flex w-60 flex-shrink-0 flex-col bg-slate-900">
        <div className="px-5 py-5 border-b border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Admin Portal</p>
          <p className="mt-0.5 text-sm font-semibold text-white">Booking Engine</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            {admin && <Avatar name={admin.full_name} size="sm" />}
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-white">{admin?.full_name}</p>
              <p className="truncate text-xs text-slate-400">{admin?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
