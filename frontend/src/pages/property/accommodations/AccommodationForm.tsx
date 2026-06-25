import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as LucideIcons from 'lucide-react'
import {
  ArrowLeft, Plus, X, ImagePlus, ChevronDown, ChevronRight,
  Tag, Check,
} from 'lucide-react'
import { accommodationsApi, type AmenityItem, type AccommodationImage } from '../../../api/property/accommodations'
import {
  ACCOMMODATION_TYPES,
  AMENITY_PRESETS,
  GALLERY_CATEGORIES,
} from '../../../constants/propertyOptions'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { useToast } from '../../../components/common/useToast'

// ─── Types ───────────────────────────────────────────────────────────────────

type GalleryEntry = { id: string; url: string; uploading?: boolean }
type GalleryState = Record<string, GalleryEntry[]>

export interface AccommodationFormValues {
  name: string
  accommodation_type: string
  description: string
  num_units: number
  max_occupancy: number
  max_adults: number | null
  max_children: number | null
  unit_prefix: number | null
  base_rate: number
  weekend_rate: number | null
  check_in_time: string
  check_out_time: string
}

export interface AccommodationFormDefaults {
  name?: string
  accommodation_type?: string
  description?: string
  num_units?: number
  max_occupancy?: number
  max_adults?: number | null
  max_children?: number | null
  unit_prefix?: number | null
  base_rate?: number | string
  weekend_rate?: number | string | null
  check_in_time?: string
  check_out_time?: string
  amenities?: AmenityItem[]
  images?: AccommodationImage[]
}

export interface AccommodationFormProps {
  mode: 'create' | 'edit'
  defaults?: AccommodationFormDefaults
  onSubmit: (values: AccommodationFormValues, amenities: AmenityItem[], images: AccommodationImage[]) => Promise<void>
  saving?: boolean
}

// ─── Zod schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  accommodation_type: z.string().min(1),
  description: z.string().optional().default(''),
  num_units: z.coerce.number().int().min(1, 'At least 1 unit'),
  max_occupancy: z.coerce.number().int().min(1, 'At least 1 guest'),
  max_adults: z.coerce.number().int().min(0).nullable().optional(),
  max_children: z.coerce.number().int().min(0).nullable().optional(),
  unit_prefix: z.coerce.number().int().min(0).nullable().optional(),
  base_rate: z.coerce.number().min(0, 'Base rate is required'),
  weekend_rate: z.coerce.number().min(0).nullable().optional(),
  check_in_time: z.string().optional().default(''),
  check_out_time: z.string().optional().default(''),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DynIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = (LucideIcons as Record<string, unknown>)[name]
  if (typeof Icon !== 'function') return <Tag size={size} />
  const C = Icon as React.FC<{ size: number }>
  return <C size={size} />
}

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

