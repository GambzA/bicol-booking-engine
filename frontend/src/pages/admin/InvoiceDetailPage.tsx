import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { invoicesApi } from '../../api/admin/invoices'
import { Button } from '../../components/common/Button'
import { InvoiceStatusBadge } from '../../components/admin/StatusBadge'
import { PageLoader } from '../../components/common/PageLoader'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/useToast'
import type { Invoice } from '../../types/admin'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchInvoice = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await invoicesApi.get(id)
      setInvoice(r.data)
    } catch {
      toast.error('Failed to load invoice.')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchInvoice() }, [fetchInvoice])

  const handleSend = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await invoicesApi.send(id)
      toast.success('Invoice marked as sent.')
      await fetchInvoice()
    } catch {
      toast.error('Failed to send invoice.')
    }
    setActionLoading(false)
    setConfirmSend(false)
  }

  const handleVoid = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await invoicesApi.void(id, 'Voided by admin')
      toast.success('Invoice voided.')
      await fetchInvoice()
    } catch {
      toast.error('Failed to void invoice.')
    }
    setActionLoading(false)
    setConfirmVoid(false)
  }

  if (loading) return <PageLoader />
  if (!invoice) return null

  return (
    <div className="p-8">
      <button onClick={() => navigate('/admin/invoices')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to Invoices
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <Button size="sm" onClick={() => setConfirmSend(true)}>Mark as Sent</Button>
          )}
          {['draft', 'sent', 'overdue'].includes(invoice.status) && (
            <Button variant="danger" size="sm" onClick={() => setConfirmVoid(true)}>Void</Button>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Invoice Details</h2>
          <dl className="mt-4 space-y-3">
            <Row label="Type" value={<span className="capitalize">{invoice.type}</span>} />
            <Row label="Period" value={`${invoice.billing_period_start} - ${invoice.billing_period_end}`} />
            <Row label="Due date" value={invoice.due_date} />
            <Row label="Sent at" value={invoice.sent_at ? new Date(invoice.sent_at).toLocaleString() : '-'} />
            <Row label="Paid at" value={invoice.paid_at ? new Date(invoice.paid_at).toLocaleString() : '-'} />
            <Row label="Voided at" value={invoice.voided_at ? new Date(invoice.voided_at).toLocaleString() : '-'} />
            {invoice.notes && <Row label="Notes" value={invoice.notes} />}
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Amounts</h2>
          <dl className="mt-4 space-y-3">
            <Row label="Subscription" value={`₱${invoice.subscription_amount}`} />
            <Row label="Commission" value={`₱${invoice.commission_amount}`} />
            <Row label="Tax" value={`₱${invoice.tax_amount}`} />
            <div className="border-t border-slate-100 pt-3">
              <Row label="Total" value={<span className="font-semibold text-slate-900">₱{invoice.total_amount}</span>} />
            </div>
          </dl>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={handleSend}
        title="Send Invoice"
        message="Mark this invoice as sent?"
        confirmLabel="Mark as Sent"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={confirmVoid}
        onClose={() => setConfirmVoid(false)}
        onConfirm={handleVoid}
        title="Void Invoice"
        message="This invoice will be voided and cannot be paid."
        confirmLabel="Void Invoice"
        loading={actionLoading}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 flex-shrink-0 text-xs font-medium text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  )
}
