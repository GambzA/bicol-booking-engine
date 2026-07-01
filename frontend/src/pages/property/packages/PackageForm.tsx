import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search } from 'lucide-react'
import { accommodationsApi, type Accommodation } from '../../../api/property/accommodations'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { SectionCard, Field, FormPage, FormHeader, FormBody } from '../../../components/common/FormLayout'
import { PACKAGE_PRICING_TYPES, PACKAGE_INCLUSIONS } from '../../../constants/propertyOptions'

export interface PackageFormValues {
  name: string
  description: string | null
  is_active: boolean
  pricing_type: string
  price_value: string
  display_order: number
  inclusions: string[]
}

export interface PackageFormProps {
  mode: 'create' | 'edit'
  defaults?: {
    name?: string
    description?: string | null
    is_active?: boolean
    pricing_type?: string
    price_value?: string
    display_order?: number
    accommodation_ids?: string[]
    inclusions?: string[]
  }
  onSubmit: (values: PackageFormValues, accommodationIds: string[]) => Promise<void>
  saving?: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  is_active: z.boolean().default(true),
  pricing_type: z.string().min(1),
  price_value: z.string().min(1, 'Price is required'),
  display_order: z.number().int().default(0),
})

type FormValues = z.infer<typeof schema>

export function PackageForm({ mode, defaults, onSubmit, saving }: PackageFormProps) {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? '',
      description: defaults?.description ?? '',
      is_active: defaults?.is_active ?? true,
      pricing_type: defaults?.pricing_type ?? 'per_stay',
      price_value: defaults?.price_value ?? '',
      display_order: defaults?.display_order ?? 0,
    },
  })

  const pricingType = watch('pricing_type')
  const isActive = watch('is_active')

  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaults?.accommodation_ids ?? []))
  const [inclusions, setInclusions] = useState<Set<string>>(() => new Set(defaults?.inclusions ?? []))
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loadingAccs, setLoadingAccs] = useState(true)
  const [accSearch, setAccSearch] = useState('')
  const [accError, setAccError] = useState<string | null>(null)

  useEffect(() => {
    accommodationsApi
      .list({ active: true, page_size: 100 })
      .then((r) => setAccommodations(r.data.items))
      .catch(() => {})
      .finally(() => setLoadingAccs(false))
  }, [])

  const toggleAcc = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setAccError(null)
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
    const val = parseFloat(values.price_value)
    if (isNaN(val) || val <= 0) {
      setAccError('Package price must be greater than zero.')
      return
    }
    if (selected.size === 0) {
      setAccError('At least one accommodation is required.')
      return
    }
    setAccError(null)
    await onSubmit(
      {
        name: values.name,
        description: values.description || null,
        is_active: values.is_active,
        pricing_type: values.pricing_type,
        price_value: String(val),
        display_order: values.display_order,
        inclusions: Array.from(inclusions),
      },
      Array.from(selected),
    )
  }

  const filteredAccommodations = accSearch.trim()
    ? accommodations.filter((a) => a.name.toLowerCase().includes(accSearch.trim().toLowerCase()))
    : accommodations

  return (
    <FormPage>
      <FormHeader
        onBack={() => navigate('/packages')}
        title={mode === 'create' ? 'New Package' : 'Edit Package'}
        subtitle={mode === 'create' ? 'Bundle add-ons and inclusions into a sellable package' : 'Update package details'}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => navigate('/packages')}>Cancel</Button>
            <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
              {mode === 'create' ? 'Create Package' : 'Save Changes'}
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
                <Input {...register('name')} placeholder="e.g. Honeymoon Package" />
              </Field>
              <Field label="Description" span2>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Optional description of this package..."
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

          {/* 2. Pricing */}
          <SectionCard number={2} title="Pricing">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PACKAGE_PRICING_TYPES.map((m) => {
                const sel = pricingType === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setValue('pricing_type', m.value)}
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
            <div className="mt-4 max-w-xs">
              <Field label="Price (₱)" required error={errors.price_value?.message}>
                <Input type="number" min="0.01" step="0.01" {...register('price_value')} placeholder="0.00" />
              </Field>
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

                {accError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{accError}</div>
                )}

                <div className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {filteredAccommodations.map((acc) => {
                    const checked = selected.has(acc.id)
                    return (
                      <label key={acc.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${checked ? 'bg-slate-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleAcc(acc.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span className="flex-1 text-sm font-medium text-slate-800">{acc.name}</span>
                        <span className="text-xs text-slate-400">&#8369;{parseFloat(acc.base_rate).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </label>
                    )
                  })}
                </div>
                {filteredAccommodations.length === 0 && accSearch && (
                  <p className="mt-3 text-xs text-slate-400">No accommodations match your search.</p>
                )}
              </>
            )}
          </SectionCard>

          {/* 4. Inclusions */}
          <SectionCard number={4} title="Inclusions">
            <p className="mb-4 text-sm text-slate-500">Select what is included with this package.</p>
            <div className="flex flex-wrap gap-3">
              {PACKAGE_INCLUSIONS.map((inc) => {
                const sel = inclusions.has(inc.value)
                return (
                  <button
                    key={inc.value}
                    type="button"
                    onClick={() => toggleInclusion(inc.value)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {inc.label}
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <div className="flex justify-end gap-2 pb-8">
            <Button variant="secondary" type="button" onClick={() => navigate('/packages')}>Cancel</Button>
            <Button type="submit" loading={saving}>{mode === 'create' ? 'Create Package' : 'Save Changes'}</Button>
          </div>
        </FormBody>
      </form>
    </FormPage>
  )
}
