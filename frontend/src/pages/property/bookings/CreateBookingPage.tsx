import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Check, Plus, Trash2, X } from 'lucide-react'
import {
  bookingsApi, type AvailabilityResult, type BookingQuote, type RoomInput,
} from '../../../api/property/bookings'
import { taxesApi, type TaxLine } from '../../../api/property/taxes'
import { guestsApi, type Guest } from '../../../api/property/guests'
import { BOOKING_SOURCES } from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { Textarea } from '../../../components/common/Textarea'
import { useToast } from '../../../components/common/useToast'

function isoDate(d: Date): string {
  // Build from local parts to avoid UTC day-shift (Asia/Manila is +08:00).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return isoDate(dt)
}
function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}
function nightsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86400000)
}
function money(s: string): string {
  return parseFloat(s).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STEPS = ['Rooms', 'Guests', 'Confirm']

// Client-side cart room. `quote` holds the live server price for this room.
interface Occupant { full_name: string }
interface ChildOccupant { age: number; full_name: string }
interface CartRoom {
  key: string
  acc: AvailabilityResult
  ratePlanId: string
  promotionId: string
  packageId: string
  adults: Occupant[]
  children: ChildOccupant[]
  quote: BookingQuote | null
  quoting: boolean
  error: string | null
}

let ROOM_SEQ = 0
function nextKey(): string {
  ROOM_SEQ += 1
  return `room-${ROOM_SEQ}`
}

// Number input that keeps a local text buffer so the field can be cleared
// (backspaced to empty) while typing. Value commits on valid change; clamps on blur.
function NumberField({ value, onCommit, min, max, className }: {
  value: number
  onCommit: (n: number) => void
  min?: number
  max?: number
  className?: string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  const clamp = (n: number) => {
    if (min !== undefined) n = Math.max(min, n)
    if (max !== undefined) n = Math.min(max, n)
    return n
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      className={className}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (raw !== '') {
          const n = parseInt(raw, 10)
          if (!Number.isNaN(n)) onCommit(clamp(n))
        }
      }}
      onBlur={() => {
        const n = parseInt(text, 10)
        const finalN = Number.isNaN(n) ? (min ?? 0) : clamp(n)
        setText(String(finalN))
        onCommit(finalN)
      }}
    />
  )
}

