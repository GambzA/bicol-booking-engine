import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Mail, Phone, MapPin, Globe, Calendar, BookOpen, Wallet } from 'lucide-react'
import { guestsApi, type Guest, type BookingHistoryItem } from '../../../api/property/guests'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'

const BOOKING_STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  checked_in: 'bg-emerald-50 text-emerald-700',
  checked_out: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-600',
  refunded: 'bg-purple-50 text-purple-700',
  no_show: 'bg-rose-50 text-rose-700',
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

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const [y, m, d] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtCurrency(val: string): string {
  return parseFloat(val).toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start gap-4">
      <div className="rounded-lg bg-slate-100 p-2.5">
        <Icon size={18} className="text-slate-600" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

function BookingRow({ booking }: { booking: BookingHistoryItem }) {
  const statusClass = BOOKING_STATUS_STYLES[booking.status] ?? 'bg-slate-100 text-slate-600'
  const statusLabel = BOOKING_STATUS_LABELS[booking.status] ?? booking.status
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-sm font-mono text-slate-700">{booking.booking_number}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{booking.accommodation_name ?? '--'}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(booking.check_in_date)}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(booking.check_out_date)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 text-right">
        ₱{fmtCurrency(booking.total_amount)}
      </td>
    </tr>
  )
}

export function GuestProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [guest, setGuest] = useState<Guest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    guestsApi
      .get(id)
      .then((r) => setGuest(r.data))
      .catch(() => {
        toast.error('Failed to load guest.')
        navigate('/guests')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoader />
  if (!guest) return null

  const today = new Date().toISOString().split('T')[0]
  const upcoming = (guest.bookings ?? []).filter(
    (b) => b.check_out_date >= today && !['cancelled', 'refunded', 'no_show'].includes(b.status)
  )
  const past = (guest.bookings ?? []).filter(
    (b) => b.check_out_date < today || ['cancelled', 'refunded', 'no_show'].includes(b.status)
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => navigate('/guests')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3"
        >
          <ChevronLeft size={14} /> Guests
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{guest.full_name}</h1>
            {guest.nationality && (
              <p className="mt-0.5 text-sm text-slate-500">{guest.nationality}</p>
            )}
          </div>
          <button
            onClick={() => navigate(`/guests/${guest.id}/edit`)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={BookOpen} label="Total Bookings" value={String(guest.booking_count)} />
        <StatCard icon={Wallet} label="Total Spent" value={`₱${fmtCurrency(guest.total_spent)}`} />
        <StatCard icon={Calendar} label="Last Stay" value={formatDate(guest.last_stay)} />
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Profile Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {guest.email && (
            <div className="flex items-start gap-2.5">
              <Mail size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm text-slate-800">{guest.email}</p>
              </div>
            </div>
          )}
          {guest.mobile_number && (
            <div className="flex items-start gap-2.5">
              <Phone size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Mobile</p>
                <p className="text-sm text-slate-800">{guest.mobile_number}</p>
              </div>
            </div>
          )}
          {guest.date_of_birth && (
            <div className="flex items-start gap-2.5">
              <Calendar size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Date of Birth</p>
                <p className="text-sm text-slate-800">{formatDate(guest.date_of_birth)}</p>
              </div>
            </div>
          )}
          {guest.nationality && (
            <div className="flex items-start gap-2.5">
              <Globe size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Nationality</p>
                <p className="text-sm text-slate-800">{guest.nationality}</p>
              </div>
            </div>
          )}
          {(guest.address_line_1 || guest.city || guest.country_name) && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <MapPin size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Address</p>
                <div className="text-sm text-slate-800 space-y-0.5">
                  {guest.address_line_1 && <p>{guest.address_line_1}</p>}
                  {guest.address_line_2 && <p>{guest.address_line_2}</p>}
                  {(guest.city || guest.state_province || guest.postal_code) && (
                    <p>
                      {[guest.city, guest.state_province, guest.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {guest.country_name && <p>{guest.country_name}</p>}
                </div>
              </div>
            </div>
          )}
          {!guest.email && !guest.mobile_number && !guest.date_of_birth && !guest.nationality && !guest.address_line_1 && !guest.city && !guest.country_name && (
            <p className="text-sm text-slate-400 sm:col-span-2">No contact information recorded.</p>
          )}
        </div>

        {guest.notes && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{guest.notes}</p>
          </div>
        )}
      </div>

      {/* Upcoming reservations */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-white overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-slate-100 bg-blue-50">
            <h2 className="text-sm font-semibold text-blue-800">Upcoming Reservations ({upcoming.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Booking #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Room</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Check-in</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Check-out</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcoming.map((b) => <BookingRow key={b.id} booking={b} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Previous stays */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Previous Stays ({past.length})</h2>
        </div>
        {past.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-slate-400">No previous stays.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Booking #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Room</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Check-in</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Check-out</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {past.map((b) => <BookingRow key={b.id} booking={b} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
