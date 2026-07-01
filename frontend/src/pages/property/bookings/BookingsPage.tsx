import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { bookingsApi, type BookingListItem } from '../../../api/property/bookings'
import { BOOKING_STATUSES, BOOKING_PAYMENT_STATUSES } from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { Pagination } from '../../../components/common/Pagination'
import { useToast } from '../../../components/common/useToast'
import { BookingStatusBadge, PaymentStatusBadge } from '../../../components/property/BookingBadges'

const STATUS_OPTIONS = [{ value: '', label: 'All Statuses' }, ...BOOKING_STATUSES.map((s) => ({ value: s.value, label: s.label }))]
const PAYMENT_OPTIONS = [{ value: '', label: 'All Payments' }, ...BOOKING_PAYMENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))]
const SORT_OPTIONS = [
  { value: 'check_in', label: 'Check-in Date' },
  { value: 'check_out', label: 'Check-out Date' },
  { value: 'booking_date', label: 'Booking Date' },
  { value: 'guest', label: 'Guest Name' },
]

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtMoney(s: string): string {
  return parseFloat(s).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function BookingsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<BookingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [sort, setSort] = useState('check_in')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const PAGE_SIZE = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await bookingsApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        sort,
        page,
        page_size: PAGE_SIZE,
      })
      setItems(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load bookings.')
    }
    setLoading(false)
  }, [search, statusFilter, paymentFilter, sort, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'booking' : 'bookings'}</p>
        </div>
        <Button onClick={() => navigate('/bookings/new')}>
          <Plus size={16} /> New Booking
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Booking #, guest, accommodation..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8"
          />
        </div>
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-40" />
        <Select options={PAYMENT_OPTIONS} value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1) }} className="w-40" />
        <Select options={SORT_OPTIONS} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} className="w-44" />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No bookings found</p>
            <p className="mt-1 text-xs text-slate-400">Create your first booking to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Booking #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Guest</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Accommodation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stay</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Payment</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">{b.booking_number}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{b.guest_name ?? '--'}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{b.accommodation_summary ?? '--'}</p>
                      <p className="text-xs text-slate-400">{b.rooms_count} {b.rooms_count === 1 ? 'room' : 'rooms'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <p>{fmtDate(b.check_in_date)} &rarr; {fmtDate(b.check_out_date)}</p>
                      <p className="text-xs text-slate-400">{b.nights} {b.nights === 1 ? 'night' : 'nights'}</p>
                    </td>
                    <td className="px-4 py-3 text-center"><BookingStatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-center"><PaymentStatusBadge status={b.payment_status} /></td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">&#8369;{fmtMoney(b.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4">
          <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
