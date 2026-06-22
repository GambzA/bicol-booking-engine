import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
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
import { Pagination } from '../../components/common/Pagination'
import { useToast } from '../../components/common/useToast'
import type { SubscriptionPlan } from '../../types/admin'

const PAGE_SIZE = 10

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
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null)
  const [toggleTarget, setToggleTarget] = useState<SubscriptionPlan | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return plans
    return plans.filter((p) => p.name.toLowerCase().includes(q))
  }, [plans, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

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

  const handleToggle = async () => {
    if (!toggleTarget) return
    setActionLoading(true)
    try {
      await plansApi.toggle(toggleTarget.id)
      toast.success(`Plan ${toggleTarget.is_active ? 'disabled' : 'enabled'}.`)
      setToggleTarget(null)
      fetchPlans()
    } catch {
      toast.error('Failed to update plan.')
    }
    setActionLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(true)
    try {
      await plansApi.softDelete(deleteTarget.id)
      toast.success('Plan deleted.')
      setDeleteTarget(null)
      fetchPlans()
    } catch {
      toast.error('Failed to delete plan.')
    }
    setActionLoading(false)
  }

  const columns: Column<SubscriptionPlan>[] = [
    { key: 'name', label: 'Plan' },
    { key: 'monthly_fee', label: 'Monthly', render: (p) => `₱${p.monthly_fee}` },
    { key: 'annual_fee', label: 'Annual', render: (p) => `₱${p.annual_fee}` },
    { key: 'commission_percentage', label: 'Commission', render: (p) => `${p.commission_percentage}%` },
    { key: 'trial_period_days', label: 'Trial', render: (p) => p.trial_period_days > 0 ? `${p.trial_period_days}d` : 'None' },
    {
      key: 'is_active',
      label: 'Status',
      render: (p) => <Badge label={p.is_active ? 'Active' : 'Inactive'} variant={p.is_active ? 'success' : 'default'} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-36',
      render: (p) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
          <button
            type="button"
            title={p.is_active ? 'Disable plan' : 'Enable plan'}
            onClick={() => setToggleTarget(p)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            {p.is_active
              ? <ToggleRight size={26} className="text-green-500" />
              : <ToggleLeft size={26} className="text-slate-400" />
            }
          </button>
          <button
            type="button"
            title="Delete plan"
            onClick={() => setDeleteTarget(p)}
            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'plan' : 'plans'}
            {search && ` matching "${search}"`}
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> New Plan</Button>
      </div>

      {/* Search */}
      <div className="mt-4 relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search plans..."
          className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table
          columns={columns}
          data={pageSlice}
          loading={loading}
          keyExtractor={(p) => p.id}
          emptyTitle="No plans found"
          emptyDescription={search ? 'Try a different search term.' : 'Create your first subscription plan.'}
        />
        <Pagination
          page={safePage}
          pages={totalPages}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </div>

      {/* Create / Edit modal */}
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
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Disable Plan' : 'Enable Plan'}
        message={
          toggleTarget?.is_active
            ? `Disable "${toggleTarget.name}"? Existing subscriptions are unaffected but no new subscriptions can use this plan.`
            : `Enable "${toggleTarget?.name}"? The plan will be available for new subscriptions.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Disable' : 'Enable'}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Plan"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone. Existing subscriptions on this plan are unaffected.`}
        confirmLabel="Delete"
        loading={actionLoading}
      />
    </div>
  )
}
