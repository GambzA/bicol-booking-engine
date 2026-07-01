import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { packagesApi, type Package } from '../../../api/property/packages'
import { PACKAGE_PRICING_TYPES } from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { Pagination } from '../../../components/common/Pagination'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { useToast } from '../../../components/common/useToast'

const ACTIVE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PACKAGE_PRICING_TYPES.map((m) => [m.value, m.label])
)

function fmtCurrency(s: string): string {
  return parseFloat(s).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PackagesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null)
  const [deleting, setDeleting] = useState(false)
  const PAGE_SIZE = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await packagesApi.list({
        search: search || undefined,
        active: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        page_size: PAGE_SIZE,
      })
      setItems(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load packages.')
    }
    setLoading(false)
  }, [search, activeFilter, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleToggle = async (id: string) => {
    try {
      const r = await packagesApi.toggleActive(id)
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...r.data } : p)))
    } catch {
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await packagesApi.delete(deleteTarget.id)
      toast.success('Package deleted.')
      setDeleteTarget(null)
      fetchItems()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to delete package.')
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Packages</h1>
          <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'package' : 'packages'}</p>
        </div>
        <Button onClick={() => navigate('/packages/new')}>
          <Plus size={16} /> Add Package
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
            <p className="text-sm font-medium text-slate-500">No packages found</p>
            <p className="mt-1 text-xs text-slate-400">Add your first package to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pricing</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Price</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Rooms</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/packages/${p.id}/edit`)} className="text-sm font-medium text-slate-800 hover:underline text-left">
                        {p.name}
                      </button>
                      {p.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {TYPE_LABELS[p.pricing_type] ?? p.pricing_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">&#8369;{fmtCurrency(p.price_value)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{p.accommodation_count ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(p.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${p.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        title={p.is_active ? 'Active -- click to deactivate' : 'Inactive -- click to activate'}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${p.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/packages/${p.id}/edit`)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
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
        title="Delete Package"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
