import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Search } from 'lucide-react'
import { accommodationsApi, type Accommodation } from '../../../api/property/accommodations'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import {
  RATE_PLAN_PRICING_METHODS,
  RATE_PLAN_INCLUSIONS,
} from '../../../constants/propertyOptions'

// ─── Internal types ───────────────────────────────────────────────────────────

type Direction = '+' | '-'

interface LinkedEntry {
  amount: string
  direction: Direction
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeFinalPrice(
  baseRate: number,
  pricingMethod: string,
  amount: string,
  direction: Direction,
): number | null {
  const val = parseFloat(amount)
  if (isNaN(val) || val <= 0) return null
  if (pricingMethod === 'fixed_price') return val
  const signed = direction === '+' ? val : -val
  if (pricingMethod === 'fixed_amount') return baseRate + signed
  if (pricingMethod === 'percentage') {
    if (val > 100) return null
    return baseRate * (1 + signed / 100)
  }
  return null
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ number, title, children }: {
  number: number; title: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <span className="flex-none w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Field({
  label, required, error, span2, children,
}: {
  label: string; required?: boolean; error?: string; span2?: boolean; children: React.ReactNode
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function DirectionToggle({ value, onChange, disabled }: {
  value: Direction
  onChange: (v: Direction) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-shrink-0 rounded-lg border border-slate-300 overflow-hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('+')}
        className={`w-8 py-1.5 text-xs font-bold transition-colors ${
          value === '+'
            ? 'bg-emerald-600 text-white'
            : 'bg-white text-slate-400 hover:bg-slate-50'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        +
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('-')}
        className={`w-8 py-1.5 text-xs font-bold border-l border-slate-300 transition-colors ${
          value === '-'
            ? 'bg-red-500 text-white'
            : 'bg-white text-slate-400 hover:bg-slate-50'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        -
      </button>
    </div>
  )
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RatePlanFormValues {
  name: string
  description: string | null
  is_active: boolean
  pricing_method: string
  display_order: number
  inclusions: string[]
}

export interface LinkedAccommodation {
  accommodation_id: string
  pricing_value: string
}

export interface RatePlanFormProps {
  mode: 'create' | 'edit'
  defaults?: {
    name?: string
    description?: string | null
    is_active?: boolean
    pricing_method?: string
    display_order?: number
    accommodations?: LinkedAccommodation[]
    inclusions?: string[]
  }
  onSubmit: (
    values: RatePlanFormValues,
    linked: LinkedAccommodation[],
  ) => Promise<void>
  saving?: boolean
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  is_active: z.boolean().default(true),
  pricing_method: z.string().min(1),
  display_order: z.number().int().default(0),
})

type FormValues = z.infer<typeof schema>

// ─── Main form ────────────────────────────────────────────────────────────────

export function RatePlanForm({ mode, defaults, onSubmit, saving }: RatePlanFormProps) {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? '',
      description: defaults?.description ?? '',
      is_active: defaults?.is_active ?? true,
      pricing_method: defaults?.pricing_method ?? 'fixed_price',
      display_order: defaults?.display_order ?? 0,
    },
  })

  const pricingMethod = watch('pricing_method')
  const isActive = watch('is_active')

  const [linked, setLinked] = useState<Record<string, LinkedEntry>>(() => {
    const initial: Record<string, LinkedEntry> = {}
    for (const item of defaults?.accommodations ?? []) {
      const val = parseFloat(item.pricing_value)
      initial[item.accommodation_id] = {
        amount: isNaN(val) ? '' : String(Math.abs(val)),
        direction: val < 0 ? '-' : '+',
      }
    }
    return initial
  })

