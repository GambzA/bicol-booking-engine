import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { taxesApi, type Tax } from '../../../../api/property/taxes'
import {
  TAX_TYPES, TAX_CALCULATION_METHODS, TAX_APPLICATION_SCOPES,
} from '../../../../constants/propertyOptions'
import { Button } from '../../../../components/common/Button'
import { Input } from '../../../../components/common/Input'
import { Select } from '../../../../components/common/Select'
import { Pagination } from '../../../../components/common/Pagination'
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog'
import { useToast } from '../../../../components/common/useToast'

const ACTIVE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const labelMap = (opts: { value: string; label: string }[]) =>
  Object.fromEntries(opts.map((o) => [o.value, o.label])) as Record<string, string>

const TYPE_LABELS = labelMap(TAX_TYPES)
const CALC_LABELS = labelMap(TAX_CALCULATION_METHODS)
const SCOPE_LABELS = labelMap(TAX_APPLICATION_SCOPES)

function fmtRate(t: Tax): string {
  const val = parseFloat(t.rate)
  return t.tax_type === 'percentage'
    ? `${val.toLocaleString('en-PH', { maximumFractionDigits: 2 })}%`
    : `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function TaxesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<Tax[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Tax | null>(null)
  const [deleting, setDeleting] = useState(false)
  const PAGE_SIZE = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await taxesApi.list({
        search: search || undefined,
        active: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        page_size: PAGE_SIZE,
      })
      setItems(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load taxes.')
    }
    setLoading(false)
  }, [search, activeFilter, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleToggle = async (id: string) => {
    try {
      const r = await taxesApi.toggleActive(id)
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...r.data } : t)))
    } catch {
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await taxesApi.delete(deleteTarget.id)
      toast.success('Tax deleted.')
      setDeleteTarget(null)
      fetchItems()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete tax.')
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <button onClick={() => navigate('/settings')} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Settings
      </button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tax Configuration</h1>
          <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'tax' : 'taxes'}</p>
        </div>
        <Button onClick={() => navigate('/settings/taxes/new')}>
          <Plus size={16} /> Add Tax
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
            <p className="text-sm font-medium text-slate-500">No taxes found</p>
            <p className="mt-1 text-xs text-slate-400">Add your first tax to apply it to new bookings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Scope</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/settings/taxes/${t.id}/edit`)} className="text-sm font-medium text-slate-800 hover:underline text-left">
                        {t.name}
                      </button>
                      {t.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {TYPE_LABELS[t.tax_type] ?? t.tax_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{fmtRate(t)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{CALC_LABELS[t.calculation_method] ?? t.calculation_method}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{SCOPE_LABELS[t.application_scope] ?? t.application_scope}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(t.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${t.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        title={t.is_active ? 'Active -- click to deactivate' : 'Inactive -- click to activate'}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${t.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/settings/taxes/${t.id}/edit`)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(t)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
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
        title="Delete Tax"
        message={`Delete "${deleteTarget?.name}"? Existing bookings keep their recorded taxes; this only removes it from future bookings.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
