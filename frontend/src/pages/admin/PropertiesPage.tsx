import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { propertiesApi } from '../../api/admin/properties'
import { Table, type Column } from '../../components/common/Table'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Select } from '../../components/common/Select'
import { Pagination } from '../../components/common/Pagination'
import { HotelStatusBadge, SubscriptionStatusBadge } from '../../components/admin/StatusBadge'
import { CreatePropertyModal } from './CreatePropertyModal'
import { useToast } from '../../components/common/useToast'
import type { Hotel } from '../../types/admin'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deactivated', label: 'Deactivated' },
]

export function PropertiesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const PAGE_SIZE = 20

  const fetchHotels = useCallback(async () => {
    setLoading(true)
    try {
      const r = await propertiesApi.list({
        status: status || undefined,
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setHotels(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load properties.')
    }
    setLoading(false)
  }, [status, search, page])

  useEffect(() => { fetchHotels() }, [fetchHotels])

  const columns: Column<Hotel>[] = [
    { key: 'name', label: 'Property', render: (h) => (
      <button onClick={() => navigate(`/admin/properties/${h.id}`)} className="font-medium text-slate-800 hover:underline text-left">
        {h.name}
      </button>
    )},
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'City', render: (h) => h.city ?? '-' },
    { key: 'status', label: 'Status', render: (h) => <HotelStatusBadge status={h.status} /> },
    { key: 'subscription', label: 'Subscription', render: (h) => (
      h.subscription
        ? <div className="flex flex-col gap-0.5">
            <SubscriptionStatusBadge status={h.subscription.status} />
            <span className="text-xs text-slate-400">{h.subscription.plan?.name}</span>
          </div>
        : <span className="text-xs text-slate-400">None</span>
    )},
    { key: 'created_at', label: 'Registered', render: (h) => new Date(h.created_at).toLocaleDateString() },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Properties</h1>
          <p className="mt-1 text-sm text-slate-500">{total} registered {total === 1 ? 'property' : 'properties'}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Property
        </Button>
      </div>

      <div className="mt-6 flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8"
          />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="w-40"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table
          columns={columns}
          data={hotels}
          loading={loading}
          keyExtractor={(h) => h.id}
          emptyTitle="No properties found"
          emptyDescription="Add your first property to get started."
        />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <CreatePropertyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchHotels() }}
      />
    </div>
  )
}
