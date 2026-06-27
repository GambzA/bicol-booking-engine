import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react'
import { guestsApi, type Guest } from '../../../api/property/guests'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { Pagination } from '../../../components/common/Pagination'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { useToast } from '../../../components/common/useToast'

const SORT_OPTIONS = [
  { value: 'name', label: 'Sort: Name' },
  { value: 'created_at', label: 'Sort: Date Created' },
  { value: 'last_stay', label: 'Sort: Last Stay' },
]

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const [y, m, d] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function GuestsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'created_at' | 'last_stay'>('name')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const PAGE_SIZE = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await guestsApi.list({ search: search || undefined, sort, page, page_size: PAGE_SIZE })
      setItems(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load guests.')
    }
    setLoading(false)
  }, [search, sort, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await guestsApi.delete(deleteTarget.id)
      toast.success('Guest deleted.')
      setDeleteTarget(null)
      fetchItems()
    } catch {
      toast.error('Failed to delete guest.')
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Guests</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? 'guest' : 'guests'}
          </p>
        </div>
        <Button onClick={() => navigate('/guests/new')}>
          <Plus size={16} /> Add Guest
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, or mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8"
          />
        </div>
        <Select
          options={SORT_OPTIONS}
          value={sort}
          onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1) }}
          className="w-44"
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No guests found</p>
            <p className="mt-1 text-xs text-slate-400">Add your first guest to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Mobile</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nationality</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Bookings</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last Stay</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/guests/${g.id}`)}
                        className="text-sm font-medium text-slate-800 hover:underline text-left"
                      >
                        {g.full_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{g.email ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{g.mobile_number ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{g.nationality ?? '--'}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{g.booking_count}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(g.last_stay)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/guests/${g.id}`)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="View profile"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/guests/${g.id}/edit`)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(g)}
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
        title="Delete Guest"
        message={`Delete "${deleteTarget?.full_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
