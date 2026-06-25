import { useCallback, useEffect, useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { accommodationsApi, type UnitAvailabilityResponse } from '../../../api/property/accommodations'
import { Input } from '../../../components/common/Input'
import { useToast } from '../../../components/common/useToast'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function diffDays(a: string, b: string) {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000,
  )
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  })
}

function formatDayOfWeek(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short' })
}

function isWeekend(dateStr: string) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

function getUnitLabel(unitNumber: number, prefix: number | null | undefined): string {
  if (prefix == null) return `Unit ${unitNumber}`
  return `Room ${prefix * 100 + (unitNumber - 1)}`
}

interface AccommodationOption {
  id: string
  name: string
  num_units: number
}

export function AvailabilityPage() {
  const toast = useToast()
  const [options, setOptions] = useState<AccommodationOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(() => addDays(todayStr(), 29))
  const [data, setData] = useState<UnitAvailabilityResponse | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [hover, setHover] = useState<{ unitNumber: number; dateStr: string } | null>(null)

  useEffect(() => {
    accommodationsApi
      .list({ active: true, page_size: 100 })
      .then((r) =>
        setOptions(
          r.data.items.map((a) => ({ id: a.id, name: a.name, num_units: a.num_units })),
        ),
      )
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedId) return
    setLoadingData(true)
    setOverrides({})
    try {
      const r = await accommodationsApi.unitAvailability(selectedId, {
        start_date: startDate,
        end_date: endDate,
      })
      setData(r.data)
    } catch {
      toast.error('Failed to load availability.')
    }
    setLoadingData(false)
  }, [selectedId, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleStartChange = (value: string) => {
    const delta = diffDays(value, endDate)
    if (delta < 0) setEndDate(value)
    else if (delta > 29) setEndDate(addDays(value, 29))
    setStartDate(value)
  }

  const handleEndChange = (value: string) => {
    const delta = diffDays(startDate, value)
    if (delta < 0) setEndDate(startDate)
    else if (delta > 29) setEndDate(addDays(startDate, 29))
    else setEndDate(value)
  }

  const getCellValue = (unitNumber: number, dateStr: string): boolean => {
    const key = `${unitNumber}-${dateStr}`
    if (key in overrides) return overrides[key]
    const unit = data?.units.find((u) => u.unit_number === unitNumber)
    return unit?.availability[dateStr] ?? true
  }

  const toggleCell = async (unitNumber: number, dateStr: string) => {
    if (!selectedId) return
    const key = `${unitNumber}-${dateStr}`
    if (savingCell === key) return
    const current = getCellValue(unitNumber, dateStr)
    const next = !current
    setOverrides((prev) => ({ ...prev, [key]: next }))
    setSavingCell(key)
    try {
      await accommodationsApi.setUnitAvailability(selectedId, [
        { unit_number: unitNumber, date: dateStr, is_available: next },
      ])
    } catch {
      setOverrides((prev) => ({ ...prev, [key]: current }))
      toast.error('Failed to update availability.')
    }
    setSavingCell(null)
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-slate-900">Unit Availability</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage open and blocked days per unit. Click a cell to toggle.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Accommodation</label>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value)
              setData(null)
            }}
            className="h-10 min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">Select accommodation...</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} &mdash; {o.num_units} {o.num_units === 1 ? 'unit' : 'units'}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Start Date"
          type="date"
          value={startDate}
          min={todayStr()}
          onChange={(e) => handleStartChange(e.target.value)}
          className="w-44"
        />
        <Input
          label="End Date"
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => handleEndChange(e.target.value)}
          className="w-44"
        />
        <p className="self-end pb-2.5 text-xs text-slate-400">Max 30 days</p>
      </div>

      <div className="mt-4 flex items-center gap-5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-200" />
          Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-200" />
          Blocked
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {!selectedId ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Select an accommodation above to manage its unit availability.
          </div>
        ) : loadingData ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading...
          </div>
        ) : !data || data.units.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            No units found.
          </div>
        ) : (
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[128px] border-b border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-semibold text-slate-500">
                  Unit
                </th>
                {data.dates.map((d) => (
                  <th
                    key={d}
                    className={`min-w-[64px] border-b border-slate-200 px-1 py-2 text-center transition-colors ${
                      hover?.dateStr === d
                        ? 'bg-blue-100'
                        : isWeekend(d)
                          ? 'bg-slate-200'
                          : 'bg-white'
                    }`}
                  >
                    <div className="text-[10px] font-normal text-slate-400">
                      {formatDayOfWeek(d)}
                    </div>
                    <div className="text-xs font-semibold text-slate-600">
                      {formatDateLabel(d)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.units.map((unit) => (
                <tr key={unit.unit_number}>
                  <td
                    className={`sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-2 transition-colors ${
                      hover?.unitNumber === unit.unit_number ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {getUnitLabel(unit.unit_number, data.unit_prefix)}
                    </span>
                  </td>
                  {data.dates.map((d) => {
                    const key = `${unit.unit_number}-${d}`
                    const isAvailable = getCellValue(unit.unit_number, d)
                    const isSaving = savingCell === key
                    return (
                      <td
                        key={d}
                        className={`border-b border-slate-100 p-1 transition-colors ${
                          hover?.unitNumber === unit.unit_number || hover?.dateStr === d
                            ? isWeekend(d)
                              ? 'bg-blue-100'
                              : 'bg-blue-50'
                            : isWeekend(d)
                              ? 'bg-slate-100'
                              : ''
                        }`}
                      >
                        <button
                          onClick={() => toggleCell(unit.unit_number, d)}
                          onMouseEnter={() => setHover({ unitNumber: unit.unit_number, dateStr: d })}
                          onMouseLeave={() => setHover(null)}
                          disabled={isSaving}
                          title={isAvailable ? 'Click to block' : 'Click to open'}
                          className={`flex h-8 w-full items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
                            isAvailable
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isAvailable ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
