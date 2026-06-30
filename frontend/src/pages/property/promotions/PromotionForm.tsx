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
import { PROMOTION_DISCOUNT_TYPES } from '../../../constants/propertyOptions'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PromotionFormValues {
  name: string
  description: string | null
  is_active: boolean
  discount_type: string
  discount_value: string
  stay_start_date: string | null
  stay_end_date: string | null
  booking_start_date: string | null
  booking_end_date: string | null
  promo_code: string | null
  accommodation_ids: string[]
  rate_plan_ids: string[]
}

export interface PromotionFormProps {
  mode: 'create' | 'edit'
  defaults?: Partial<PromotionFormValues>
  onSubmit: (values: PromotionFormValues) => Promise<void>
  saving?: boolean
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  is_active: z.boolean().default(true),
  discount_type: z.string().min(1, 'Discount type is required'),
  discount_value: z.string().min(1, 'Discount value is required'),
  stay_start_date: z.string().optional().default(''),
  stay_end_date: z.string().optional().default(''),
  booking_start_date: z.string().optional().default(''),
  booking_end_date: z.string().optional().default(''),
  promo_code: z.string().optional().default(''),
})

type FormValues = z.infer<typeof schema>

// ─── Main form ────────────────────────────────────────────────────────────────

export function PromotionForm({ mode, defaults, onSubmit, saving }: PromotionFormProps) {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? '',
      description: defaults?.description ?? '',
      is_active: defaults?.is_active ?? true,
      discount_type: defaults?.discount_type ?? 'percentage',
      discount_value: defaults?.discount_value ?? '',
      stay_start_date: defaults?.stay_start_date ?? '',
      stay_end_date: defaults?.stay_end_date ?? '',
      booking_start_date: defaults?.booking_start_date ?? '',
      booking_end_date: defaults?.booking_end_date ?? '',
      promo_code: defaults?.promo_code ?? '',
    },
  })

  const discountType = watch('discount_type')
  const discountValue = watch('discount_value')
  const isActive = watch('is_active')
  const stayStart = watch('stay_start_date')
  const stayEnd = watch('stay_end_date')
  const bookingStart = watch('booking_start_date')
  const bookingEnd = watch('booking_end_date')

  const [selectedAccIds, setSelectedAccIds] = useState<Set<string>>(
    () => new Set(defaults?.accommodation_ids ?? [])
  )
  const [selectedRpIds, setSelectedRpIds] = useState<Set<string>>(
    () => new Set(defaults?.rate_plan_ids ?? [])
  )

  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])
  const [loadingAccs, setLoadingAccs] = useState(true)
  const [loadingRps, setLoadingRps] = useState(true)
  const [accSearch, setAccSearch] = useState('')
  const [rpSearch, setRpSearch] = useState('')
  const [accError, setAccError] = useState<string | null>(null)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    accommodationsApi
      .list({ active: true, page_size: 100 })
      .then((r) => setAccommodations(r.data.items))
      .catch(() => {})
      .finally(() => setLoadingAccs(false))

    ratePlansApi
      .list({ active: true, page_size: 100 })
      .then((r) => setRatePlans(r.data.items))
      .catch(() => {})
      .finally(() => setLoadingRps(false))
  }, [])

  const toggleAcc = (id: string) => {
    setSelectedAccIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setAccError(null)
  }

  const toggleRp = (id: string) => {
    setSelectedRpIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFormSubmit = async (values: FormValues) => {
    // Validate discount value
    const dv = parseFloat(values.discount_value)
    if (isNaN(dv) || dv <= 0) {
      setDiscountError('Discount value must be greater than zero.')
      return
    }
    if (values.discount_type === 'percentage' && dv > 100) {
      setDiscountError('Percentage discount cannot exceed 100%.')
      return
    }
    setDiscountError(null)

    // Validate date ranges
    if (values.stay_start_date && values.stay_end_date && values.stay_start_date > values.stay_end_date) {
      setDateError('Stay period start date cannot be later than end date.')
      return
    }
    if (values.booking_start_date && values.booking_end_date && values.booking_start_date > values.booking_end_date) {
      setDateError('Booking window start date cannot be later than end date.')
      return
    }
    setDateError(null)

    // Validate accommodations
    if (selectedAccIds.size === 0) {
      setAccError('At least one accommodation must be selected.')
      return
    }
    setAccError(null)

    await onSubmit({
      name: values.name,
      description: values.description || null,
      is_active: values.is_active,
      discount_type: values.discount_type,
      discount_value: values.discount_value,
      stay_start_date: values.stay_start_date || null,
      stay_end_date: values.stay_end_date || null,
      booking_start_date: values.booking_start_date || null,
      booking_end_date: values.booking_end_date || null,
      promo_code: values.promo_code || null,
      accommodation_ids: Array.from(selectedAccIds),
      rate_plan_ids: Array.from(selectedRpIds),
    })
  }

  const filteredAccommodations = accSearch.trim()
    ? accommodations.filter((a) =>
        a.name.toLowerCase().includes(accSearch.trim().toLowerCase())
      )
    : accommodations

  const isPercentage = discountType === 'percentage'

  // Preview discount value display
  const dvNum = parseFloat(discountValue)
  const dvInvalid = discountValue !== '' && (isNaN(dvNum) || dvNum <= 0 || (isPercentage && dvNum > 100))

  return (
    <FormPage>
      <FormHeader
        onBack={() => navigate('/promotions')}
        title={mode === 'create' ? 'New Promotion' : 'Edit Promotion'}
        subtitle={mode === 'create' ? 'Create a new promotional discount for your accommodations' : 'Update promotion details'}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => navigate('/promotions')}>Cancel</Button>
            <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
              {mode === 'create' ? 'Create Promotion' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <form onSubmit={handleSubmit(handleFormSubmit)}>
      <FormBody>
        {/* 1. Basic Info */}
        <SectionCard number={1} title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Promotion Name" required error={errors.name?.message} span2>
              <Input {...register('name')} placeholder="e.g. Summer Sale" />
            </Field>
            <Field label="Description" span2>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Optional description..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
              />
            </Field>
            <Field label="Active">
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setValue('is_active', !isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    isActive ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-600">{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* 2. Discount */}
        <SectionCard number={2} title="Discount">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-5">
            {PROMOTION_DISCOUNT_TYPES.map((dt) => {
              const selected = discountType === dt.value
              return (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => {
                    setValue('discount_type', dt.value)
                    setDiscountError(null)
                  }}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-slate-900'}`}>
                    {dt.label}
                  </p>
                  <p className={`mt-1 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {dt.description}
                  </p>
                </button>
              )
            })}
          </div>

          <Field
            label={isPercentage ? 'Discount Percentage' : 'Discount Amount'}
            required
            error={errors.discount_value?.message ?? discountError ?? undefined}
          >
            <div className="relative max-w-xs">
              {!isPercentage && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">&#8369;</span>
              )}
              <input
                type="number"
                min="0.01"
                max={isPercentage ? 100 : undefined}
                step={isPercentage ? '0.01' : '0.01'}
                {...register('discount_value')}
                placeholder={isPercentage ? 'e.g. 20' : 'e.g. 500.00'}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 ${
                  !isPercentage ? 'pl-7' : ''
                } ${
                  dvInvalid || discountError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                    : 'border-slate-300 focus:border-slate-500 focus:ring-slate-500'
                }`}
              />
              {isPercentage && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              )}
            </div>
          </Field>
        </SectionCard>

        {/* 3. Validity Period */}
        <SectionCard number={3} title="Validity Period">
          <p className="mb-4 text-sm text-slate-500">
            The stay dates during which this promotion applies. Leave blank for no date restriction.
          </p>
          {dateError && stayStart > stayEnd && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {dateError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Stay Start Date" hint="Optional">
              <input
                type="date"
                {...register('stay_start_date')}
                min={today}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </Field>
            <Field label="Stay End Date" hint="Optional">
              <input
                type="date"
                {...register('stay_end_date')}
                min={stayStart || today}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </Field>
          </div>
        </SectionCard>

        {/* 4. Booking Window */}
        <SectionCard number={4} title="Booking Window">
          <p className="mb-4 text-sm text-slate-500">
            The dates during which guests must book to receive this promotion. Leave blank for no restriction.
          </p>
          {dateError && bookingStart > bookingEnd && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {dateError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Booking Start Date" hint="Optional">
              <input
                type="date"
                {...register('booking_start_date')}
                min={today}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </Field>
            <Field label="Booking End Date" hint="Optional">
              <input
                type="date"
                {...register('booking_end_date')}
                min={bookingStart || today}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </Field>
          </div>
        </SectionCard>

        {/* 5. Promo Code */}
        <SectionCard number={5} title="Promo Code">
          <p className="mb-4 text-sm text-slate-500">
            Optionally require guests to enter a promo code. If left blank, the promotion is applied automatically when all eligibility criteria are met.
          </p>
          <Field label="Promo Code" hint="Must be unique within your property">
            <Input
              {...register('promo_code')}
              placeholder="e.g. SUMMER20"
              className="max-w-xs uppercase"
            />
          </Field>
        </SectionCard>

        {/* 6. Linked Accommodations */}
        <SectionCard number={6} title="Linked Accommodations">
          {loadingAccs ? (
            <p className="text-sm text-slate-400">Loading accommodations...</p>
          ) : accommodations.length === 0 ? (
            <p className="text-sm text-slate-400">No active accommodations found.</p>
          ) : (
            <>
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

              {accError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {accError}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Room Name
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Base Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAccommodations.map((acc) => {
                      const checked = selectedAccIds.has(acc.id)
                      return (
                        <tr key={acc.id} className={checked ? 'bg-slate-50' : ''}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAcc(acc.id)}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-slate-800">{acc.name}</td>
                          <td className="px-3 py-2 text-right text-sm text-slate-500">
                            &#8369;{parseFloat(acc.base_rate).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filteredAccommodations.length === 0 && accSearch && (
                <p className="mt-3 text-xs text-slate-400">No accommodations match your search.</p>
              )}
              {selectedAccIds.size === 0 && !accSearch && (
                <p className="mt-3 text-xs text-slate-400">Check rooms above to link them to this promotion.</p>
              )}
            </>
          )}
        </SectionCard>

        {/* 7. Linked Rate Plans */}
        <SectionCard number={7} title="Linked Rate Plans">
          <p className="mb-4 text-sm text-slate-500">
            Optionally limit this promotion to specific rate plans. If none are selected, the promotion applies to all rate plans.
          </p>
          {loadingRps ? (
            <p className="text-sm text-slate-400">Loading rate plans...</p>
          ) : ratePlans.length === 0 ? (
            <p className="text-sm text-slate-400">No active rate plans found.</p>
          ) : (
            <>
              <div className="mb-3 relative max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={rpSearch}
                  onChange={(e) => setRpSearch(e.target.value)}
                  placeholder="Search rate plans..."
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div className="space-y-2">
                {ratePlans
                  .filter((rp) =>
                    rpSearch.trim()
                      ? rp.name.toLowerCase().includes(rpSearch.trim().toLowerCase())
                      : true
                  )
                  .map((rp) => {
                    const checked = selectedRpIds.has(rp.id)
                    return (
                      <label key={rp.id} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRp(rp.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{rp.name}</p>
                          {rp.accommodations && rp.accommodations.length > 0 ? (
                            <p className="text-xs text-slate-400">
                              {rp.accommodations.map((a) => a.accommodation_name).join(', ')}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400">No rooms linked</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
              </div>
              {rpSearch.trim() && ratePlans.filter((rp) =>
                rp.name.toLowerCase().includes(rpSearch.trim().toLowerCase())
              ).length === 0 && (
                <p className="mt-3 text-xs text-slate-400">No rate plans match your search.</p>
              )}
            </>
          )}
        </SectionCard>

        {/* Bottom bar */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/promotions')}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {mode === 'create' ? 'Create Promotion' : 'Save Changes'}
          </Button>
        </div>
      </FormBody>
      </form>
    </FormPage>
  )
}
