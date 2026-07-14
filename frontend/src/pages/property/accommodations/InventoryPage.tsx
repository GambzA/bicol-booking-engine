import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { accommodationsApi } from '../../../api/property/accommodations'
import {
  inventoryApi, type InventoryResponse, type InventoryDay, type InventoryAdjustment, type PreviewResponse,
} from '../../../api/property/inventory'
import { INVENTORY_ADJUSTMENT_REASONS } from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { MultiSelect } from '../../../components/common/MultiSelect'
import { Modal } from '../../../components/common/Modal'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { useToast } from '../../../components/common/useToast'

function localDateStr(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function todayStr() { return localDateStr(new Date()) }
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + days); return localDateStr(d)
}
function diffDays(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}
function dayNum(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { day: 'numeric' }) }
function dowShort(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short' }) }
function monShort(dateStr: string) { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short' }) }
function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}
function isWeekend(dateStr: string) {
  const day = new Date(dateStr + 'T00:00:00').getDay(); return day === 0 || day === 6
}
function isFirstOfMonth(dates: string[], i: number) {
  return i === 0 || monShort(dates[i]) !== monShort(dates[i - 1])
}

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  INVENTORY_ADJUSTMENT_REASONS.map((r) => [r.value, r.label]),
)

interface AccOption { id: string; name: string; num_units: number }

function cellClass(d: InventoryDay): string {
  if (d.available === 0) return 'bg-red-100 text-red-700'
  if (d.adjustments !== 0) return 'bg-amber-50 text-amber-800'
  return 'text-slate-700'
}

