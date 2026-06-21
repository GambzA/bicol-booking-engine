import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { plansApi } from '../../api/admin/plans'
import { Table, type Column } from '../../components/common/Table'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Modal } from '../../components/common/Modal'
import { Badge } from '../../components/common/Badge'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/useToast'
import type { SubscriptionPlan } from '../../types/admin'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  monthly_fee: z.coerce.number().min(0, 'Must be >= 0'),
  annual_fee: z.coerce.number().min(0, 'Must be >= 0'),
  commission_percentage: z.coerce.number().min(0).max(100),
  trial_period_days: z.coerce.number().min(0).default(0),
  max_users: z.coerce.number().optional(),
  max_properties: z.coerce.number().optional(),
})

type FormValues = z.infer<typeof schema>

export function PlansPage() {
  const toast = useToast()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null)
  const [disableTarget, setDisableTarget] = useState<SubscriptionPlan | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const r = await plansApi.list({ include_inactive: true })
      setPlans(r.data.items)
    } catch {
      toast.error('Failed to load plans.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const openCreate = () => { setEditPlan(null); reset(); setShowModal(true) }
  const openEdit = (plan: SubscriptionPlan) => {
    setEditPlan(plan)
    setValue('name', plan.name)
    setValue('monthly_fee', Number(plan.monthly_fee))
    setValue('annual_fee', Number(plan.annual_fee))
    setValue('commission_percentage', Number(plan.commission_percentage))
    setValue('trial_period_days', plan.trial_period_days)
    if (plan.max_users) setValue('max_users', plan.max_users)
    if (plan.max_properties) setValue('max_properties', plan.max_properties)
    setShowModal(true)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (editPlan) {
        await plansApi.update(editPlan.id, values)
        toast.success('Plan updated.')
      } else {
        await plansApi.create(values)
        toast.success('Plan created.')
      }
      setShowModal(false)
      fetchPlans()
    } catch {
      toast.error('Failed to save plan.')
    }
  }

  const handleDisable = async () => {
    if (!disableTarget) return
    try {
      await plansApi.disable(disableTarget.id)
      toast.success('Plan disabled.')
      setDisableTarget(null)
      fetchPlans()
    } catch {
      toast.error('Failed to disable plan.')
    }
  }

  const columns: Column<SubscriptionPlan>[] = [
    { key: 'name', label: 'Plan' },
    { key: 'monthly_fee', label: 'Monthly', render: (p) => `₱${p.monthly_fee}` },
    { key: 'annual_fee', label: 'Annual', render: (p) => `₱${p.annual_fee}` },
    { key: 'commission_percentage', label: 'Commission', render: (p) => `${p.commission_percentage}%` },
    { key: 'trial_period_days', label: 'Trial', render: (p) => p.trial_period_days > 0 ? `${p.trial_period_days}d` : 'None' },
    { key: 'is_active', label: 'Status', render: (p) => <Badge label={p.is_active ? 'Active' : 'Inactive'} variant={p.is_active ? 'success' : 'default'} /> },
    { key: 'actions', label: '', render: (p) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
        {p.is_active && <Button variant="ghost" size="sm" onClick={() => setDisableTarget(p)}>Disable</Button>}
      </div>
    )},
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-slate-500">{plans.length} {plans.length === 1 ? 'plan' : 'plans'}</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> New Plan</Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table columns={columns} data={plans} loading={loading} keyExtractor={(p) => p.id} emptyTitle="No plans yet" emptyDescription="Create your first subscription plan." />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editPlan ? 'Edit Plan' : 'New Subscription Plan'}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label="Plan name" {...register('name')} error={errors.name?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Monthly fee (₱)" type="number" step="0.01" {...register('monthly_fee')} error={errors.monthly_fee?.message} />
            <Input label="Annual fee (₱)" type="number" step="0.01" {...register('annual_fee')} error={errors.annual_fee?.message} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Commission %" type="number" step="0.01" {...register('commission_percentage')} error={errors.commission_percentage?.message} />
            <Input label="Trial period (days)" type="number" {...register('trial_period_days')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max users (blank = unlimited)" type="number" {...register('max_users')} />
            <Input label="Max properties (blank = unlimited)" type="number" {...register('max_properties')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editPlan ? 'Save changes' : 'Create plan'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        onConfirm={handleDisable}
        title="Disable Plan"
        message={`Disable "${disableTarget?.name}"? Existing subscriptions are unaffected but no new subscriptions can use this plan.`}
        confirmLabel="Disable"
      />
    </div>
  )
}
