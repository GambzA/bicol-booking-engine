import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { invoicesApi } from '../../api/admin/invoices'
import { propertiesApi } from '../../api/admin/properties'
import { Table, type Column } from '../../components/common/Table'
import { Button } from '../../components/common/Button'
import { Select } from '../../components/common/Select'
import { Pagination } from '../../components/common/Pagination'
import { InvoiceStatusBadge } from '../../components/admin/StatusBadge'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { useToast } from '../../components/common/useToast'
import type { Invoice, Hotel } from '../../types/admin'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function InvoicesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [hotelId, setHotelId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const PAGE_SIZE = 20

  const hotelMap = Object.fromEntries(hotels.map((h) => [h.id, h.name]))

  const hotelOptions = [
    { value: '', label: 'All properties' },
    ...hotels.map((h) => ({ value: h.id, label: h.name })),
  ]

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const r = await invoicesApi.list({
        status: status || undefined,
        hotel_id: hotelId || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setInvoices(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load invoices.')
    }
    setLoading(false)
  }, [status, hotelId, page])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    propertiesApi.list({ page_size: 200 }).then((r) => setHotels(r.data.items)).catch(() => {})
  }, [])

  const columns: Column<Invoice>[] = [
    { key: 'invoice_number', label: 'Invoice #', render: (inv) => (
      <button onClick={() => navigate(`/admin/invoices/${inv.id}`)} className="font-medium text-slate-800 hover:underline">
        {inv.invoice_number}
      </button>
    )},
    { key: 'hotel_id', label: 'Property', render: (inv) => hotelMap[inv.hotel_id] ?? inv.hotel_id.slice(0, 8) },
    { key: 'type', label: 'Type', render: (inv) => <span className="capitalize">{inv.type}</span> },
    { key: 'total_amount', label: 'Amount', render: (inv) => `₱${inv.total_amount}` },
    { key: 'status', label: 'Status', render: (inv) => <InvoiceStatusBadge status={inv.status} /> },
    { key: 'due_date', label: 'Due', render: (inv) => inv.due_date },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'invoice' : 'invoices'}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Invoice</Button>
      </div>

      <div className="mt-6 flex gap-3 flex-wrap">
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-40" />
        <Select options={hotelOptions} value={hotelId} onChange={(e) => { setHotelId(e.target.value); setPage(1) }} className="w-52" />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table columns={columns} data={invoices} loading={loading} keyExtractor={(i) => i.id} emptyTitle="No invoices found" emptyDescription="Create an invoice to get started." />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <CreateInvoiceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchAll() }}
        hotels={hotels}
      />
    </div>
  )
}