export function InventoryPage() {
  const toast = useToast()
  const [options, setOptions] = useState<AccOption[]>([])
  const [roomFilter, setRoomFilter] = useState<string[]>([])
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(() => addDays(todayStr(), 29))
  const [grid, setGrid] = useState<InventoryResponse | null>(null)
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InventoryAdjustment | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    accommodationsApi.list({ active: true, page_size: 100 })
      .then((r) => setOptions(r.data.items.map((a) => ({ id: a.id, name: a.name, num_units: a.num_units }))))
      .catch(() => {})
  }, [])

  const clampEnd = (start: string, end: string) => {
    const delta = diffDays(start, end)
    if (delta < 0) return start
    if (delta > 89) return addDays(start, 89)
    return end
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [g, adj] = await Promise.all([
        inventoryApi.grid({ date_from: startDate, date_to: endDate }),
        inventoryApi.listAdjustments({ date_from: startDate, date_to: endDate }),
      ])
      setGrid(g.data)
      setAdjustments(adj.data.items)
    } catch {
      toast.error('Failed to load inventory.')
    }
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const dates = grid?.dates ?? []
  const visibleAccs = grid
    ? (roomFilter.length === 0 ? grid.accommodations : grid.accommodations.filter((a) => roomFilter.includes(a.id)))
    : []
  const visibleAdjustments = roomFilter.length === 0
    ? adjustments
    : adjustments.filter((a) => roomFilter.includes(a.accommodation_id))

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await inventoryApi.deleteAdjustment(deleteTarget.id)
      toast.success('Adjustment removed.')
      setDeleteTarget(null)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to remove adjustment.')
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory Availability</h1>
          <p className="mt-1 text-sm text-slate-500">Available rooms per day. Numbers show units available for booking.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={options.length === 0}>
          <Plus size={16} /> Add Adjustment
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="flex w-60 flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Rooms</label>
          <MultiSelect
            options={options.map((o) => ({ value: o.id, label: o.name, hint: `${o.num_units} units` }))}
            value={roomFilter}
            onChange={setRoomFilter}
            placeholder="All rooms"
            searchPlaceholder="Search rooms..."
          />
        </div>
        <Input
          label="Start Date" type="date" value={startDate} min={todayStr()}
          onChange={(e) => {
            const s = e.target.value
            const dur = Math.max(0, diffDays(startDate, endDate))
            setStartDate(s)
            setEndDate(clampEnd(s, addDays(s, dur)))
          }}
          className="w-44"
        />
        <Input
          label="End Date" type="date" value={endDate} min={startDate}
          onChange={(e) => setEndDate(clampEnd(startDate, e.target.value))}
          className="w-44"
        />
        <p className="self-end pb-2.5 text-xs text-slate-400">Max 90 days</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-white ring-1 ring-slate-200" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-amber-100" /> Adjusted</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-red-100" /> Sold out</span>
        <span className="text-slate-400">Hover a cell for the full breakdown.</span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading...</div>
        ) : !grid || visibleAccs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            {grid && grid.accommodations.length > 0 ? 'No rooms match the filter.' : 'No active accommodations.'}
          </div>
        ) : (
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-slate-200 bg-white px-4 py-2 text-left text-xs font-semibold text-slate-500">
                  Accommodation
                </th>
                {dates.map((d, i) => (
                  <th
                    key={d}
                    className={`min-w-[52px] border-b border-slate-200 px-1 py-1.5 text-center ${isWeekend(d) ? 'bg-slate-100' : 'bg-white'} ${isFirstOfMonth(dates, i) ? 'border-l border-slate-200' : ''}`}
                  >
                    <div className="text-[10px] font-normal text-slate-400">{dowShort(d)}</div>
                    <div className="text-xs font-semibold text-slate-600">{dayNum(d)}</div>
                    {isFirstOfMonth(dates, i) && <div className="text-[9px] font-medium uppercase text-slate-400">{monShort(d)}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleAccs.map((a) => {
                const byDate: Record<string, InventoryDay> = Object.fromEntries(a.days.map((d) => [d.date, d]))
                return (
                  <tr key={a.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2">
                      <div className="text-sm font-medium text-slate-700">{a.name}</div>
                      <div className="text-xs text-slate-400">{a.total_units} units</div>
                    </td>
                    {dates.map((dt) => {
                      const d = byDate[dt]
                      if (!d) return <td key={dt} className="border-b border-slate-100" />
                      return (
                        <td key={dt} className={`border-b border-slate-100 p-0.5 ${isWeekend(dt) ? 'bg-slate-50' : ''}`}>
                          <div
                            title={`${fmtDate(dt)}\nTotal ${d.total_units} · Reserved ${d.reserved} · Adjustment ${d.adjustments} · Sellable ${d.sellable} · Available ${d.available}`}
                            className={`flex h-9 flex-col items-center justify-center rounded ${cellClass(d)}`}
                          >
                            <span className="text-sm font-semibold leading-none">{d.available}</span>
                            {d.adjustments !== 0 && (
                              <span className="text-[9px] leading-none">{d.adjustments > 0 ? `+${d.adjustments}` : d.adjustments}</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-800">Adjustments in range</h2>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white">
          {visibleAdjustments.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No inventory adjustments in the selected range.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleAdjustments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-slate-700">{a.accommodation_name}</span>
                      <span className={`font-semibold ${a.adjustment_value < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {a.adjustment_value > 0 ? `+${a.adjustment_value}` : a.adjustment_value}
                      </span>
                      <span className="text-slate-500">{REASON_LABEL[a.reason] ?? a.reason}</span>
                      <span className="text-xs text-slate-400">{fmtDate(a.start_date)} – {fmtDate(a.end_date)}</span>
                    </div>
                    {a.notes && <p className="mt-0.5 truncate text-xs text-slate-500">{a.notes}</p>}
                    {a.created_by_name && <p className="text-xs text-slate-400">by {a.created_by_name}</p>}
                  </div>
                  <button
                    onClick={() => setDeleteTarget(a)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <AddAdjustmentModal
          options={options}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); fetchData() }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Adjustment"
        message="Remove this inventory adjustment? Sellable inventory for the affected dates will be recalculated."
        confirmLabel="Remove"
        loading={deleting}
      />
    </div>
  )
}

function AddAdjustmentModal({
  options, onClose, onSaved,
}: {
  options: AccOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [accIds, setAccIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(todayStr())
  const [magnitude, setMagnitude] = useState('1')
  const [direction, setDirection] = useState<'decrease' | 'increase'>('decrease')
  const [reason, setReason] = useState(INVENTORY_ADJUSTMENT_REASONS[0].value)
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)

  const mag = parseInt(magnitude, 10)
  const signedValue = (direction === 'decrease' ? -1 : 1) * (isNaN(mag) ? 0 : mag)
  const valid = accIds.length > 0 && !!startDate && !!endDate && diffDays(startDate, endDate) >= 0
    && !isNaN(mag) && mag >= 1

  const handlePreview = async () => {
    if (!valid) return
    setPreviewing(true)
    try {
      const r = await inventoryApi.preview({
        accommodation_ids: accIds, start_date: startDate, end_date: endDate, adjustment_value: signedValue,
      })
      setPreview(r.data)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to preview.')
    }
    setPreviewing(false)
  }

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await inventoryApi.createAdjustment({
        accommodation_ids: accIds, start_date: startDate, end_date: endDate,
        adjustment_value: signedValue, reason, notes: notes || null,
      })
      toast.success('Adjustment saved.')
      onSaved()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to save adjustment.')
    }
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title="Add Inventory Adjustment" size="lg">
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Accommodation</label>
          <MultiSelect
            single
            options={options.map((o) => ({ value: o.id, label: o.name, hint: `${o.num_units} units` }))}
            value={accIds}
            onChange={(next) => { setAccIds(next); setPreview(null) }}
            placeholder="Select a room..."
            searchPlaceholder="Search rooms..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => {
            const s = e.target.value
            const dur = Math.max(0, diffDays(startDate, endDate))
            setStartDate(s); setEndDate(addDays(s, dur)); setPreview(null)
          }} />
          <Input label="End Date" type="date" value={endDate} min={startDate} onChange={(e) => { setEndDate(e.target.value); setPreview(null) }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Adjustment</label>
            <Select
              options={[
                { value: 'decrease', label: 'Reduce availability' },
                { value: 'increase', label: 'Increase availability' },
              ]}
              value={direction}
              onChange={(e) => { setDirection(e.target.value as 'decrease' | 'increase'); setPreview(null) }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Number of rooms</label>
            <Input type="number" min="1" step="1" value={magnitude} onChange={(e) => { setMagnitude(e.target.value); setPreview(null) }} placeholder="e.g. 2" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Reason</label>
          <Select options={INVENTORY_ADJUSTMENT_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />

        {preview && (
          <div className="rounded-lg border border-slate-200">
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Impact preview
            </p>
            <div className="max-h-52 space-y-3 overflow-y-auto p-3">
              {preview.accommodations.map((a) => (
                <div key={a.accommodation_id}>
                  <p className="mb-1 text-sm font-medium text-slate-700">{a.accommodation_name}</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="py-1 text-left font-medium">Date</th>
                        <th className="py-1 text-right font-medium">Sellable</th>
                        <th className="py-1 text-right font-medium">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.days.map((d) => (
                        <tr key={d.date} className="border-t border-slate-50">
                          <td className="py-1 text-slate-600">{fmtDate(d.date)}</td>
                          <td className="py-1 text-right text-slate-600">{d.sellable_before} → <span className="font-medium text-slate-800">{d.sellable_after}</span></td>
                          <td className="py-1 text-right text-slate-600">{d.available_before} → <span className={`font-medium ${d.available_after === 0 ? 'text-red-600' : 'text-slate-800'}`}>{d.available_after}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="secondary" onClick={handlePreview} loading={previewing} disabled={!valid}>Preview Impact</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!valid}>Save Adjustment</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