export function CreateBookingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(1)

  // Step 1 — search
  const todayISO = isoDate(new Date())
  const [checkIn, setCheckIn] = useState(addDays(todayISO, 1))
  const [checkOut, setCheckOut] = useState(addDays(todayISO, 2))
  const [adults, setAdults] = useState(1)
  const [childAges, setChildAges] = useState<number[]>([])
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<AvailabilityResult[] | null>(null)

  // Step 2 — room cart
  const [rooms, setRooms] = useState<CartRoom[]>([])

  // Step 3 — guest
  const [guestSearch, setGuestSearch] = useState('')
  const [guestResults, setGuestResults] = useState<Guest[]>([])
  const [guest, setGuest] = useState<{ id: string; name: string } | null>(null)
  const [showNewGuest, setShowNewGuest] = useState(false)
  const [ng, setNg] = useState({ first_name: '', last_name: '', email: '', mobile_number: '' })
  const [creatingGuest, setCreatingGuest] = useState(false)

  // Step 4 — confirm
  const [source, setSource] = useState('walk_in')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const primaryName = guest?.name ?? ''
  const nights = nightsBetween(checkIn, checkOut)

  const handleCheckInChange = (value: string) => {
    if (!value) return
    setCheckIn(value)
    if (checkOut <= value) setCheckOut(addDays(value, 1))
  }

  const setChildCount = (n: number) => {
    setChildAges((prev) => {
      const next = [...prev]
      if (n < next.length) return next.slice(0, n)
      while (next.length < n) next.push(0)
      return next
    })
  }

  const handleSearch = async () => {
    if (new Date(checkOut) <= new Date(checkIn)) { toast.error('Check-out must be after check-in.'); return }
    setSearching(true)
    try {
      const r = await bookingsApi.searchAvailability({
        check_in_date: checkIn, check_out_date: checkOut, num_adults: adults, children_ages: childAges,
      })
      setResults(r.data.results)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Search failed.')
    }
    setSearching(false)
  }

  // ─── Live per-room pricing ──────────────────────────────────────────────
  const patchRoom = (key: string, patch: Partial<CartRoom>) => {
    setRooms((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const fetchRoomQuote = async (room: CartRoom) => {
    patchRoom(room.key, { quoting: true, error: null })
    try {
      const r = await bookingsApi.quote({
        accommodation_id: room.acc.accommodation_id,
        check_in_date: checkIn, check_out_date: checkOut,
        num_adults: room.adults.length,
        children_ages: room.children.map((c) => c.age),
        rate_plan_id: room.ratePlanId || null,
        promotion_id: room.promotionId || null,
        package_id: room.packageId || null,
      })
      patchRoom(room.key, { quote: r.data, quoting: false, error: null })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      patchRoom(room.key, { quote: null, quoting: false, error: detail ?? 'Could not price this room.' })
    }
  }

  // Re-quote a room after we mutate it. Reads from the freshly-built room object.
  const requote = (key: string, mutate: (r: CartRoom) => CartRoom) => {
    setRooms((prev) => {
      const next = prev.map((r) => (r.key === key ? mutate(r) : r))
      const updated = next.find((r) => r.key === key)
      if (updated) fetchRoomQuote(updated)
      return next
    })
  }

  // When the stay dates change, prior search results are stale and any rooms
  // already in the cart must be re-priced against the new dates.
  const firstDatesRender = useRef(true)
  useEffect(() => {
    if (firstDatesRender.current) { firstDatesRender.current = false; return }
    setResults(null)
    rooms.forEach((r) => fetchRoomQuote(r))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut])

  const addRoom = (acc: AvailabilityResult) => {
    const inCart = rooms.filter((r) => r.acc.accommodation_id === acc.accommodation_id).length
    if (inCart >= acc.available_units) {
      toast.error(`Only ${acc.available_units} unit(s) of ${acc.name} available for these dates.`)
      return
    }
    const room: CartRoom = {
      key: nextKey(),
      acc,
      ratePlanId: '', promotionId: '', packageId: '',
      adults: Array.from({ length: Math.max(1, adults) }, () => ({ full_name: '' })),
      children: childAges.map((age) => ({ age, full_name: '' })),
      quote: null, quoting: false, error: null,
    }
    setRooms((prev) => [...prev, room])
    fetchRoomQuote(room)
  }

  const removeRoom = (key: string) => {
    setRooms((prev) => prev.filter((r) => r.key !== key))
  }

  const setAdultCount = (key: string, n: number) => {
    requote(key, (r) => {
      const adultsArr = [...r.adults]
      if (n < adultsArr.length) return { ...r, adults: adultsArr.slice(0, n) }
      while (adultsArr.length < n) adultsArr.push({ full_name: '' })
      return { ...r, adults: adultsArr }
    })
  }
  const setAdultName = (key: string, i: number, name: string) => {
    setRooms((prev) => prev.map((r) => {
      if (r.key !== key) return r
      const adultsArr = r.adults.map((a, j) => (j === i ? { ...a, full_name: name } : a))
      return { ...r, adults: adultsArr }
    }))
  }
  const addChild = (key: string) => {
    requote(key, (r) => ({ ...r, children: [...r.children, { age: 0, full_name: '' }] }))
  }
  const removeChild = (key: string, i: number) => {
    requote(key, (r) => ({ ...r, children: r.children.filter((_, j) => j !== i) }))
  }
  const setChildAge = (key: string, i: number, age: number) => {
    requote(key, (r) => ({ ...r, children: r.children.map((c, j) => (j === i ? { ...c, age } : c)) }))
  }
  const setChildName = (key: string, i: number, name: string) => {
    setRooms((prev) => prev.map((r) => {
      if (r.key !== key) return r
      return { ...r, children: r.children.map((c, j) => (j === i ? { ...c, full_name: name } : c)) }
    }))
  }
  const setOffering = (key: string, field: 'ratePlanId' | 'promotionId' | 'packageId', value: string) => {
    requote(key, (r) => ({ ...r, [field]: value }))
  }

  // ─── Guest ──────────────────────────────────────────────────────────────
  const handleGuestSearch = async () => {
    try {
      const r = await guestsApi.list({ search: guestSearch || undefined, page_size: 10 })
      setGuestResults(r.data.items)
    } catch { toast.error('Guest search failed.') }
  }

  const handleCreateGuest = async () => {
    if (!ng.first_name.trim() || !ng.last_name.trim()) { toast.error('First and last name are required.'); return }
    setCreatingGuest(true)
    try {
      const r = await guestsApi.create({
        first_name: ng.first_name, last_name: ng.last_name,
        email: ng.email || null, mobile_number: ng.mobile_number || null,
      }, true)
      setGuest({ id: r.data.id, name: r.data.full_name })
      setShowNewGuest(false)
      toast.success('Guest created.')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to create guest.')
    }
    setCreatingGuest(false)
  }

  // ─── Confirm ──────────────────────────────────────────────────────────────
  const grandTotal = rooms.reduce((sum, r) => sum + (r.quote ? parseFloat(r.quote.total_amount) : 0), 0)
  const allPriced = rooms.length > 0 && rooms.every((r) => r.quote && !r.error && !r.quoting)
  const totalAdults = rooms.reduce((s, r) => s + r.adults.length, 0)
  const totalChildren = rooms.reduce((s, r) => s + r.children.length, 0)

  // Reservation-level taxes previewed live once the rooms are priced. Computed
  // server-side (single source of truth) over the summed net subtotal.
  const [taxLines, setTaxLines] = useState<TaxLine[]>([])
  const [taxTotal, setTaxTotal] = useState(0)
  useEffect(() => {
    if (!allPriced) { setTaxLines([]); setTaxTotal(0); return }
    let cancelled = false
    taxesApi
      .preview({ subtotal: String(grandTotal), nights, num_adults: totalAdults, num_children: totalChildren })
      .then((r) => { if (!cancelled) { setTaxLines(r.data.taxes); setTaxTotal(parseFloat(r.data.tax_total)) } })
      .catch(() => { if (!cancelled) { setTaxLines([]); setTaxTotal(0) } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPriced, grandTotal, nights, totalAdults, totalChildren])
  const finalTotal = grandTotal + taxTotal

  const handleConfirm = async (status: 'confirmed' | 'pending') => {
    if (!guest || !allPriced) return
    setSaving(true)
    try {
      const payload: RoomInput[] = rooms.map((r) => ({
        accommodation_id: r.acc.accommodation_id,
        rate_plan_id: r.ratePlanId || null,
        promotion_id: r.promotionId || null,
        package_id: r.packageId || null,
        adults: r.adults.map((a) => ({ full_name: a.full_name.trim() || null })),
        children: r.children.map((c) => ({ age: c.age, full_name: c.full_name.trim() || null })),
      }))
      const r = await bookingsApi.create({
        guest_id: guest.id,
        check_in_date: checkIn, check_out_date: checkOut,
        booking_source: source, notes: notes || null, status,
        rooms: payload,
      })
      toast.success('Booking created.')
      navigate(`/bookings/${r.data.id}`)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to create booking.')
    }
    setSaving(false)
  }

  // Summary panel is always shown so the two-column layout never reflows.
  const showSummary = true

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bookings')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-slate-900">New Booking</h1>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {STEPS.map((label, i) => {
            const n = i + 1
            const done = step > n
            const active = step === n
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  active ? 'bg-slate-900 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {done ? <Check size={14} /> : n}
                </div>
                <span className={`text-xs font-medium ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
                {n < STEPS.length && <div className="h-px w-8 bg-slate-200" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className={`mx-auto max-w-6xl p-8 ${showSummary ? 'grid grid-cols-1 gap-6 lg:grid-cols-3' : ''}`}>
        <div className={showSummary ? 'space-y-6 lg:col-span-2' : ''}>
          {/* STEP 1 — SEARCH & ROOMS */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Check-in</label>
                    <Input type="date" min={todayISO} value={checkIn} onChange={(e) => handleCheckInChange(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Check-out</label>
                    <Input type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Adults</label>
                    <NumberField value={adults} onCommit={setAdults} min={1} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Children</label>
                    <NumberField value={childAges.length} onCommit={setChildCount} min={0} />
                  </div>
                </div>
                {childAges.length > 0 && (
                  <div className="mt-4">
                    <label className="mb-1 block text-sm font-medium text-slate-600">Child ages</label>
                    <div className="flex flex-wrap gap-2">
                      {childAges.map((age, i) => (
                        <NumberField
                          key={i}
                          value={age}
                          onCommit={(n) => setChildAges((prev) => prev.map((a, j) => (j === i ? n : a)))}
                          min={0}
                          max={17}
                          className="w-20"
                        />
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-400">Occupancy here is the default for each room you add. You can adjust it per room below.</p>
                <Button className="mt-4" onClick={handleSearch} loading={searching}>
                  <Search size={16} /> Search Availability
                </Button>
              </div>

              {results !== null && (
                <div className="space-y-3">
                  {results.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
                      No accommodations available for these dates and occupancy.
                    </div>
                  ) : results.map((r) => {
                    const inCart = rooms.filter((x) => x.acc.accommodation_id === r.accommodation_id).length
                    const full = inCart >= r.available_units
                    return (
                      <div key={r.accommodation_id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                          <p className="text-xs text-slate-500">
                            {r.available_units} unit(s) available{inCart > 0 ? ` · ${inCart} in booking` : ''} &middot; base ₱{money(r.base_rate)}/night
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {r.rate_plans.length} rate plan(s) &middot; {r.promotions.length} promo(s) &middot; {r.packages.length} package(s)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Est. total ({r.nights} nights)</p>
                          <p className="text-lg font-bold text-slate-900">&#8369;{money(r.estimated_total)}</p>
                          <Button className="mt-1" onClick={() => addRoom(r)} disabled={full}><Plus size={14} /> Add room</Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {rooms.length > 0 && (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">Your rooms</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{rooms.length}</span>
                </div>
              )}
              {rooms.map((room, idx) => (
                <div key={room.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {/* Header */}
                  <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{room.acc.name}</p>
                      <p className="text-xs text-slate-400">{room.acc.accommodation_type}</p>
                    </div>
                    <button onClick={() => removeRoom(room.key)} className="flex-none rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-5 px-5 py-5">
                    {/* Offerings */}
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Offerings</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Rate Plan</label>
                          <Select
                            value={room.ratePlanId}
                            onChange={(e) => setOffering(room.key, 'ratePlanId', e.target.value)}
                            options={[{ value: '', label: 'Standard (base rate)' }, ...room.acc.rate_plans.map((rp) => ({ value: rp.id, label: rp.name }))]}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Promotion</label>
                          <Select
                            value={room.promotionId}
                            onChange={(e) => setOffering(room.key, 'promotionId', e.target.value)}
                            options={[{ value: '', label: 'None' }, ...room.acc.promotions.map((p) => ({ value: p.id, label: p.name }))]}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Package</label>
                          <Select
                            value={room.packageId}
                            onChange={(e) => setOffering(room.key, 'packageId', e.target.value)}
                            options={[{ value: '', label: 'None' }, ...room.acc.packages.map((p) => ({ value: p.id, label: p.name }))]}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Occupancy (names are captured in the Guests step) */}
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Occupancy</p>
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Adults</label>
                          <div className="w-24">
                            <NumberField value={room.adults.length} onCommit={(n) => setAdultCount(room.key, n)} min={1} max={room.acc.max_occupancy || undefined} />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-500">Children</label>
                            <Button variant="secondary" onClick={() => addChild(room.key)}><Plus size={14} /> Add child</Button>
                          </div>
                          {room.children.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {room.children.map((c, i) => (
                                <div key={i} className="flex items-center gap-1 rounded-lg border border-slate-100 px-2 py-1 bg-gray-50">
                                  <div className="w-16">
                                    <NumberField value={c.age} onCommit={(n) => setChildAge(room.key, i, n)} min={0} max={17} />
                                  </div>
                                  <span className="text-xs text-slate-400">yrs</span>
                                  <button onClick={() => removeChild(room.key, i)} className="text-slate-400 hover:text-red-600">
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">No children</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Room price */}
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm">
                    {room.quoting ? (
                      <p className="text-slate-400">Calculating...</p>
                    ) : room.error ? (
                      <p className="text-red-500">{room.error}</p>
                    ) : room.quote ? (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Room total ({room.quote.nights} nights)</span>
                        <span className="text-base font-bold text-slate-900">&#8369;{money(room.quote.total_amount)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {rooms.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!allPriced}>Continue to guest</Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — GUESTS */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Primary guest</h3>
                {guest ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{guest.name}</p>
                      <p className="text-xs text-slate-400">Primary guest</p>
                    </div>
                    <Button variant="secondary" onClick={() => setGuest(null)}>Change</Button>
                  </div>
                ) : showNewGuest ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First name" value={ng.first_name} onChange={(e) => setNg({ ...ng, first_name: e.target.value })} />
                      <Input placeholder="Last name" value={ng.last_name} onChange={(e) => setNg({ ...ng, last_name: e.target.value })} />
                      <Input placeholder="Email (optional)" value={ng.email} onChange={(e) => setNg({ ...ng, email: e.target.value })} />
                      <Input placeholder="Mobile (optional)" value={ng.mobile_number} onChange={(e) => setNg({ ...ng, mobile_number: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateGuest} loading={creatingGuest}>Create &amp; Select</Button>
                      <Button variant="secondary" onClick={() => setShowNewGuest(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="pl-8"
                          placeholder="Search guests by name, email, mobile..."
                          value={guestSearch}
                          onChange={(e) => setGuestSearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGuestSearch() }}
                        />
                      </div>
                      <Button variant="secondary" onClick={handleGuestSearch}>Search</Button>
                      <Button onClick={() => setShowNewGuest(true)}>New Guest</Button>
                    </div>
                    <div className="mt-3 divide-y divide-slate-100">
                      {guestResults.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setGuest({ id: g.id, name: g.full_name })}
                          className="flex w-full items-center justify-between py-2.5 text-left hover:bg-slate-50"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">{g.full_name}</p>
                            <p className="text-xs text-slate-400">{g.email ?? g.mobile_number ?? 'No contact info'}</p>
                          </div>
                          <span className="text-xs text-slate-400">{g.booking_count} booking(s)</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {guest && rooms.map((room, idx) => (
                <div key={room.key} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-800">Room {idx + 1} &middot; {room.acc.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {room.adults.length} adult(s){room.children.length > 0 ? `, ${room.children.length} child(ren)` : ''} &middot; leave a name blank to use {primaryName || 'the primary guest'}
                  </p>
                  <div className="mt-3 space-y-2">
                    {room.adults.map((a, i) => (
                      <Input
                        key={`a${i}`}
                        placeholder={`Adult ${i + 1} (${primaryName || 'primary guest'})`}
                        value={a.full_name}
                        onChange={(e) => setAdultName(room.key, i, e.target.value)}
                      />
                    ))}
                    {room.children.map((c, i) => (
                      <Input
                        key={`c${i}`}
                        placeholder={`Child ${i + 1}, age ${c.age} (${primaryName || 'primary guest'})`}
                        value={c.full_name}
                        onChange={(e) => setChildName(room.key, i, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={!guest}>Continue</Button>
              </div>
            </div>
          )}

          {/* STEP 3 — CONFIRM */}
          {step === 3 && guest && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Booking Source</label>
                    <Select value={source} onChange={(e) => setSource(e.target.value)} options={BOOKING_SOURCES} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-slate-600">Notes</label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional booking notes..." />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => handleConfirm('pending')} loading={saving} disabled={!allPriced}>Save as Pending</Button>
                  <Button onClick={() => handleConfirm('confirmed')} loading={saving} disabled={!allPriced}>Confirm Booking</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right-side summary (shown once rooms are added) */}
        {showSummary && (
          <div className="lg:col-span-1">
            <div className="sticky top-28 rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-800">Booking Summary</h3>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Dates</span><span className="font-medium text-slate-800">{fmtDateShort(checkIn)} &rarr; {fmtDateShort(checkOut)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Nights</span><span className="font-medium text-slate-800">{nights}</span></div>
                {primaryName && <div className="flex justify-between"><span className="text-slate-500">Guest</span><span className="font-medium text-slate-800">{primaryName}</span></div>}
              </div>

              <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                {rooms.map((room, idx) => (
                  <div key={room.key} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-800">Room {idx + 1} &middot; {room.acc.name}</p>
                        <p className="text-xs text-slate-400">
                          {room.adults.length} adult(s){room.children.length > 0 ? `, ${room.children.length} child(ren)` : ''}
                          {room.ratePlanId && room.quote?.rate_plan_name ? ` · ${room.quote.rate_plan_name}` : ''}
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-medium text-slate-800">
                        {room.quoting ? '...' : room.quote ? `₱${money(room.quote.total_amount)}` : '--'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {(taxLines.length > 0 || rooms.length > 0) && (
                <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-800">&#8369;{money(String(grandTotal))}</span>
                  </div>
                  {taxLines.map((t, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <span className="text-slate-500">
                        {t.name}
                        {t.tax_type === 'percentage' ? ` (${parseFloat(t.rate)}%)` : ''}
                        {t.is_included ? <span className="text-slate-400"> · incl.</span> : ''}
                      </span>
                      <span className={t.is_included ? 'text-slate-400' : 'font-medium text-slate-800'}>
                        &#8369;{money(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
                <span>Total</span>
                <span>&#8369;{money(String(finalTotal))}</span>
              </div>
              {!allPriced && rooms.length > 0 && (
                <p className="mt-2 text-xs text-amber-600">Resolve room pricing before continuing.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
