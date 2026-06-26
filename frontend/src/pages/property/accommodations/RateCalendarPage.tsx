import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, RotateCcw } from 'lucide-react'
import { accommodationsApi, type RateCalendarResponse } from '../../../api/property/accommodations'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { useToast } from '../../../components/common/useToast'

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function todayStr() {
  return localDateStr(new Date())
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

function diffDays(a: string, b: string) {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000,
  )
}

function generateDates(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00')
  const endD = new Date(end + 'T00:00:00')
  while (d <= endD) {
    dates.push(localDateStr(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
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

function formatRate(rate: string) {
  return parseFloat(rate).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

interface AccommodationOption {
  id: string
  name: string
}

export function RateCalendarPage() {
  const toast = useToast()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const cancelledRef = useRef(false)

  const [options, setOptions] = useState<AccommodationOption[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(() => addDays(todayStr(), 29))

  const [dataMap, setDataMap] = useState<Record<string, RateCalendarResponse>>({})
  const [globalLoading, setGlobalLoading] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const [localRates, setLocalRates] = useState<Record<string, string>>({})
  const [localOverridden, setLocalOverridden] = useState<Set<string>>(new Set())
  const [editCell, setEditCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [resettingCell, setResettingCell] = useState<string | null>(null)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkRate, setBulkRate] = useState('')
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  const [bulkRoomIds, setBulkRoomIds] = useState<string[]>([])
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    accommodationsApi
      .list({ active: true, page_size: 100 })
      .then((r) => setOptions(r.data.items.map((a) => ({ id: a.id, name: a.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const refetchWithDates = async (start: string, end: string, ids: string[]) => {
    if (ids.length === 0) return
    setGlobalLoading(true)
    setLocalRates({})
    setLocalOverridden(new Set())
    const newMap: Record<string, RateCalendarResponse> = {}
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await accommodationsApi.rateCalendar(id, { start_date: start, end_date: end })
          newMap[id] = r.data
        } catch {}
      }),
    )
    setDataMap(newMap)
    setGlobalLoading(false)
  }

  const handleStartChange = (value: string) => {
    const delta = diffDays(value, endDate)
    const newEnd = delta < 0 ? value : delta > 29 ? addDays(value, 29) : endDate
    setStartDate(value)
    setEndDate(newEnd)
    refetchWithDates(value, newEnd, selectedIds)
  }

  const handleEndChange = (value: string) => {
    const delta = diffDays(startDate, value)
    const newEnd = delta < 0 ? startDate : delta > 29 ? addDays(startDate, 29) : value
    setEndDate(newEnd)
    refetchWithDates(startDate, newEnd, selectedIds)
  }

  const toggleOption = async (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      setDataMap((prev) => {
        const c = { ...prev }
        delete c[id]
        return c
      })
      setLocalRates((prev) => {
        const c = { ...prev }
        Object.keys(c).forEach((key) => {
          if (key.startsWith(`${id}-`)) delete c[key]
        })
        return c
      })
      setLocalOverridden((prev) => {
        const c = new Set(prev)
        ;[...c].forEach((key) => {
          if (key.startsWith(`${id}-`)) c.delete(key)
        })
        return c
      })
    } else {
      setSelectedIds((prev) => [...prev, id])
      setLoadingIds((prev) => new Set([...prev, id]))
      try {
        const r = await accommodationsApi.rateCalendar(id, {
          start_date: startDate,
          end_date: endDate,
        })
        setDataMap((prev) => ({ ...prev, [id]: r.data }))
      } catch {
        toast.error('Failed to load rates.')
        setSelectedIds((prev) => prev.filter((x) => x !== id))
      }
      setLoadingIds((prev) => {
        const c = new Set(prev)
        c.delete(id)
        return c
      })
    }
  }

  const ck = (accommodationId: string, dateStr: string) => `${accommodationId}-${dateStr}`

  const displayRate = (accommodationId: string, dateStr: string): string => {
    const key = ck(accommodationId, dateStr)
    if (key in localRates) return localRates[key]
    return dataMap[accommodationId]?.rates[dateStr] ?? '0.00'
  }

  const isOverridden = (accommodationId: string, dateStr: string): boolean => {
    const key = ck(accommodationId, dateStr)
    if (localOverridden.has(key)) return true
    return dataMap[accommodationId]?.overridden_dates.includes(dateStr) ?? false
  }

  const startEdit = (accommodationId: string, dateStr: string) => {
    if (savingCell || resettingCell) return
    cancelledRef.current = false
    setEditCell(ck(accommodationId, dateStr))
    setEditValue(parseFloat(displayRate(accommodationId, dateStr)).toFixed(2))
  }

  const cancelEdit = () => {
    cancelledRef.current = true
    setEditCell(null)
    setEditValue('')
  }

  const commitEdit = async (accommodationId: string, dateStr: string) => {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    setEditCell(null)
    const raw = editValue.trim()
    if (!raw) return
    const parsed = parseFloat(raw)
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Invalid rate value.')
      return
    }
    const newRate = parsed.toFixed(2)
    if (newRate === parseFloat(displayRate(accommodationId, dateStr)).toFixed(2)) return

    const key = ck(accommodationId, dateStr)
    const prevLocalRate = localRates[key]
    const wasOverridden = isOverridden(accommodationId, dateStr)

    setLocalRates((r) => ({ ...r, [key]: newRate }))
    setLocalOverridden((s) => new Set([...s, key]))
    setSavingCell(key)

    try {
      await accommodationsApi.setRateCalendar(accommodationId, [{ date: dateStr, rate: newRate }])
    } catch {
      setLocalRates((r) => {
        const c = { ...r }
        if (prevLocalRate !== undefined) c[key] = prevLocalRate
        else delete c[key]
        return c
      })
      if (!wasOverridden) {
        setLocalOverridden((s) => {
          const c = new Set(s)
          c.delete(key)
          return c
        })
      }
      toast.error('Failed to save rate.')
    }
    setSavingCell(null)
  }

  const resetOverride = async (accommodationId: string, dateStr: string) => {
    const key = ck(accommodationId, dateStr)
    setResettingCell(key)
    try {
      await accommodationsApi.deleteRateOverrides(accommodationId, [dateStr])
      const accData = dataMap[accommodationId]
      const defaultRate =
        accData && isWeekend(dateStr) && accData.weekend_rate
          ? accData.weekend_rate
          : accData?.base_rate ?? '0.00'
      setLocalRates((r) => {
        const c = { ...r }
        delete c[key]
        return c
      })
      setLocalOverridden((s) => {
        const c = new Set(s)
        c.delete(key)
        return c
      })
      setDataMap((d) => {
        if (!d[accommodationId]) return d
        return {
          ...d,
          [accommodationId]: {
            ...d[accommodationId],
            rates: { ...d[accommodationId].rates, [dateStr]: defaultRate },
            overridden_dates: d[accommodationId].overridden_dates.filter((dd) => dd !== dateStr),
          },
        }
      })
    } catch {
      toast.error('Failed to reset rate.')
    }
    setResettingCell(null)
  }

  const openBulk = () => {
    setBulkFrom(startDate)
    setBulkTo(endDate)
    setBulkRoomIds([...selectedIds])
    setBulkRate('')
    setBulkOpen(true)
  }

  const applyBulk = async () => {
    const parsed = parseFloat(bulkRate)
    if (!bulkRate || isNaN(parsed) || parsed < 0) {
      toast.error('Enter a valid rate.')
      return
    }
    if (!bulkFrom || !bulkTo || diffDays(bulkFrom, bulkTo) < 0) {
      toast.error('Select a valid date range.')
      return
    }
    if (bulkRoomIds.length === 0) {
      toast.error('Select at least one accommodation.')
      return
    }
    const rateStr = parsed.toFixed(2)
    const bulkDates = generateDates(bulkFrom, bulkTo)
    setApplying(true)
    try {
      await Promise.all(
        bulkRoomIds.map((id) =>
          accommodationsApi.setRateCalendar(
            id,
            bulkDates.map((d) => ({ date: d, rate: rateStr })),
          ),
        ),
      )
      setLocalRates((prev) => {
        const c = { ...prev }
        for (const id of bulkRoomIds) {
          for (const d of bulkDates) {
            c[ck(id, d)] = rateStr
          }
        }
        return c
      })
      setLocalOverridden((prev) => {
        const c = new Set(prev)
        for (const id of bulkRoomIds) {
          for (const d of bulkDates) {
            c.add(ck(id, d))
          }
        }
        return c
      })
      toast.success(
        `₱${formatRate(rateStr)} applied to ${bulkRoomIds.length} accommodation(s) across ${bulkDates.length} day(s).`,
      )
    } catch {
      toast.error('Failed to apply bulk update.')
    }
    setApplying(false)
  }

  const dates = generateDates(startDate, endDate)
  const hasAnyData = selectedIds.some((id) => dataMap[id])
  const showSpinner = globalLoading || (selectedIds.length > 0 && !hasAnyData && loadingIds.size > 0)

  const dropdownLabel =
    selectedIds.length === 0
      ? 'Select accommodation...'
      : selectedIds.length === 1
        ? (options.find((o) => o.id === selectedIds[0])?.name ?? '1 selected')
        : `${selectedIds.length} accommodations`

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-slate-900">Rate Calendar</h1>
      <p className="mt-1 text-sm text-slate-500">
        Set daily rate overrides per accommodation. Click a cell to edit. Weekend columns use the
        weekend rate by default if configured.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Accommodation</label>
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex h-10 min-w-[240px] items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <span className={`truncate ${selectedIds.length === 0 ? 'text-slate-400' : ''}`}>
                {dropdownLabel}
              </span>
              <ChevronDown
                size={14}
                className={`ml-2 flex-shrink-0 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 max-h-60 min-w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {options.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">No accommodations found.</p>
                ) : (
                  options.map((o) => (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o.id)}
                        onChange={() => toggleOption(o.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-700"
                      />
                      <span className="text-sm text-slate-700">{o.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
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
          <span className="inline-block h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-300" />
          Override
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-slate-200" />
          Weekend default
        </span>
      </div>

      {hasAnyData && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white">
          <button
            onClick={() => (bulkOpen ? setBulkOpen(false) : openBulk())}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ChevronRight
              size={14}
              className={`text-slate-400 transition-transform duration-150 ${bulkOpen ? 'rotate-90' : ''}`}
            />
            Bulk Rate Update
          </button>

          {bulkOpen && (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3">
              <div className="flex flex-wrap items-end gap-4">
                <Input
                  label="New Rate (₱)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={bulkRate}
                  onChange={(e) => setBulkRate(e.target.value)}
                  className="w-36"
                />
                <Input
                  label="From"
                  type="date"
                  value={bulkFrom}
                  min={startDate}
                  max={bulkTo || endDate}
                  onChange={(e) => setBulkFrom(e.target.value)}
                  className="w-44"
                />
                <Input
                  label="To"
                  type="date"
                  value={bulkTo}
                  min={bulkFrom || startDate}
                  max={endDate}
                  onChange={(e) => setBulkTo(e.target.value)}
                  className="w-44"
                />

                {selectedIds.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-600">Apply to</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {selectedIds.map((id) => {
                        const name = dataMap[id]?.name ?? options.find((o) => o.id === id)?.name ?? id
                        return (
                          <label key={id} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={bulkRoomIds.includes(id)}
                              onChange={() =>
                                setBulkRoomIds((prev) =>
                                  prev.includes(id)
                                    ? prev.filter((x) => x !== id)
                                    : [...prev, id],
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-700"
                            />
                            <span className="text-sm text-slate-700">{name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Button
                  onClick={applyBulk}
                  loading={applying}
                  disabled={applying || !bulkRate || bulkRoomIds.length === 0}
                  className="self-end"
                >
                  Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {selectedIds.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Select one or more accommodations above to manage rates.
          </div>
        ) : showSpinner ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading...
          </div>
        ) : (
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-semibold text-slate-500">
                  Accommodation
                </th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className={`min-w-[88px] border-b border-slate-200 px-1 py-2 text-center ${
                      isWeekend(d) ? 'bg-slate-200' : 'bg-white'
                    }`}
                  >
                    <div className="text-[10px] font-normal text-slate-400">
                      {formatDayOfWeek(d)}
                    </div>
                    <div className="text-xs font-semibold text-slate-600">{formatDateLabel(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedIds.map((id) => {
                if (loadingIds.has(id)) {
                  const name = options.find((o) => o.id === id)?.name ?? id
                  return (
                    <tr key={id}>
                      <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                          <span className="text-sm font-medium text-slate-500">{name}</span>
                        </div>
                      </td>
                      {dates.map((d) => (
                        <td key={d} className="border-b border-slate-100 p-1">
                          <div className="h-10 w-full rounded-md bg-slate-50" />
                        </td>
                      ))}
                    </tr>
                  )
                }

                const accData = dataMap[id]
                if (!accData) return null

                return (
                  <tr key={id}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2">
                      <span className="text-sm font-medium text-slate-700">{accData.name}</span>
                    </td>
                    {dates.map((d) => {
                      const key = ck(id, d)
                      const overridden = isOverridden(id, d)
                      const isEditing = editCell === key
                      const isSaving = savingCell === key
                      const isResetting = resettingCell === key
                      const rate = displayRate(id, d)
                      const weekend = isWeekend(d)

                      const cellBg = overridden ? 'bg-amber-50' : weekend ? 'bg-slate-100' : ''

                      return (
                        <td
                          key={d}
                          className={`border-b border-slate-100 p-1 transition-colors ${cellBg}`}
                        >
                          <div className="group relative">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(id, d)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                autoFocus
                                className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-center text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
                              />
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(id, d)}
                                  disabled={isSaving || isResetting}
                                  title="Click to edit"
                                  className="flex h-10 w-full items-center justify-center rounded-md text-xs font-medium text-slate-700 transition-colors hover:bg-white/70 disabled:opacity-50"
                                >
                                  {isSaving || isResetting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                                  ) : (
                                    <>
                                      <span className="mr-0.5 text-[10px] text-slate-400">₱</span>
                                      {formatRate(rate)}
                                    </>
                                  )}
                                </button>
                                {overridden && !isSaving && !isResetting && (
                                  <button
                                    onClick={() => resetOverride(id, d)}
                                    title="Reset to default rate"
                                    className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
                                  >
                                    <RotateCcw className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </>
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
    </div>
  )
}
