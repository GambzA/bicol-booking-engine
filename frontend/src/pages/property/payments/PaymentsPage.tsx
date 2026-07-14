import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { paymentsApi, type PaymentListItem } from '../../../api/property/payments'
import { paymentMethodsApi, type PaymentMethod } from '../../../api/property/paymentMethods'
import { PAYMENT_RECORD_STATUSES } from '../../../constants/propertyOptions'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { Pagination } from '../../../components/common/Pagination'
import { useToast } from '../../../components/common/useToast'
import { PaymentRecordBadge } from '../../../components/property/BookingBadges'

const STATUS_OPTIONS = [{ value: '', label: 'All Statuses' }, ...PAYMENT_RECORD_STATUSES.map((s) => ({ value: s.value, label: s.label }))]
const SORT_OPTIONS = [
  { value: 'payment_date', label: 'Payment Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'guest_name', label: 'Guest Name' },
  { value: 'booking_number', label: 'Booking Number' },
]

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtMoney(s: string): string {
  const n = parseFloat(s)
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PaymentsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<PaymentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState('payment_date')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    paymentMethodsApi.list().then((r) => setMethods(r.data.items)).catch(() => {})
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await paymentsApi.list({
        search: search || undefined,
        payment_method_id: methodFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort,
        page,
        page_size: PAGE_SIZE,
      })
      setItems(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load payments.')
    }
    setLoading(false)
  }, [search, methodFilter, statusFilter, dateFrom, dateTo, sort, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const methodOptions = [{ value: '', label: 'All Methods' }, ...methods.map((m) => ({ value: m.id, label: m.name }))]

  return (
    <div className="p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'payment' : 'payments'}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Payment #, booking #, guest, reference..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8"
          />
        </div>
        <Select options={methodOptions} value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1) }} className="w-44" />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-40" />
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-40" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-40" />
        <Select options={SORT_OPTIONS} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }} className="w-44" />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No payments found</p>
            <p className="mt-1 text-xs text-slate-400">Payments recorded against bookings will show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Payment #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Booking #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Guest</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Method</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => {
                  const isRefund = parseFloat(p.amount) < 0
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/payments/${p.id}`)}>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-800">{p.payment_number}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {p.booking_number ? (
                          <button
                            className="text-slate-700 hover:text-slate-900 hover:underline"
                            onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${p.booking_id}`) }}
                          >
                            {p.booking_number}
                          </button>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.guest_name ?? '--'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{p.payment_method_name ?? '--'}</td>
                      <td className={`px-4 py-3 text-right text-sm font-medium ${isRefund ? 'text-red-600' : 'text-slate-800'}`}>
                        {isRefund ? '-' : ''}&#8369;{fmtMoney(p.amount.replace('-', ''))}
                      </td>
                      <td className="px-4 py-3 text-center"><PaymentRecordBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(p.payment_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{p.recorded_by_name ?? '--'}</td>
                    </tr>
                  )
                })}
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
