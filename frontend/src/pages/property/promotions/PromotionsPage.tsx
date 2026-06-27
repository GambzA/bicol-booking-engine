import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { promotionsApi, type Promotion } from '../../../api/property/promotions'
import { PROMOTION_DISCOUNT_TYPES } from '../../../constants/propertyOptions'
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

const DISCOUNT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROMOTION_DISCOUNT_TYPES.map((d) => [d.value, d.label])
)

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const [y, m, d] = iso.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DiscountBadge({ type, value }: { type: string; value: string }) {
  const num = parseFloat(value)
  const label = type === 'percentage'
    ? `${num % 1 === 0 ? num : fmtCurrency(num)}% off`
    : `₱${fmtCurrency(num)} off`
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      {label}
    </span>
  )
}

export function PromotionsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const PAGE_SIZE = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await promotionsApi.list({
        search: search || undefined,
        active: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        page_size: PAGE_SIZE,
      })
      setItems(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load promotions.')
    }
    setLoading(false)
  }, [search, activeFilter, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleToggle = async (id: string) => {
    try {
      const r = await promotionsApi.toggleActive(id)
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...r.data } : p)))
    } catch {
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await promotionsApi.delete(deleteTarget.id)
      toast.success('Promotion deleted.')
      setDeleteTarget(null)
      fetchItems()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to delete promotion.')
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Promotions</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? 'promotion' : 'promotions'}
          </p>
        </div>
        <Button onClick={() => navigate('/promotions/new')}>
          <Plus size={16} /> Add Promotion
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
            <p className="text-sm font-medium text-slate-500">No promotions found</p>
            <p className="mt-1 text-xs text-slate-400">Add your first promotion to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Validity Period</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Rooms</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((promo) => (
                  <tr key={promo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/promotions/${promo.id}/edit`)}
                        className="text-sm font-medium text-slate-800 hover:underline text-left"
                      >
                        {promo.name}
                      </button>
                      {promo.description && (
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">{promo.description}</p>
                      )}
                      {promo.promo_code && (
                        <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                          {promo.promo_code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DiscountBadge type={promo.discount_type} value={promo.discount_value} />
                      <p className="mt-1 text-xs text-slate-400">
                        {DISCOUNT_TYPE_LABELS[promo.discount_type] ?? promo.discount_type}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {promo.stay_start_date || promo.stay_end_date ? (
                        <span>{formatDate(promo.stay_start_date)} - {formatDate(promo.stay_end_date)}</span>
                      ) : (
                        <span className="text-slate-400">No restriction</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {promo.accommodation_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(promo.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          promo.is_active ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                        title={promo.is_active ? 'Active -- click to deactivate' : 'Inactive -- click to activate'}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            promo.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatUpdatedAt(promo.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/promotions/${promo.id}/edit`)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(promo)}
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
        title="Delete Promotion"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
