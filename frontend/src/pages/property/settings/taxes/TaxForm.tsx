import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../../components/common/Button'
import { Input } from '../../../../components/common/Input'
import { SectionCard, Field, FormPage, FormHeader, FormBody } from '../../../../components/common/FormLayout'
import {
  TAX_TYPES, TAX_CALCULATION_METHODS, TAX_APPLICATION_SCOPES, MAX_TAX_PERCENTAGE,
} from '../../../../constants/propertyOptions'

export interface TaxFormValues {
  name: string
  description: string | null
  tax_type: string
  rate: string
  calculation_method: string
  application_scope: string
  is_active: boolean
  display_order: number
}

export interface TaxFormProps {
  mode: 'create' | 'edit'
  defaults?: {
    name?: string
    description?: string | null
    tax_type?: string
    rate?: string
    calculation_method?: string
    application_scope?: string
    is_active?: boolean
    display_order?: number
  }
  onSubmit: (values: TaxFormValues) => Promise<void>
  saving?: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  tax_type: z.string().min(1),
  rate: z.string().min(1, 'Rate is required'),
  calculation_method: z.string().min(1),
  application_scope: z.string().min(1),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
})

type FormValues = z.infer<typeof schema>

export function TaxForm({ mode, defaults, onSubmit, saving }: TaxFormProps) {
  const navigate = useNavigate()
  const [rateError, setRateError] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? '',
      description: defaults?.description ?? '',
      tax_type: defaults?.tax_type ?? 'percentage',
      rate: defaults?.rate ?? '',
      calculation_method: defaults?.calculation_method ?? 'exclusive',
      application_scope: defaults?.application_scope ?? 'per_booking',
      is_active: defaults?.is_active ?? true,
      display_order: defaults?.display_order ?? 0,
    },
  })

  const taxType = watch('tax_type')
  const calcMethod = watch('calculation_method')
  const scope = watch('application_scope')
  const isActive = watch('is_active')
  const isPercentage = taxType === 'percentage'

  const handleFormSubmit = async (values: FormValues) => {
    const rateNum = parseFloat(values.rate)
    if (isNaN(rateNum) || rateNum < 0) {
      setRateError('Rate must be zero or greater.')
      return
    }
    if (values.tax_type === 'percentage' && rateNum > MAX_TAX_PERCENTAGE) {
      setRateError(`Percentage tax cannot exceed ${MAX_TAX_PERCENTAGE}%.`)
      return
    }
    setRateError(null)
    await onSubmit({
      name: values.name,
      description: values.description || null,
      tax_type: values.tax_type,
      rate: String(rateNum),
      calculation_method: values.calculation_method,
      application_scope: values.application_scope,
      is_active: values.is_active,
      display_order: values.display_order,
    })
  }

  return (
    <FormPage>
      <FormHeader
        onBack={() => navigate('/settings/taxes')}
        title={mode === 'create' ? 'New Tax' : 'Edit Tax'}
        subtitle={mode === 'create' ? 'Configure a tax applied to bookings' : 'Update tax details'}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => navigate('/settings/taxes')}>Cancel</Button>
            <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
              {mode === 'create' ? 'Create Tax' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <FormBody>
          {/* 1. Basic Info */}
          <SectionCard number={1} title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name?.message} span2>
                <Input {...register('name')} placeholder="e.g. VAT, Service Charge, Environmental Fee" />
              </Field>
              <Field label="Description" span2>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Optional description of this tax..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
                />
              </Field>
              <Field label="Display Order">
                <Input type="number" min={0} step={1} {...register('display_order', { valueAsNumber: true })} placeholder="0" />
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
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-slate-600">{isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </Field>
            </div>
          </SectionCard>

          {/* 2. Type & Rate */}
          <SectionCard number={2} title="Type & Rate">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TAX_TYPES.map((t) => {
                const sel = taxType === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setValue('tax_type', t.value)
                      if (t.value === 'percentage') setValue('application_scope', 'per_booking')
                    }}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${sel ? 'text-white' : 'text-slate-900'}`}>{t.label}</p>
                    <p className={`mt-1 text-xs ${sel ? 'text-slate-300' : 'text-slate-500'}`}>{t.description}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 max-w-xs">
              <Field label={isPercentage ? 'Rate (%)' : 'Amount (₱)'} required error={rateError ?? errors.rate?.message}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {isPercentage ? '%' : '₱'}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    max={isPercentage ? MAX_TAX_PERCENTAGE : undefined}
                    className="pl-7"
                    {...register('rate')}
                    placeholder={isPercentage ? '12.00' : '50.00'}
                  />
                </div>
              </Field>
            </div>
          </SectionCard>

          {/* 3. Calculation Method */}
          <SectionCard number={3} title="Calculation Method">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TAX_CALCULATION_METHODS.map((m) => {
                const sel = calcMethod === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setValue('calculation_method', m.value)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${sel ? 'text-white' : 'text-slate-900'}`}>{m.label}</p>
                    <p className={`mt-1 text-xs ${sel ? 'text-slate-300' : 'text-slate-500'}`}>{m.description}</p>
                  </button>
                )
              })}
            </div>
          </SectionCard>

          {/* 4. Application Scope */}
          <SectionCard number={4} title="Application Scope">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TAX_APPLICATION_SCOPES.map((s) => {
                const sel = scope === s.value
                const disabled = isPercentage && s.value !== 'per_booking'
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setValue('application_scope', s.value)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      disabled
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                        : sel
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${sel && !disabled ? 'text-white' : disabled ? 'text-slate-300' : 'text-slate-900'}`}>{s.label}</p>
                    <p className={`mt-1 text-xs ${sel && !disabled ? 'text-slate-300' : disabled ? 'text-slate-300' : 'text-slate-500'}`}>{s.description}</p>
                  </button>
                )
              })}
            </div>
            {isPercentage && (
              <p className="mt-3 text-xs text-slate-400">
                Percentage taxes apply once to the booking subtotal, so their scope is always Per Booking.
              </p>
            )}
          </SectionCard>

          <div className="flex justify-end gap-2 pb-8">
            <Button variant="secondary" type="button" onClick={() => navigate('/settings/taxes')}>Cancel</Button>
            <Button type="submit" loading={saving}>{mode === 'create' ? 'Create Tax' : 'Save Changes'}</Button>
          </div>
        </FormBody>
      </form>
    </FormPage>
  )
}