  const [inclusions, setInclusions] = useState<Set<string>>(
    () => new Set(defaults?.inclusions ?? [])
  )

  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loadingAccs, setLoadingAccs] = useState(true)
  const [accSearch, setAccSearch] = useState('')
  const [linkedError, setLinkedError] = useState<string | null>(null)

  const prevMethodRef = useRef(defaults?.pricing_method ?? 'fixed_price')

  useEffect(() => {
    accommodationsApi
      .list({ active: true, page_size: 100 })
      .then((r) => setAccommodations(r.data.items))
      .catch(() => {})
      .finally(() => setLoadingAccs(false))
  }, [])

  // When pricing method changes, reset amounts for linked accommodations
  useEffect(() => {
    if (pricingMethod === prevMethodRef.current) return
    prevMethodRef.current = pricingMethod
    setLinked((prev) => {
      const next: Record<string, LinkedEntry> = {}
      for (const [id, entry] of Object.entries(prev)) {
        if (pricingMethod === 'fixed_price') {
          const acc = accommodations.find((a) => a.id === id)
          next[id] = { amount: acc ? String(acc.base_rate) : '', direction: '+' }
        } else {
          next[id] = { amount: '', direction: entry.direction }
        }
      }
      return next
    })
    setLinkedError(null)
  }, [pricingMethod, accommodations])

  const handleCheck = (acc: Accommodation, checked: boolean) => {
    if (checked) {
      const defaultAmount = pricingMethod === 'fixed_price' ? String(acc.base_rate) : ''
      setLinked((prev) => ({ ...prev, [acc.id]: { amount: defaultAmount, direction: '+' } }))
    } else {
      setLinked((prev) => {
        const next = { ...prev }
        delete next[acc.id]
        return next
      })
    }
  }

  const handleAmount = (accId: string, amount: string) => {
    setLinked((prev) => ({ ...prev, [accId]: { ...prev[accId], amount } }))
    setLinkedError(null)
  }

  const handleDirection = (accId: string, direction: Direction) => {
    setLinked((prev) => ({ ...prev, [accId]: { ...prev[accId], direction } }))
    setLinkedError(null)
  }

  const toggleInclusion = (value: string) => {
    setInclusions((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleFormSubmit = async (values: FormValues) => {
    const linkedEntries = Object.entries(linked)

    if (linkedEntries.length === 0) {
      setLinkedError('At least one accommodation is required.')
      return
    }

    for (const [accId, entry] of linkedEntries) {
      const val = parseFloat(entry.amount)
      if (isNaN(val) || val <= 0) {
        setLinkedError('All selected accommodations must have an amount greater than zero.')
        return
      }
      if (pricingMethod === 'percentage' && val > 100) {
        setLinkedError('Percentage adjustment cannot exceed 100%.')
        return
      }
      if (pricingMethod !== 'fixed_price') {
        const acc = accommodations.find((a) => a.id === accId)
        if (acc) {
          const final = computeFinalPrice(parseFloat(acc.base_rate), pricingMethod, entry.amount, entry.direction)
          if (final === null || final < 0) {
            setLinkedError(`Final price for "${acc.name}" cannot be negative. Adjust the value or direction.`)
            return
          }
        }
      }
    }

    setLinkedError(null)

    const linkedList = linkedEntries.map(([accommodation_id, entry]) => {
      const val = parseFloat(entry.amount)
      const signed = pricingMethod !== 'fixed_price' && entry.direction === '-'
        ? String(-Math.abs(val))
        : String(Math.abs(val))
      return { accommodation_id, pricing_value: signed }
    })

    await onSubmit(
      {
        name: values.name,
        description: values.description || null,
        is_active: values.is_active,
        pricing_method: values.pricing_method,
        display_order: values.display_order,
        inclusions: Array.from(inclusions),
      },
      linkedList,
    )
  }

  const isAdjustment = pricingMethod !== 'fixed_price'
  const isPercentage = pricingMethod === 'percentage'
  const pricingColumnLabel =
    pricingMethod === 'percentage'
      ? 'Adjustment (%)'
      : pricingMethod === 'fixed_amount'
      ? 'Adjustment (₱)'
      : 'Plan Rate (₱)'

  const filteredAccommodations = accSearch.trim()
    ? accommodations.filter((a) =>
        a.name.toLowerCase().includes(accSearch.trim().toLowerCase())
      )
    : accommodations

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-[1100] bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/rate-plans')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                {mode === 'create' ? 'New Rate Plan' : 'Edit Rate Plan'}
              </h1>
              <p className="text-xs text-slate-400">
                {mode === 'create'
                  ? 'Create a new pricing tier for your accommodations'
                  : 'Update rate plan details'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/rate-plans')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
              {mode === 'create' ? 'Create Rate Plan' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="max-w-4xl mx-auto px-6 py-8 space-y-6"
      >
        {/* 1. Basic Info */}
        <SectionCard number={1} title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name?.message} span2>
              <Input {...register('name')} placeholder="e.g. Bed &amp; Breakfast" />
            </Field>
            <Field label="Description" span2>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Optional description of this rate plan..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
              />
            </Field>
            <Field label="Display Order">
              <Input
                type="number"
                min={0}
                step={1}
                {...register('display_order', { valueAsNumber: true })}
                placeholder="0"
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

        {/* 2. Pricing Method */}
        <SectionCard number={2} title="Pricing Method">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {RATE_PLAN_PRICING_METHODS.map((m) => {
              const selected = pricingMethod === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setValue('pricing_method', m.value)}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-slate-900'}`}>
                    {m.label}
                  </p>
                  <p className={`mt-1 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {m.description}
                  </p>
                </button>
              )
            })}
          </div>
        </SectionCard>

        {/* 3. Linked Accommodations */}
        <SectionCard number={3} title="Linked Accommodations">
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

              {linkedError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {linkedError}
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
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {pricingColumnLabel}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Final Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAccommodations.map((acc) => {
                      const checked = acc.id in linked
                      const entry = linked[acc.id]
                      const baseRate = parseFloat(acc.base_rate)
                      const finalPrice = checked && entry
                        ? computeFinalPrice(baseRate, pricingMethod, entry.amount, entry.direction)
                        : null
                      const amountVal = parseFloat(entry?.amount ?? '')
                      const inputInvalid = checked && entry && entry.amount !== '' && (
                        isNaN(amountVal) || amountVal <= 0 || (isPercentage && amountVal > 100)
                      )
                      const finalNegative = finalPrice !== null && finalPrice < 0

                      return (
                        <tr key={acc.id} className={checked ? 'bg-slate-50' : ''}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => handleCheck(acc, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-slate-800">{acc.name}</td>
                          <td className="px-3 py-2 text-right text-sm text-slate-500">
                            &#8369;{fmtCurrency(baseRate)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAdjustment && (
                                <DirectionToggle
                                  value={entry?.direction ?? '+'}
                                  onChange={(d) => handleDirection(acc.id, d)}
                                  disabled={!checked}
                                />
                              )}
                              <input
                                type="number"
                                min="0.01"
                                max={isPercentage ? 100 : undefined}
                                step="0.01"
                                disabled={!checked}
                                value={entry?.amount ?? ''}
                                onChange={(e) => handleAmount(acc.id, e.target.value)}
                                placeholder="0.00"
                                className={`w-24 rounded-lg border px-2.5 py-1.5 text-sm text-right text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-400 ${
                                  inputInvalid
                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                                    : 'border-slate-300 focus:border-slate-500 focus:ring-slate-500'
                                }`}
                              />
                              {isPercentage && (
                                <span className="text-sm text-slate-500 flex-shrink-0">%</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-sm">
                            {checked && finalPrice !== null ? (
                              <span className={finalNegative ? 'text-red-500 font-medium' : 'text-slate-800 font-medium'}>
                                &#8369;{fmtCurrency(finalPrice)}
                              </span>
                            ) : (
                              <span className="text-slate-300">--</span>
                            )}
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
              {Object.keys(linked).length === 0 && !accSearch && (
                <p className="mt-3 text-xs text-slate-400">Check rooms above to include them in this rate plan.</p>
              )}
            </>
          )}
        </SectionCard>

        {/* 4. Inclusions */}
        <SectionCard number={4} title="Inclusions">
          <p className="mb-4 text-sm text-slate-500">
            Select what is included with this rate plan.
          </p>
          <div className="flex flex-wrap gap-3">
            {RATE_PLAN_INCLUSIONS.map((inc) => {
              const selected = inclusions.has(inc.value)
              return (
                <button
                  key={inc.value}
                  type="button"
                  onClick={() => toggleInclusion(inc.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {inc.label}
                </button>
              )
            })}
          </div>
        </SectionCard>

        {/* Bottom bar */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/rate-plans')}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {mode === 'create' ? 'Create Rate Plan' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
