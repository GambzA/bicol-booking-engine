import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { plansApi } from '../../api/admin/plans'
import { subscriptionsApi } from '../../api/admin/subscriptions'
import { Modal } from '../../components/common/Modal'
import { Button } from '../../components/common/Button'
import { useToast } from '../../components/common/useToast'
import type { SubscriptionPlan, PropertySubscriptionSummary } from '../../types/admin'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  hotelId: string
  hotelName: string
  current: PropertySubscriptionSummary | null
}

type Cycle = 'monthly' | 'annual'

export function AssignSubscriptionModal({ open, onClose, onSaved, hotelId, hotelName, current }: Props) {
  const toast = useToast()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const [startDate, setStartDate] = useState(today())
  const [submitting, setSubmitting] = useState(false)

  const isChanging = !!current && current.status !== 'cancelled'

  useEffect(() => {
    if (!open) return
    setLoadingPlans(true)
    plansApi.list({ include_inactive: false })
      .then((r) => setPlans(r.data.items))
      .catch(() => toast.error('Failed to load plans.'))
      .finally(() => setLoadingPlans(false))
    // pre-select current plan if changing
    if (current?.plan) {
      setSelectedPlanId(current.plan.id)
      setCycle((current.billing_cycle as Cycle) ?? 'monthly')
    } else {
      setSelectedPlanId('')
      setCycle('monthly')
    }
    setStartDate(today())
  }, [open])

  async function handleSubmit() {
    if (!selectedPlanId) { toast.error('Select a plan first.'); return }
    setSubmitting(true)
    try {
      if (isChanging) {
        await subscriptionsApi.update(hotelId, { plan_id: selectedPlanId, billing_cycle: cycle })
      } else {
        await subscriptionsApi.assign(hotelId, { plan_id: selectedPlanId, billing_cycle: cycle, start_date: startDate })
      }
      toast.success(isChanging ? 'Subscription updated.' : 'Subscription assigned.')
      onSaved()
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to save subscription.'
      toast.error(msg)
    }
    setSubmitting(false)
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  const annualSavings = (plan: SubscriptionPlan) => {
    const monthly = parseFloat(plan.monthly_fee)
    const annual = parseFloat(plan.annual_fee)
    if (!monthly || !annual) return null
    const saving = (monthly * 12 - annual) / (monthly * 12) * 100
    return saving > 0 ? Math.round(saving) : null
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isChanging ? 'Change Subscription Plan' : 'Assign Subscription Plan'}
      size="lg"
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          {isChanging
            ? `Update the subscription plan for ${hotelName}.`
            : `Choose a plan for ${hotelName}. The property will be billed starting from the chosen start date.`}
        </p>

        {/* Billing cycle toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {(['monthly', 'annual'] as Cycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                cycle === c
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {c === 'monthly' ? 'Monthly' : 'Annual'}
              {c === 'annual' && plans.some((p) => annualSavings(p) !== null) && (
                <span className="ml-1.5 text-xs text-green-600 font-semibold">Save up to {Math.max(...plans.map(p => annualSavings(p) ?? 0))}%</span>
              )}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        {loadingPlans ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {plans.map((plan) => {
              const price = cycle === 'monthly' ? plan.monthly_fee : plan.annual_fee
              const saving = cycle === 'annual' ? annualSavings(plan) : null
              const isSelected = plan.id === selectedPlanId

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{plan.name}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        ₱{parseFloat(price).toLocaleString()}
                        <span className="text-sm font-normal text-slate-500">
                          /{cycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </p>
                      {saving && (
                        <span className="text-xs text-green-600 font-medium">Save {saving}% vs monthly</span>
                      )}
                    </div>
                    {isSelected && <CheckCircle2 size={18} className="text-slate-900 flex-none mt-0.5" />}
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p>{plan.commission_percentage}% commission on booking revenue</p>
                    {plan.trial_period_days > 0 && (
                      <p>{plan.trial_period_days}-day free trial</p>
                    )}
                    {plan.max_users && <p>Up to {plan.max_users} users</p>}
                    {plan.features?.length > 0 && plan.features.map((f, i) => (
                      <p key={i} className="flex items-center gap-1">
                        <CheckCircle2 size={10} className="text-green-500 flex-none" />
                        {f}
                      </p>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Start date (only for new assignment) */}
        {!isChanging && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            {selectedPlan && selectedPlan.trial_period_days > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                Trial ends {addDays(startDate, selectedPlan.trial_period_days)}.
                First billing on {addDays(startDate, selectedPlan.trial_period_days)}.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selectedPlanId || submitting} loading={submitting}>
            {isChanging ? 'Update Plan' : 'Assign Plan'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