function SelectField({
  options, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select
      {...props}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ─── Amenity Picker ───────────────────────────────────────────────────────────

function AmenityPicker({
  selected,
  onChange,
}: {
  selected: AmenityItem[]
  onChange: (items: AmenityItem[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')

  const isSelected = (label: string) => selected.some((a) => a.label === label)

  const toggle = (preset: { icon: string; label: string }) => {
    if (isSelected(preset.label)) {
      onChange(selected.filter((a) => a.label !== preset.label))
    } else {
      onChange([...selected, { icon: preset.icon, label: preset.label }])
    }
  }

  const addCustom = () => {
    const label = customLabel.trim()
    if (!label || isSelected(label)) return
    onChange([...selected, { icon: 'Tag', label }])
    setCustomLabel('')
  }

  const remove = (label: string) => onChange(selected.filter((a) => a.label !== label))

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((a) => (
            <div
              key={a.label}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <DynIcon name={a.icon} size={13} />
              {a.label}
              <button
                type="button"
                onClick={() => remove(a.label)}
                className="ml-0.5 text-slate-400 hover:text-red-500"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preset picker toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {open ? 'Close preset picker' : 'Add from presets'}
      </button>

      {open && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AMENITY_PRESETS.map((p) => {
              const active = isSelected(p.label)
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => toggle(p)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
                  }`}
                >
                  <DynIcon name={p.icon} size={14} />
                  <span className="truncate">{p.label}</span>
                  {active && <Check size={11} className="ml-auto flex-none" />}
                </button>
              )
            })}
          </div>

          {/* Custom entry */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              placeholder="Custom amenity name..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!customLabel.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      )}

      {selected.length === 0 && !open && (
        <p className="text-xs text-slate-400">No amenities added yet.</p>
      )}
    </div>
  )
}

// ─── Image Gallery ────────────────────────────────────────────────────────────

function ImageGallery({
  gallery,
  onChange,
}: {
  gallery: GalleryState
  onChange: (gallery: GalleryState) => void
}) {
  const toast = useToast()
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const totalImages = Object.values(gallery).reduce((sum, arr) => sum + arr.length, 0)

  const toggleSection = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  const isSectionOpen = (key: string) =>
    expanded[key] ?? (gallery[key]?.length ?? 0) > 0

  const handleUpload = async (category: string, file: File) => {
    const tempId = `tmp-${Date.now()}-${Math.random()}`
    const updated: GalleryState = {
      ...gallery,
      [category]: [...(gallery[category] ?? []), { id: tempId, url: '', uploading: true }],
    }
    onChange(updated)
    // Expand section on upload
    setExpanded((prev) => ({ ...prev, [category]: true }))

    try {
      const r = await accommodationsApi.uploadImage(file, 'accommodations')
      onChange({
        ...updated,
        [category]: updated[category].map((e) =>
          e.id === tempId ? { id: tempId, url: r.data.url, uploading: false } : e
        ),
      })
    } catch {
      toast.error('Failed to upload image.')
      onChange({
        ...updated,
        [category]: (updated[category] ?? []).filter((e) => e.id !== tempId),
      })
    }
  }

  const removeImage = (category: string, id: string) => {
    const filtered = (gallery[category] ?? []).filter((e) => e.id !== id)
    onChange({ ...gallery, [category]: filtered })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">
        {totalImages > 0
          ? `${totalImages} image${totalImages !== 1 ? 's' : ''} across all categories`
          : 'No images uploaded yet. Click a category to add images.'}
      </p>

      {GALLERY_CATEGORIES.map(({ key, label, icon }) => {
        const items = gallery[key] ?? []
        const open = isSectionOpen(key)

        return (
          <div key={key} className="rounded-xl border border-slate-200 overflow-hidden">
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleSection(key)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="flex-none w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                <DynIcon name={icon} size={13} />
              </span>
              <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
              {items.length > 0 && (
                <span className="text-xs text-slate-400">{items.length} photo{items.length !== 1 ? 's' : ''}</span>
              )}
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>

            {open && (
              <div className="px-4 pb-4 pt-3 bg-white">
                {/* Image grid */}
                {items.length > 0 && (
                  <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {items.map((entry) => (
                      <div
                        key={entry.id}
                        className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
                      >
                        {entry.uploading ? (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">
                            Uploading...
                          </div>
                        ) : (
                          <>
                            <img
                              src={entry.url}
                              alt={label}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(key, entry.id)}
                              className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white hover:bg-black/70"
                              title="Remove"
                            >
                              <X size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <input
                  ref={(el) => { fileRefs.current[key] = el }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(key, file)
                    if (fileRefs.current[key]) fileRefs.current[key]!.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRefs.current[key]?.click()}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
                >
                  <ImagePlus size={14} /> Add photo to {label}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function AccommodationForm({ mode, defaults, onSubmit, saving }: AccommodationFormProps) {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AccommodationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? '',
      accommodation_type: defaults?.accommodation_type ?? 'room',
      description: defaults?.description ?? '',
      num_units: defaults?.num_units ?? 1,
      max_occupancy: defaults?.max_occupancy ?? 2,
      max_adults: defaults?.max_adults ?? undefined,
      max_children: defaults?.max_children ?? undefined,
      unit_prefix: defaults?.unit_prefix ?? undefined,
      base_rate: defaults?.base_rate != null ? Number(defaults.base_rate) : undefined,
      weekend_rate: defaults?.weekend_rate != null ? Number(defaults.weekend_rate) : undefined,
      check_in_time: defaults?.check_in_time ?? '14:00',
      check_out_time: defaults?.check_out_time ?? '12:00',
    },
  })

  // Amenities state
  const [amenities, setAmenities] = useState<AmenityItem[]>(defaults?.amenities ?? [])

  // Image gallery state - grouped by category
  const [gallery, setGallery] = useState<GalleryState>(() => {
    const g: GalleryState = {}
    for (const img of (defaults?.images ?? [])) {
      if (!g[img.category]) g[img.category] = []
      g[img.category].push({ id: `${img.category}-${g[img.category].length}`, url: img.url })
    }
    return g
  })

  const flattenImages = (): AccommodationImage[] =>
    GALLERY_CATEGORIES.flatMap(({ key }) =>
      (gallery[key] ?? [])
        .filter((e) => !e.uploading && e.url)
        .map(({ url }) => ({ url, category: key }))
    )

  const handleFormSubmit = async (values: AccommodationFormValues) => {
    await onSubmit(values, amenities, flattenImages())
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-[1100] bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/accommodations')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                {mode === 'create' ? 'New Accommodation' : 'Edit Accommodation'}
              </h1>
              <p className="text-xs text-slate-400">
                {mode === 'create'
                  ? 'Fill in the details to add a new accommodation type'
                  : 'Update accommodation details'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/accommodations')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
              {mode === 'create' ? 'Create Accommodation' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="max-w-4xl mx-auto px-6 py-8 space-y-6"
      >
        {/* 1. Basic Information */}
        <SectionCard number={1} title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name?.message} span2>
              <Input {...register('name')} placeholder="e.g. Deluxe Double Room" />
            </Field>
            <Field label="Accommodation Type" required>
              <SelectField
                options={ACCOMMODATION_TYPES}
                value={watch('accommodation_type')}
                onChange={(e) => setValue('accommodation_type', e.target.value)}
              />
            </Field>
            <Field label="Description" span2>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Brief description of this accommodation type..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
              />
            </Field>
          </div>
        </SectionCard>

        {/* 2. Capacity */}
        <SectionCard number={2} title="Capacity">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Units" required error={errors.num_units?.message}>
              <Input
                type="number"
                min={1}
                {...register('num_units')}
                placeholder="1"
              />
            </Field>
            <Field label="Max Occupancy" required error={errors.max_occupancy?.message}>
              <Input
                type="number"
                min={1}
                {...register('max_occupancy')}
                placeholder="2"
              />
            </Field>
            <Field label="Max Adults">
              <Input
                type="number"
                min={0}
                {...register('max_adults')}
                placeholder="Optional"
              />
            </Field>
            <Field label="Max Children">
              <Input
                type="number"
                min={0}
                {...register('max_children')}
                placeholder="Optional"
              />
            </Field>
            <Field label="Room Number Prefix" span2>
              <Input
                type="number"
                min={0}
                {...register('unit_prefix')}
                placeholder="Optional (e.g. 1 for floor 1)"
              />
              {(() => {
                const prefix = watch('unit_prefix')
                const units = watch('num_units')
                if (prefix == null || prefix === 0 && !watch('unit_prefix')) return (
                  <p className="mt-1 text-xs text-slate-400">
                    When set, units are labeled Room {'{prefix}'}00, {'{prefix}'}01, etc.
                  </p>
                )
                const count = Math.min(Number(units) || 1, 5)
                const labels = Array.from({ length: count }, (_, i) =>
                  `Room ${Number(prefix) * 100 + i}`
                )
                const more = Number(units) > 5 ? ` ... Room ${Number(prefix) * 100 + Number(units) - 1}` : ''
                return (
                  <p className="mt-1 text-xs text-slate-500">
                    Units will be: <span className="font-medium">{labels.join(', ')}{more}</span>
                  </p>
                )
              })()}
            </Field>
          </div>
        </SectionCard>

        {/* 3. Rates & Check Times */}
        <SectionCard number={3} title="Rates & Operations">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Base Rate (₱ / night)" required error={errors.base_rate?.message}>
              <Input
                type="number"
                min={0}
                step="0.01"
                {...register('base_rate')}
                placeholder="0.00"
              />
            </Field>
            <Field label="Weekend Rate (₱ / night)">
              <Input
                type="number"
                min={0}
                step="0.01"
                {...register('weekend_rate')}
                placeholder="Optional"
              />
            </Field>
            <Field label="Check-in Time">
              <Input
                type="time"
                {...register('check_in_time')}
              />
            </Field>
            <Field label="Check-out Time">
              <Input
                type="time"
                {...register('check_out_time')}
              />
            </Field>
          </div>
        </SectionCard>

        {/* 4. Amenities */}
        <SectionCard number={4} title="Amenities">
          <AmenityPicker selected={amenities} onChange={setAmenities} />
        </SectionCard>

        {/* 5. Images */}
        <SectionCard number={5} title="Images">
          <ImageGallery gallery={gallery} onChange={setGallery} />
        </SectionCard>

        {/* Bottom bar */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/accommodations')}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {mode === 'create' ? 'Create Accommodation' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
