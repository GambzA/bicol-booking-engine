import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search } from 'lucide-react'
import { accommodationsApi, type Accommodation } from '../../../api/property/accommodations'
import { ratePlansApi, type RatePlan } from '../../../api/property/ratePlans'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { SectionCard, Field, FormPage, FormHeader, FormBody } from '../../../components/common/FormLayout'
import {
  BILLABLE_ITEM_CATEGORIES, BILLABLE_ITEM_PRICING_TYPES, QUANTITY_INPUT_PRICING_TYPES,
} from '../../../constants/propertyOptions'

export interface BillableItemFormValues {
  name: string
  description: string | null
  category: string
  pricing_type: string
  unit_price: string
  is_taxable: boolean
  is_active: boolean
  display_order: number
  applies_to_all_accommodations: boolean
  applies_to_all_rate_plans: boolean
  available_at_booking: boolean
  available_at_checkin: boolean
  available_at_stay: boolean
  available_at_checkout: boolean
}

export interface BillableItemFormProps {
  mode: 'create' | 'edit'
  defaults?: Partial<BillableItemFormValues> & {
    accommodation_ids?: string[]
    rate_plan_ids?: string[]
  }
  onSubmit: (values: BillableItemFormValues, accommodationIds: string[], ratePlanIds: string[]) => Promise<void>
  saving?: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  category: z.string().min(1, 'Category is required'),
  pricing_type: z.string().min(1),
  unit_price: z.string().min(1, 'Price is required'),
  display_order: z.number().int().default(0),
})

type FormValues = z.infer<typeof schema>

const STAGE_FIELDS = [
  { key: 'available_at_booking', label: 'Booking' },
  { key: 'available_at_checkin', label: 'Check-in' },
  { key: 'available_at_stay', label: 'During Stay' },
  { key: 'available_at_checkout', label: 'Check-out' },
] as const

