import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { commissionsApi } from '../../api/admin/commissions'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { CommissionStatusBadge } from '../../components/admin/StatusBadge'
import { PageLoader } from '../../components/common/PageLoader'
import { useToast } from '../../components/common/useToast'
import type { CommissionStatement } from '../../types/admin'

const adjustmentSchema = z.object({
  amount: z.coerce.number().positive('Must be > 0'),
  reason: z.string().min(1, 'Required'),
})

type AdjustmentForm = z.infer<typeof adjustmentSchema>

export function CommissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [statement, setStatement] = useState<CommissionStatement | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdjModal, setShowAdjModal] = useState(false)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema),
  })

  const fetchStatement = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await commissionsApi.get(id)
      setStatement(r.data)
    } catch {
      toast.error('Failed to load commission statement.')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchStatement() }, [fetchStatement])

  const handleAddAdjustment = async (values: AdjustmentForm) => {
    if (!id) return
    try {
      await commissionsApi.addAdjustment(id, { amount: values.amount, reason: values.reason })
      toast.success('Adjustment added.')
      reset()
      setShowAdjModal(false)
      fetchStatement()
    } catch {
      toast.error('Failed to add adjustment.')
    }
  }

  const handleFinalize = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await commissionsApi.finalize(id)
      toast.success('Statement finalized.')
      await fetchStatement()
    } catch {
      toast.error('Failed to finalize statement.')
    }
    setActionLoading(false)
    setConfirmFinalize(false)
  }

  if (loading) return <PageLoader />
  if (!statement) return null

  return (
    <div className="p-8">
      <button onClick={() => navigate('/admin/commissions')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to Commissions
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{statement.period_start} - {statement.period_end}</h1>
            <CommissionStatusBadge status={statement.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{statement.period_type}</p>
        </div>
        {statement.status === 'draft' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAdjModal(true)}><Plus size={14} /> Adjustment</Button>
            <Button size="sm" onClick={() => setConfirmFinalize(true)}>Finalize</Button>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Revenue Summary</h2>
          <dl className="mt-4 space-y-3">
            <Row label="Total revenue" value={`₱${statement.total_booking_revenue}`} />
            <Row label="Eligible revenue" value={`₱${statement.eligible_booking_revenue}`} />
            <Row label="Commission %" value={`${statement.commission_percentage}%`} />
            <div className="border-t border-slate-100 pt-3">
              <Row label="Commission due" value={<span className="font-semibold text-slate-900">₱{statement.total_commission_due}</span>} />
              {statement.net_commission_due && (
                <Row label="Net (after adj.)" value={<span className="font-semibold text-slate-700">₱{statement.net_commission_due}</span>} />
              )}
            </div>
          </dl>
        </div>

        {statement.adjustments.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-700">Adjustments</h2>
            <table className="mt-4 min-w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Reason</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {statement.adjustments.map((adj) => (
                  <tr key={adj.id}>
                    <td className="py-2 text-sm text-slate-600">{adj.reason}</td>
                    <td className="py-2 text-right text-sm font-medium text-slate-700">₱{adj.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAdjModal} onClose={() => setShowAdjModal(false)} title="Add Adjustment">
        <form onSubmit={handleSubmit(handleAddAdjustment)} className="flex flex-col gap-4">
          <Input label="Amount (₱)" type="number" step="0.01" {...register('amount')} error={errors.amount?.message} />
          <Input label="Reason" {...register('reason')} error={errors.reason?.message} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowAdjModal(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Add Adjustment</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        onConfirm={handleFinalize}
        title="Finalize Statement"
        message="Once finalized, adjustments cannot be added. A linked invoice will be updated."
        confirmLabel="Finalize"
        loading={actionLoading}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-36 flex-shrink-0 text-xs font-medium text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  )
}
