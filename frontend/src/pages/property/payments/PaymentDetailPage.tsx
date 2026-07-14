import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { paymentsApi, type PaymentDetail } from '../../../api/property/payments'
import { TRANSACTION_TYPE_LABELS } from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'
import { PaymentRecordBadge } from '../../../components/property/BookingBadges'

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

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [refunding, setRefunding] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundNotes, setRefundNotes] = useState('')
  const [savingRefund, setSavingRefund] = useState(false)

  const load = () => {
    if (!id) return
    paymentsApi.get(id)
      .then((r) => setPayment(r.data))
      .catch(() => { toast.error('Failed to load payment.'); navigate('/payments') })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleRefund = async () => {
    if (!id) return
    setSavingRefund(true)
    try {
      await paymentsApi.refund(id, { amount: refundAmount || null, notes: refundNotes || null })
      setRefunding(false); setRefundAmount(''); setRefundNotes('')
      toast.success('Refund recorded.')
      load()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to record refund.')
    }
    setSavingRefund(false)
  }

  if (loading) return <PageLoader />
  if (!payment) return null

  const isRefund = parseFloat(payment.amount) < 0
  const canRefund = !isRefund && payment.status === 'paid' && parseFloat(payment.refundable_remaining) > 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/payments')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-900">{payment.payment_number}</h1>
              <PaymentRecordBadge status={payment.status} />
            </div>
            <p className="text-sm text-slate-500">Recorded {fmtDate(payment.created_at)}</p>
          </div>
          <span className={`text-xl font-bold ${isRefund ? 'text-red-600' : 'text-slate-900'}`}>
            &#8369;{money(payment.amount)}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-8 py-6">
        <Card title="Payment Details">
          <Row label="Amount" value={`₱${money(payment.amount)}`} />
          <Row label="Payment Method" value={payment.payment_method_name ?? '--'} />
          <Row label="Payment Date" value={fmtDate(payment.payment_date)} />
          {payment.reference_number && <Row label="Reference #" value={payment.reference_number} />}
          <Row label="Recorded By" value={payment.recorded_by_name ?? '--'} />
          {payment.notes && <Row label="Notes" value={payment.notes} />}
        </Card>

        {payment.booking && (
          <Card
            title="Related Booking"
            action={
              <button
                onClick={() => navigate(`/bookings/${payment.booking!.id}`)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View Booking
              </button>
            }
          >
            <Row label="Booking #" value={payment.booking.booking_number} />
            <Row label="Guest" value={payment.booking.guest_name ?? '--'} />
            <Row label="Booking Total" value={`₱${money(payment.booking.total_amount)}`} />
          </Card>
        )}

        {payment.refunded_payment && (
          <Card title="Refund Of">
            <button
              onClick={() => navigate(`/payments/${payment.refunded_payment!.id}`)}
              className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
            >
              {payment.refunded_payment.payment_number} &mdash; &#8369;{money(payment.refunded_payment.amount)}
            </button>
          </Card>
        )}

        {payment.refunds.length > 0 && (
          <Card title="Refunds Issued">
            <div className="space-y-2">
              {payment.refunds.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/payments/${r.id}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-2.5 text-left hover:bg-slate-50"
                >
                  <span className="text-sm text-slate-600">{r.payment_number} &middot; {fmtDate(r.payment_date)}</span>
                  <span className="text-sm font-medium text-red-600">&#8369;{money(r.amount)}</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {canRefund && (
          <Card title="Refund">
            {refunding ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Remaining refundable: &#8369;{money(payment.refundable_remaining)}</p>
                <Input
                  type="number" min="0.01" step="0.01"
                  placeholder="Amount (blank = full remaining)"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
                <Input placeholder="Notes (optional)" value={refundNotes} onChange={(e) => setRefundNotes(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => { setRefunding(false); setRefundAmount(''); setRefundNotes('') }}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleRefund} loading={savingRefund}>Confirm Refund</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setRefunding(true)}>Refund this payment</Button>
            )}
          </Card>
        )}

        <Card title="Transactions">
          <div className="space-y-2">
            {payment.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 text-sm">
                <span className="text-slate-700">{TRANSACTION_TYPE_LABELS[t.transaction_type] ?? t.transaction_type}</span>
                <span className="text-slate-500">₱{money(t.amount)}</span>
                <span className="text-xs text-slate-400">{fmtDateTime(t.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
