import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BedDouble, BookOpen, Users, CreditCard,
  Settings, BarChart3, LogOut, Plug, UserCog,
  ChevronRight, List, CalendarDays, Tag,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { Avatar } from '../common/Avatar'

const NAV = [
  { to: '/bookings', label: 'Bookings', icon: BookOpen },
  { to: '/guests', label: 'Guests', icon: Users },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/gateways', label: 'Payment Gateways', icon: Plug },
  { to: '/staff', label: 'Users & Staff', icon: UserCog },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const NAV_ITEM_CLASS = (isActive: boolean) =>
  `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-slate-800 text-white'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
  }`

export function PropertyLayout() {
  const { user, refreshToken, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isOnAccommodations = location.pathname.startsWith('/accommodations')
  const [accOpen, setAccOpen] = useState(() => isOnAccommodations)

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      // best-effort
    }
    clearAuth()
    navigate('/login')
  }

  const isManagementActive =
    isOnAccommodations &&
    !location.pathname.startsWith('/accommodations/availability') &&
    !location.pathname.startsWith('/accommodations/rate-calendar')

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="flex w-60 flex-shrink-0 flex-col bg-slate-900">
        <div className="px-5 py-5 border-b border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Property Portal</p>
          <p className="mt-0.5 text-sm font-semibold text-white truncate">Booking Engine</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => NAV_ITEM_CLASS(isActive)}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>

          {/* Accommodations expandable group */}
          <button
            onClick={() => setAccOpen((o) => !o)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
              isOnAccommodations
                ? 'text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BedDouble size={16} />
            <span className="flex-1 text-left">Accommodations</span>
            <ChevronRight
              size={14}
              className={`transition-transform duration-150 ${accOpen ? 'rotate-90' : ''}`}
            />
          </button>

          {accOpen && (
            <div className="pl-4">
              <NavLink
                to="/accommodations"
                className={() => NAV_ITEM_CLASS(isManagementActive)}
              >
                <List size={14} />
                Management
              </NavLink>
              <NavLink
                to="/accommodations/availability"
                className={({ isActive }) => NAV_ITEM_CLASS(isActive)}
              >
                <CalendarDays size={14} />
                Availability
              </NavLink>
              <NavLink
                to="/accommodations/rate-calendar"
                className={({ isActive }) => NAV_ITEM_CLASS(isActive)}
              >
                <Tag size={14} />
                Rate Calendar
              </NavLink>
            </div>
          )}

          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => NAV_ITEM_CLASS(isActive)}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            {user && <Avatar name={user.full_name} size="sm" />}
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-white">{user?.full_name}</p>
              <p className="truncate text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
