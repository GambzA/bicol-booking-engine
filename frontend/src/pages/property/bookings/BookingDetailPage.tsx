import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { bookingsApi, type BookingDetail, type BookingRoom } from '../../../api/property/bookings'
import { paymentMethodsApi, type PaymentMethod } from '../../../api/property/paymentMethods'
import { billableItemsApi, type BillableItem } from '../../../api/property/billableItems'
import {
  BOOKING_STATUSES, BOOKING_SOURCES, PAYMENT_METHODS, ACCOMMODATION_TYPES,
  PAYMENT_RECORD_STATUSES, TRANSACTION_TYPE_LABELS,
  BILLABLE_ITEM_CATEGORIES, QUANTITY_INPUT_PRICING_TYPES,
} from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Select } from '../../../components/common/Select'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'
import { BookingStatusBadge, PaymentStatusBadge, PaymentRecordBadge } from '../../../components/property/BookingBadges'

const ASSIGNABLE = BOOKING_STATUSES.map((s) => ({ value: s.value, label: s.label }))
const SOURCE_LABELS: Record<string, string> = Object.fromEntries(BOOKING_SOURCES.map((s) => [s.value, s.label]))
const TYPE_LABELS: Record<string, string> = Object.fromEntries(ACCOMMODATION_TYPES.map((t) => [t.value, t.label]))
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(BILLABLE_ITEM_CATEGORIES.map((c) => [c.value, c.label]))

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function money(s: string): string {
  return parseFloat(s).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

function RoomCard({ room, index }: { room: BookingRoom; index: number }) {
  const adults = room.guests.filter((g) => g.occupant_type === 'adult')
  const children = room.guests.filter((g) => g.occupant_type === 'child')
  return (
    <Card title={`Room ${index + 1} · ${room.accommodation_name} (${TYPE_LABELS[room.accommodation_type ?? ''] ?? room.accommodation_type})`}>
      <div className="grid grid-cols-2 gap-x-8">
        <Row label="Occupancy" value={`${room.num_adults} adult(s), ${room.num_children} child(ren)`} />
        {room.rate_plan_name && <Row label="Rate Plan" value={room.rate_plan_name} />}
        {room.promotion_name && <Row label="Promotion" value={room.promotion_name} />}
        {room.package_name && <Row label="Package" value={room.package_name} />}
      </div>

      {/* Occupant manifest */}
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Guests</p>
        <p className="mt-1 text-slate-700">
          <span className="text-slate-500">Adults: </span>
          {adults.map((g) => g.name).filter(Boolean).join(', ') || '--'}
        </p>
        {children.length > 0 && (
          <p className="mt-0.5 text-slate-700">
            <span className="text-slate-500">Children: </span>
            {children.map((g) => `${g.name ?? '--'}${g.age != null ? ` (${g.age})` : ''}`).join(', ')}
          </p>
        )}
      </div>

      {/* Nightly breakdown */}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-400">
              <th className="py-2 text-left font-semibold">Date</th>
              <th className="py-2 text-right font-semibold">Room</th>
              <th className="py-2 text-right font-semibold">Extra Adult</th>
              <th className="py-2 text-right font-semibold">Children</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {room.nightly_rates.map((n) => (
              <tr key={n.date}>
                <td className="py-2 text-slate-700">{fmtDate(n.date)}</td>
                <td className="py-2 text-right text-slate-600">&#8369;{money(n.room_rate)}</td>
                <td className="py-2 text-right text-slate-600">&#8369;{money(n.additional_adult_amount)}</td>
                <td className="py-2 text-right text-slate-600">&#8369;{money(n.children_amount)}</td>
                <td className="py-2 text-right font-medium text-slate-800">&#8369;{money(n.night_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {parseFloat(room.discount_amount) > 0 && <Row label="Discount" value={`- ₱${money(room.discount_amount)}`} />}
        {parseFloat(room.package_amount) > 0 && <Row label={`Package${room.package_name ? ` (${room.package_name})` : ''}`} value={`₱${money(room.package_amount)}`} />}
        <div className="mt-1 flex justify-between text-sm font-bold text-slate-900">
          <span>Room total</span>
          <span>&#8369;{money(room.total_amount)}</span>
        </div>
      </div>
    </Card>
  )
}

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [newStatus, setNewStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('')
  const [payRef, setPayRef] = useState('')
  const [savingPay, setSavingPay] = useState(false)
  const [methods, setMethods] = useState<PaymentMethod[]>([])

  useEffect(() => {
    if (!id) return
    bookingsApi.get(id)
      .then((r) => { setBooking(r.data); setNewStatus(r.data.status) })
      .catch(() => { toast.error('Failed to load booking.'); navigate('/bookings') })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    paymentMethodsApi.list({ active: true })
      .then((r) => setMethods(r.data.items))
      .catch(() => {})
  }, [])

  const [itemOpen, setItemOpen] = useState(false)
  const [eligibleItems, setEligibleItems] = useState<BillableItem[]>([])
  const [addItemId, setAddItemId] = useState('')
  const [addItemQty, setAddItemQty] = useState('1')
  const [savingItem, setSavingItem] = useState(false)

  useEffect(() => {
    if (!booking || booking.rooms.length === 0) return
    billableItemsApi
      .listEligible({
        accommodation_ids: [...new Set(booking.rooms.map((r) => r.accommodation_id))],
        rate_plan_ids: [...new Set(booking.rooms.map((r) => r.rate_plan_id).filter((x): x is string => !!x))],
        stage: 'all',
      })
      .then((r) => setEligibleItems(r.data.items))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id])

  const handleStatusUpdate = async () => {
    if (!id || !booking || newStatus === booking.status) return
    setSavingStatus(true)
    try {
      const r = await bookingsApi.updateStatus(id, { status: newStatus, note: statusNote || null })
      setBooking(r.data)
      setStatusNote('')
      toast.success('Status updated.')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to update status.')
      setNewStatus(booking.status)
    }
    setSavingStatus(false)
  }

  const handleRecordPayment = async () => {
    if (!id) return
    const val = parseFloat(payAmount)
    if (isNaN(val) || val <= 0) { toast.error('Enter a valid payment amount.'); return }
    setSavingPay(true)
    const isConfigured = methods.some((m) => m.id === payMethod)
    try {
      const r = await bookingsApi.recordPayment(id, {
        amount: String(val),
        payment_method_id: isConfigured ? payMethod : null,
        method: isConfigured ? null : (payMethod || null),
        reference_number: payRef || null,
      })
      setBooking(r.data)
      setPayOpen(false); setPayAmount(''); setPayRef('')
      toast.success('Payment recorded.')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to record payment.')
    }
    setSavingPay(false)
  }

  const handleAddItem = async () => {
    if (!id || !addItemId) return
    const item = eligibleItems.find((i) => i.id === addItemId)
    const qty = parseInt(addItemQty, 10)
    setSavingItem(true)
    try {
      const r = await bookingsApi.addBillableItem(id, {
        billable_item_id: addItemId,
        quantity: item && QUANTITY_INPUT_PRICING_TYPES.includes(item.pricing_type) ? (isNaN(qty) ? 1 : qty) : null,
      })
      setBooking(r.data)
      setItemOpen(false); setAddItemId(''); setAddItemQty('1')
      toast.success('Item added.')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to add item.')
    }
    setSavingItem(false)
  }

  if (loading) return <PageLoader />
  if (!booking) return null

  const ps = booking.payment_summary

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bookings')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-900">{booking.booking_number}</h1>
              <BookingStatusBadge status={booking.status} />
              <PaymentStatusBadge status={ps.payment_status} />
            </div>
            <p className="text-sm text-slate-500">
              {booking.guest_name} &middot; {booking.rooms_count} {booking.rooms_count === 1 ? 'room' : 'rooms'}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <Card title="Stay Details">
              <div className="grid grid-cols-2 gap-x-8">
                <Row label="Check-in" value={fmtDate(booking.check_in_date)} />
                <Row label="Check-out" value={fmtDate(booking.check_out_date)} />
                <Row label="Nights" value={booking.nights} />
                <Row label="Total Guests" value={booking.num_guests} />
                <Row label="Rooms" value={booking.rooms_count} />
                <Row label="Source" value={booking.booking_source ? (SOURCE_LABELS[booking.booking_source] ?? booking.booking_source) : '--'} />
              </div>
              {booking.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{booking.notes}</p>}
            </Card>

            {booking.rooms.map((room, i) => (
              <RoomCard key={room.id} room={room} index={i} />
            ))}

            <Card
              title="Billable Items"
              action={
                <button onClick={() => setItemOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                  <Plus size={14} /> Add
                </button>
              }
            >
              {booking.billable_items.length === 0 ? (
                <p className="text-sm text-slate-400">No billable items added yet.</p>
              ) : (
                <div className="space-y-1">
                  {booking.billable_items.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                      <div>
                        <span className="text-slate-700">{line.name}</span>
                        <span className="ml-2 text-xs text-slate-400">
                          {CATEGORY_LABELS[line.category] ?? line.category}
                          {QUANTITY_INPUT_PRICING_TYPES.includes(line.pricing_type) ? ` · ×${line.quantity}` : ''}
                          {!line.is_taxable ? ' · non-taxable' : ''}
                        </span>
                      </div>
                      <span className="whitespace-nowrap font-medium text-slate-800">₱{money(line.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-900">
                    <span>Total</span>
                    <span>₱{money(booking.billable_items_amount)}</span>
                  </div>
                </div>
              )}

              {itemOpen && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <Select
                    options={[
                      { value: '', label: eligibleItems.length ? 'Select an item...' : 'No eligible items' },
                      ...eligibleItems.map((i) => ({ value: i.id, label: i.name })),
                    ]}
                    value={addItemId}
                    onChange={(e) => setAddItemId(e.target.value)}
                  />
                  {(() => {
                    const sel = eligibleItems.find((i) => i.id === addItemId)
                    return sel && QUANTITY_INPUT_PRICING_TYPES.includes(sel.pricing_type) ? (
                      <Input type="number" min="1" step="1" placeholder="Quantity" value={addItemQty} onChange={(e) => setAddItemQty(e.target.value)} />
                    ) : null
                  })()}
                  <Button className="w-full" onClick={handleAddItem} loading={savingItem} disabled={!addItemId}>Add Item</Button>
                </div>
              )}
            </Card>

            <Card title="Charges">
              <Row label="Base (rooms)" value={`₱${money(booking.base_amount)}`} />
              {parseFloat(booking.additional_adult_amount) > 0 && <Row label="Additional adult charges" value={`₱${money(booking.additional_adult_amount)}`} />}
              {parseFloat(booking.children_amount) > 0 && <Row label="Child charges" value={`₱${money(booking.children_amount)}`} />}
              <Row label="Subtotal" value={`₱${money(booking.subtotal_amount)}`} />
              {parseFloat(booking.discount_amount) > 0 && <Row label="Discount" value={`- ₱${money(booking.discount_amount)}`} />}
              {parseFloat(booking.package_amount) > 0 && <Row label="Packages" value={`₱${money(booking.package_amount)}`} />}
              {parseFloat(booking.billable_items_amount) > 0 && <Row label="Billable items" value={`₱${money(booking.billable_items_amount)}`} />}
              {booking.taxes.length > 0 && (
                <>
                  <Row label="Net subtotal" value={`₱${money(booking.net_amount)}`} />
                  {booking.taxes.map((t) => (
                    <Row
                      key={t.id}
                      label={`${t.name}${t.tax_type === 'percentage' ? ` (${parseFloat(t.rate)}%)` : ''}${t.is_included ? ' · included' : ''}`}
                      value={t.is_included ? `(₱${money(t.amount)})` : `₱${money(t.amount)}`}
                    />
                  ))}
                </>
              )}
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <span>Total</span>
                <span>&#8369;{money(booking.total_amount)}</span>
              </div>
            </Card>

            <Card title="Timeline">
              <ol className="space-y-3">
                {booking.timeline.map((t) => (
                  <li key={t.id} className="flex gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-slate-300" />
                    <div>
                      <p className="text-slate-700">
                        {t.from_status ? `${t.from_status} → ` : ''}<span className="font-medium">{t.to_status}</span>
                      </p>
                      {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                      <p className="text-xs text-slate-400">{fmtDateTime(t.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <Card title="Guest">
              <p className="text-sm font-medium text-slate-800">{booking.guest_name}</p>
              {booking.guest_email && <p className="text-sm text-slate-500">{booking.guest_email}</p>}
              {booking.guest_mobile && <p className="text-sm text-slate-500">{booking.guest_mobile}</p>}
              <button onClick={() => navigate(`/guests/${booking.guest_id}`)} className="mt-2 text-xs font-medium text-slate-600 hover:underline">
                View guest profile
              </button>
            </Card>

            <Card title="Manage Status">
              <Select options={ASSIGNABLE} value={newStatus} onChange={(e) => setNewStatus(e.target.value)} />
              <Input className="mt-2" placeholder="Note (optional)" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
              <Button
                className="mt-3 w-full"
                onClick={handleStatusUpdate}
                loading={savingStatus}
                disabled={newStatus === booking.status}
              >
                Update Status
              </Button>
            </Card>

            <Card
              title="Payment Summary"
              action={
                <button onClick={() => setPayOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                  <Plus size={14} /> Record
                </button>
              }
            >
              {booking.payment_method_name && <Row label="Method" value={booking.payment_method_name} />}
              {booking.deposit_required && <Row label="Deposit Required" value={`₱${money(booking.deposit_amount)}`} />}
              <Row label="Booking Total" value={`₱${money(ps.booking_total)}`} />
              <Row label="Total Paid" value={`₱${money(ps.total_paid)}`} />
              <Row label="Outstanding" value={`₱${money(ps.outstanding_balance)}`} />
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm">
                <span className="text-slate-500">Status</span>
                <PaymentStatusBadge status={ps.payment_status} />
              </div>

              {payOpen && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <Input type="number" min="0.01" step="0.01" placeholder="Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  <Select
                    options={
                      methods.length > 0
                        ? [{ value: '', label: 'Select a method...' }, ...methods.map((m) => ({ value: m.id, label: m.name }))]
                        : PAYMENT_METHODS
                    }
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  />
                  <Input placeholder="Reference # (optional)" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                  <Button className="w-full" onClick={handleRecordPayment} loading={savingPay}>Record Payment</Button>
                </div>
              )}

              {booking.payments.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment Records</p>
                  <div className="space-y-2">
                    {booking.payments.map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-100 p-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">
                            {new Date(p.payment_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            {' · '}{p.payment_method_name ?? p.method ?? '--'}
                          </span>
                          <span className="font-medium text-slate-800">&#8369;{money(p.amount)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <PaymentRecordBadge status={p.status} />
                          {p.reference_number && <span className="text-xs text-slate-400">Ref: {p.reference_number}</span>}
                        </div>
                        {p.transactions.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                            {p.transactions.map((t) => (
                              <div key={t.id} className="flex items-center justify-between text-xs text-slate-400">
                                <span>{TRANSACTION_TYPE_LABELS[t.transaction_type] ?? t.transaction_type}</span>
                                <span>{new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
