import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { accommodationsApi, type Accommodation } from '../../../api/property/accommodations'
import { ACCOMMODATION_TYPES } from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { Pagination } from '../../../components/common/Pagination'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { useToast } from '../../../components/common/useToast'

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  ...ACCOMMODATION_TYPES,
]

const ACTIVE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ACCOMMODATION_TYPES.map((t) => [t.value, t.label])
)

export function AccommodationsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Accommodation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const PAGE_SIZE = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await accommodationsApi.list({
        search: search || undefined,
        accommodation_type: typeFilter || undefined,
        active: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        page_size: PAGE_SIZE,
      })
      setItems(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load accommodations.')
    }
    setLoading(false)
  }, [search, typeFilter, activeFilter, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleToggle = async (id: string) => {
    try {
      const r = await accommodationsApi.toggleActive(id)
      setItems((prev) => prev.map((a) => (a.id === id ? r.data : a)))
    } catch {
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await accommodationsApi.delete(deleteTarget.id)
      toast.success('Accommodation permanently deleted.')
      setDeleteTarget(null)
      setTotal((t) => t - 1)
      fetchItems()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to delete accommodation.')
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Accommodations</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? 'accommodation' : 'accommodations'}
          </p>
        </div>
        <Button onClick={() => navigate('/accommodations/new')}>
          <Plus size={16} /> Add Accommodation
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8"
          />
        </div>
        <Select
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="w-40"
        />
        <Select
          options={ACTIVE_OPTIONS}
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
          className="w-32"
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No accommodations found</p>
            <p className="mt-1 text-xs text-slate-400">Add your first accommodation to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Units</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Max Occ.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Base Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/accommodations/${a.id}/edit`)}
                        className="text-sm font-medium text-slate-800 hover:underline text-left"
                      >
                        {a.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">
                        {TYPE_LABEL[a.accommodation_type] ?? a.accommodation_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{a.num_units}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{a.max_occupancy}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      ₱{parseFloat(a.base_rate).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(a.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          a.is_active ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                        title={a.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            a.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/accommodations/${a.id}/edit`)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(a)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Accommodation"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