export function BillableItemForm({ mode, defaults, onSubmit, saving }: BillableItemFormProps) {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? '',
      description: defaults?.description ?? '',
      category: defaults?.category ?? '',
      pricing_type: defaults?.pricing_type ?? 'fixed_amount',
      unit_price: defaults?.unit_price ?? '',
      display_order: defaults?.display_order ?? 0,
    },
  })

  const pricingType = watch('pricing_type')
  const isPercentage = pricingType === 'percentage_of_booking'

  const [isTaxable, setIsTaxable] = useState(defaults?.is_taxable ?? true)
  const [isActive, setIsActive] = useState(defaults?.is_active ?? true)
  const [allAccommodations, setAllAccommodations] = useState(defaults?.applies_to_all_accommodations ?? true)
  const [allRatePlans, setAllRatePlans] = useState(defaults?.applies_to_all_rate_plans ?? true)
  const [stages, setStages] = useState({
    available_at_booking: defaults?.available_at_booking ?? true,
    available_at_checkin: defaults?.available_at_checkin ?? true,
    available_at_stay: defaults?.available_at_stay ?? true,
    available_at_checkout: defaults?.available_at_checkout ?? true,
  })

  const [selectedAccs, setSelectedAccs] = useState<Set<string>>(() => new Set(defaults?.accommodation_ids ?? []))
  const [selectedRatePlans, setSelectedRatePlans] = useState<Set<string>>(() => new Set(defaults?.rate_plan_ids ?? []))
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])
  const [loadingAccs, setLoadingAccs] = useState(true)
  const [loadingRatePlans, setLoadingRatePlans] = useState(true)
  const [accSearch, setAccSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    accommodationsApi.list({ active: true, page_size: 100 })
      .then((r) => setAccommodations(r.data.items))
      .catch(() => {})
      .finally(() => setLoadingAccs(false))
    ratePlansApi.list({ active: true, page_size: 100 })
      .then((r) => setRatePlans(r.data.items))
      .catch(() => {})
      .finally(() => setLoadingRatePlans(false))
  }, [])

  const toggleAcc = (id: string, checked: boolean) => {
    setSelectedAccs((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
    setFormError(null)
  }
  const toggleRatePlan = (id: string, checked: boolean) => {
    setSelectedRatePlans((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
    setFormError(null)
  }
  const toggleStage = (key: keyof typeof stages) => setStages((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleFormSubmit = async (values: FormValues) => {
    const priceVal = parseFloat(values.unit_price)
    if (isNaN(priceVal) || priceVal < 0) {
      setFormError('Unit price must be zero or greater.')
      return
    }
    if (!allAccommodations && selectedAccs.size === 0) {
      setFormError('Select at least one accommodation, or apply to all.')
      return
    }
    if (!allRatePlans && selectedRatePlans.size === 0) {
      setFormError('Select at least one rate plan, or apply to all.')
      return
    }
    setFormError(null)
    await onSubmit(
      {
        name: values.name,
        description: values.description || null,
        category: values.category,
        pricing_type: values.pricing_type,
        unit_price: String(priceVal),
        is_taxable: isTaxable,
        is_active: isActive,
        display_order: values.display_order,
        applies_to_all_accommodations: allAccommodations,
        applies_to_all_rate_plans: allRatePlans,
        ...stages,
      },
      allAccommodations ? [] : Array.from(selectedAccs),
      allRatePlans ? [] : Array.from(selectedRatePlans),
    )
  }

  const filteredAccommodations = accSearch.trim()
    ? accommodations.filter((a) => a.name.toLowerCase().includes(accSearch.trim().toLowerCase()))
    : accommodations

  const selectedPricing = BILLABLE_ITEM_PRICING_TYPES.find((p) => p.value === pricingType)

  return (
    <FormPage>
      <FormHeader
        onBack={() => navigate('/billable-items')}
        title={mode === 'create' ? 'New Billable Item' : 'Edit Billable Item'}
        subtitle={mode === 'create' ? 'Charge guests for an optional product, service, or fee' : 'Update billable item details'}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => navigate('/billable-items')}>Cancel</Button>
            <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
              {mode === 'create' ? 'Create Item' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <FormBody>
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</div>
          )}

          {/* 1. Basic Info */}
          <SectionCard number={1} title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name?.message} span2>
                <Input {...register('name')} placeholder="e.g. Late Checkout, Airport Transfer" />
              </Field>
              <Field label="Description" span2>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Optional description of this item..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
                />
              </Field>
              <Field label="Category" required error={errors.category?.message}>
                <select
                  {...register('category')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  <option value="">Select a category...</option>
                  {BILLABLE_ITEM_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Display Order">
                <Input type="number" min={0} step={1} {...register('display_order', { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field label="Taxable">
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setIsTaxable((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isTaxable ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isTaxable ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-slate-600">{isTaxable ? 'Included in tax base' : 'Not taxed'}</span>
                </div>
              </Field>
              <Field label="Active">
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setIsActive((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-slate-600">{isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </Field>
            </div>
          </SectionCard>

          {/* 2. Pricing */}
          <SectionCard number={2} title="Pricing">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BILLABLE_ITEM_PRICING_TYPES.map((p) => {
                const sel = pricingType === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setValue('pricing_type', p.value)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${sel ? 'text-white' : 'text-slate-900'}`}>{p.label}</p>
                    <p className={`mt-1 text-xs ${sel ? 'text-slate-300' : 'text-slate-500'}`}>{p.description}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 max-w-xs">
              <Field label={isPercentage ? 'Rate (%)' : 'Unit Price (₱)'} required error={errors.unit_price?.message}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {isPercentage ? '%' : '₱'}
                  </span>
                  <Input type="number" min="0" step="0.01" className="pl-7" {...register('unit_price')} placeholder={isPercentage ? '10' : '0.00'} />
                </div>
              </Field>
              {selectedPricing && QUANTITY_INPUT_PRICING_TYPES.includes(selectedPricing.value) && (
                <p className="mt-2 text-xs text-slate-400">Quantity is chosen when the item is added to a booking.</p>
              )}
            </div>
          </SectionCard>

          {/* 3. Accommodation eligibility */}
          <SectionCard number={3} title="Accommodation Eligibility">
            <Field label="Available for">
              <div className="mt-1 grid grid-cols-2 gap-2 max-w-sm">
                <button
                  type="button"
                  onClick={() => setAllAccommodations(true)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${allAccommodations ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                >
                  All accommodations
                </button>
                <button
                  type="button"
                  onClick={() => setAllAccommodations(false)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${!allAccommodations ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                >
                  Specific accommodations
                </button>
              </div>
            </Field>

            {!allAccommodations && (
              loadingAccs ? (
                <p className="mt-4 text-sm text-slate-400">Loading accommodations...</p>
              ) : accommodations.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No active accommodations found.</p>
              ) : (
                <div className="mt-4">
                  <div className="mb-3 relative max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={accSearch}
                      onChange={(e) => setAccSearch(e.target.value)}
                      placeholder="Search accommodations..."
                      className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <div className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {filteredAccommodations.map((acc) => {
                      const checked = selectedAccs.has(acc.id)
                      return (
                        <label key={acc.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${checked ? 'bg-slate-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleAcc(acc.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                          />
                          <span className="flex-1 text-sm font-medium text-slate-800">{acc.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </SectionCard>

          {/* 4. Rate plan eligibility */}
          <SectionCard number={4} title="Rate Plan Eligibility">
            <Field label="Available for">
              <div className="mt-1 grid grid-cols-2 gap-2 max-w-sm">
                <button
                  type="button"
                  onClick={() => setAllRatePlans(true)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${allRatePlans ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                >
                  All rate plans
                </button>
                <button
                  type="button"
                  onClick={() => setAllRatePlans(false)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${!allRatePlans ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                >
                  Specific rate plans
                </button>
              </div>
            </Field>

            {!allRatePlans && (
              loadingRatePlans ? (
                <p className="mt-4 text-sm text-slate-400">Loading rate plans...</p>
              ) : ratePlans.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No active rate plans found.</p>
              ) : (
                <div className="mt-4 flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {ratePlans.map((rp) => {
                    const checked = selectedRatePlans.has(rp.id)
                    return (
                      <label key={rp.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${checked ? 'bg-slate-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleRatePlan(rp.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span className="flex-1 text-sm font-medium text-slate-800">{rp.name}</span>
                      </label>
                    )
                  })}
                </div>
              )
            )}
          </SectionCard>

          {/* 5. Availability stages */}
          <SectionCard number={5} title="Availability Stages">
            <p className="mb-3 text-sm text-slate-500">Where in the guest journey this item can be added.</p>
            <div className="flex flex-wrap gap-3">
              {STAGE_FIELDS.map(({ key, label }) => {
                const sel = stages[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleStage(key)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <div className="flex justify-end gap-2 pb-8">
            <Button variant="secondary" type="button" onClick={() => navigate('/billable-items')}>Cancel</Button>
            <Button type="submit" loading={saving}>{mode === 'create' ? 'Create Item' : 'Save Changes'}</Button>
          </div>
        </FormBody>
      </form>
    </FormPage>
  )
}
