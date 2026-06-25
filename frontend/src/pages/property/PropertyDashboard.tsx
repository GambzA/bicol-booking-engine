import { useEffect, useState } from 'react'
import {
  BookOpen, LogIn, LogOut, TrendingUp, ArrowUp, ArrowDown,
  BarChart3, AlertCircle, BedDouble,
} from 'lucide-react'
import { dashboardApi, type DashboardStats } from '../../api/property/dashboard'
import { PageLoader } from '../../components/common/PageLoader'

const BOOKING_STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  checked_in: 'bg-green-50 text-green-700 border-green-200',
  checked_out: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200',
  no_show: 'bg-orange-50 text-orange-700 border-orange-200',
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  no_show: 'No Show',
}

function formatCurrency(value: string) {
  return `₱${parseFloat(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PropertyDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.get()
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const s = stats ?? {
    total_bookings: 0,
    todays_checkins: 0,
    todays_checkouts: 0,
    upcoming_arrivals: 0,
    upcoming_departures: 0,
    monthly_revenue: '0.00',
    occupancy_rate: 0,
    outstanding_payments: '0.00',
    recent_bookings: [],
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      {/* Stat grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Bookings"
          value={s.total_bookings}
          icon={<BookOpen size={20} />}
          color="blue"
        />
        <StatCard
          title="Today's Check-ins"
          value={s.todays_checkins}
          icon={<LogIn size={20} />}
          color="green"
        />
        <StatCard
          title="Today's Check-outs"
          value={s.todays_checkouts}
          icon={<LogOut size={20} />}
          color="slate"
        />
        <StatCard
          title="Occupancy Rate"
          value={`${s.occupancy_rate}%`}
          icon={<BedDouble size={20} />}
          color="indigo"
        />
        <StatCard
          title="Upcoming Arrivals"
          value={s.upcoming_arrivals}
          icon={<ArrowDown size={20} />}
          color="teal"
        />
        <StatCard
          title="Upcoming Departures"
          value={s.upcoming_departures}
          icon={<ArrowUp size={20} />}
          color="orange"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(s.monthly_revenue)}
          icon={<BarChart3 size={20} />}
          color="emerald"
          wide
        />
        <StatCard
          title="Outstanding Payments"
          value={formatCurrency(s.outstanding_payments)}
          icon={<AlertCircle size={20} />}
          color={parseFloat(s.outstanding_payments) > 0 ? 'red' : 'slate'}
        />
      </div>

      {/* Recent bookings */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Recent Bookings</h2>
          <TrendingUp size={16} className="text-slate-300" />
        </div>

        {s.recent_bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen size={32} className="text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500">No bookings yet</p>
            <p className="mt-1 text-xs text-slate-400">Bookings will appear here once created.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Booking #</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Guest</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Accommodation</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Check-in</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Check-out</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {s.recent_bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm font-mono text-slate-700">{b.booking_number}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{b.guest_name}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{b.accommodation_name}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{b.check_in_date}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{b.check_out_date}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-slate-700">
                      {formatCurrency(b.total_amount)}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${BOOKING_STATUS_STYLES[b.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const COLOR_MAP: Record<string, { card: string; icon: string }> = {
  blue:    { card: 'bg-blue-50 border-blue-100',     icon: 'text-blue-400' },
  green:   { card: 'bg-green-50 border-green-100',   icon: 'text-green-500' },
  slate:   { card: 'bg-white border-slate-200',       icon: 'text-slate-300' },
  indigo:  { card: 'bg-indigo-50 border-indigo-100', icon: 'text-indigo-400' },
  teal:    { card: 'bg-teal-50 border-teal-100',     icon: 'text-teal-400' },
  orange:  { card: 'bg-orange-50 border-orange-100', icon: 'text-orange-400' },
  emerald: { card: 'bg-emerald-50 border-emerald-100', icon: 'text-emerald-500' },
  red:     { card: 'bg-red-50 border-red-100',       icon: 'text-red-400' },
}

function StatCard({
  title,
  value,
  icon,
  color = 'slate',
}: {
  title: string
  value: string | number
  icon?: React.ReactNode
  color?: string
  wide?: boolean
}) {
  const { card, icon: iconColor } = COLOR_MAP[color] ?? COLOR_MAP.slate
  return (
    <div className={`rounded-xl border p-5 ${card}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        {icon && <span className={iconColor}>{icon}</span>}
      </div>
    </div>
  )
}
