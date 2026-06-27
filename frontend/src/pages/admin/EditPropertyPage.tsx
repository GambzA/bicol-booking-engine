import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Upload, X, MapPin } from 'lucide-react'
import { propertiesApi, uploadApi } from '../../api/admin/properties'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { SectionCard, Field, FormPage, FormHeader, FormBody } from '../../components/common/FormLayout'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { HotelStatusBadge } from '../../components/admin/StatusBadge'
import { PageLoader } from '../../components/common/PageLoader'
import { useToast } from '../../components/common/useToast'
import type { Hotel } from '../../types/admin'
import { PROPERTY_TYPES, CURRENCIES, TIMEZONES, LANGUAGES } from '../../constants/propertyOptions'

const MapPicker = lazy(() =>
  import('../../components/admin/MapPicker').then((m) => ({ default: m.MapPicker }))
)

const schema = z.object({
  name: z.string().min(1, 'Property name is required'),
  business_name: z.string().optional(),
  property_type: z.string().min(1, 'Property type is required'),
  description: z.string().optional(),
  contact_person: z.string().optional(),
  mobile_number: z.string().optional(),
  telephone_number: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  province: z.string().optional(),
  city: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  postal_code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  default_currency: z.string(),
  timezone: z.string(),
  language: z.string(),
  banner_image_url: z.string().optional(),
  logo_url: z.string().optional(),
})

type FormValues = z.infer<typeof schema>


function SelectField({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[]
}) {
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

function ImageUploadField({
  label, value, onChange, folder,
}: {
  label: string; value: string | undefined; onChange: (url: string) => void; folder: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const { data } = await uploadApi(file, folder)
      onChange(data.url)
    } catch {
      // user can retry
    }
    setUploading(false)
  }

  return (
    <div>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="h-24 w-auto rounded-lg border border-slate-200 object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 bg-white rounded-full border border-slate-200 p-0.5 hover:bg-red-50"
          >
            <X size={14} className="text-red-500" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <Upload size={14} />
          {uploading ? 'Uploading...' : 'Upload image'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

export function EditPropertyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | 'deactivate' | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const lat = watch('latitude')
  const lng = watch('longitude')
  const bannerUrl = watch('banner_image_url')
  const logoUrl = watch('logo_url')

  const fetchHotel = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await propertiesApi.get(id)
      setHotel(data)
      reset({
        name: data.name,
        business_name: data.business_name ?? '',
        property_type: data.property_type ?? 'hotel',
        description: data.description ?? '',
        contact_person: data.contact_person ?? '',
        mobile_number: data.mobile_number ?? '',
        telephone_number: data.telephone_number ?? '',
        country: data.country,
        province: data.province ?? '',
        city: data.city ?? '',
        address_line_1: data.address_line_1 ?? '',
        address_line_2: data.address_line_2 ?? '',
        postal_code: data.postal_code ?? '',
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        default_currency: data.default_currency ?? 'PHP',
        timezone: data.timezone ?? 'Asia/Manila',
        language: data.language ?? 'en',
        banner_image_url: data.banner_image_url ?? '',
        logo_url: data.logo_url ?? '',
      })
    } catch {
      toast.error('Failed to load property.')
    }
    setLoading(false)
  }, [id, reset])

  useEffect(() => { fetchHotel() }, [fetchHotel])

  async function onSubmit(values: FormValues) {
    if (!id) return
    setSubmitting(true)
    try {
      await propertiesApi.update(id, values)
      toast.success('Property updated.')
      navigate(`/admin/properties/${id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to update property.'
      toast.error(msg)
    }
    setSubmitting(false)
  }

  async function handleAction(action: 'suspend' | 'reactivate' | 'deactivate') {
    if (!id) return
    setActionLoading(true)
    try {
      if (action === 'suspend') await propertiesApi.suspend(id, 'Admin action')
      else if (action === 'reactivate') await propertiesApi.reactivate(id, 'Admin action')
      else await propertiesApi.deactivate(id, 'Admin action')
      toast.success(`Property ${action}d.`)
      if (action === 'deactivate') { navigate('/admin/properties'); return }
      await fetchHotel()
    } catch {
      toast.error('Action failed.')
    }
    setActionLoading(false)
    setConfirmAction(null)
  }

  if (loading) return <PageLoader />

  return (
    <>
      <FormPage>
        <FormHeader
          onBack={() => navigate(`/admin/properties/${id}`)}
          title={hotel?.name ?? 'Edit Property'}
          subtitle="Edit property details"
          actions={
            <div className="flex items-center gap-2">
              {hotel?.status === 'active' && (
                <Button variant="secondary" size="sm" onClick={() => setConfirmAction('suspend')}>Suspend</Button>
              )}
              {hotel?.status === 'suspended' && (
                <Button variant="secondary" size="sm" onClick={() => setConfirmAction('reactivate')}>Reactivate</Button>
              )}
              {hotel?.status !== 'deactivated' && (
                <Button variant="danger" size="sm" onClick={() => setConfirmAction('deactivate')}>Deactivate</Button>
              )}
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <Button variant="secondary" onClick={() => navigate(`/admin/properties/${id}`)}>Cancel</Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        />

        <form onSubmit={handleSubmit(onSubmit)}>
        <FormBody>

          {/* 1. Basic Information */}
          <SectionCard id="basic" number={1} title="Basic Information" grid>
            <Field label="Property Name" required span2>
              <Input {...register('name')} placeholder="e.g. Sorsogon Bay Hotel" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </Field>
            <Field label="Business Name">
              <Input {...register('business_name')} placeholder="Registered business name (if different)" />
            </Field>
            <Field label="Property Type" required>
              <SelectField
                options={PROPERTY_TYPES}
                value={watch('property_type') ?? 'hotel'}
                onChange={(e) => setValue('property_type', e.target.value)}
              />
            </Field>
            <Field label="Description" span2>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Brief description of the property..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
              />
            </Field>
          </SectionCard>

          {/* 2. Contact Information */}
          <SectionCard id="contact" number={2} title="Contact Information" grid>
            <p className="sm:col-span-2 -mt-1 -mb-1 text-xs text-slate-400">
              Primary contact for billing and notifications.
            </p>
            <Field label="Contact Person">
              <Input {...register('contact_person')} placeholder="Full name" />
            </Field>
            <Field label="Mobile Number">
              <Input {...register('mobile_number')} placeholder="+63 917 000 0000" />
            </Field>
            <Field label="Telephone Number">
              <Input {...register('telephone_number')} placeholder="+63 56 000 0000" />
            </Field>
          </SectionCard>

          {/* 3. Location */}
          <SectionCard id="location" number={3} title="Location" grid>
            <Field label="Country" required>
              <Input {...register('country')} placeholder="Philippines" />
              {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country.message}</p>}
            </Field>
            <Field label="Province / State">
              <Input {...register('province')} placeholder="Sorsogon" />
            </Field>
            <Field label="City / Municipality">
              <Input {...register('city')} placeholder="Sorsogon City" />
            </Field>
            <Field label="Postal Code">
              <Input {...register('postal_code')} placeholder="4700" />
            </Field>
            <Field label="Address Line 1" span2>
              <Input {...register('address_line_1')} placeholder="Building / Street / Barangay" />
            </Field>
            <Field label="Address Line 2" span2>
              <Input {...register('address_line_2')} placeholder="Unit, Floor, Landmark (optional)" />
            </Field>

            <Field label="Latitude">
              <Input
                type="number"
                step="any"
                placeholder="e.g. 12.9716"
                value={lat ?? ''}
                onChange={(e) => setValue('latitude', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </Field>
            <Field label="Longitude">
              <Input
                type="number"
                step="any"
                placeholder="e.g. 124.0027"
                value={lng ?? ''}
                onChange={(e) => setValue('longitude', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </Field>

            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <MapPin size={12} /> Click on the map to update the exact location
              </p>
              <div className="rounded-xl overflow-hidden border border-slate-200 h-64">
                <Suspense fallback={<div className="h-full bg-slate-100 animate-pulse rounded-xl" />}>
                  <MapPicker
                    lat={lat}
                    lng={lng}
                    onPick={(la, lo) => {
                      setValue('latitude', parseFloat(la.toFixed(7)))
                      setValue('longitude', parseFloat(lo.toFixed(7)))
                    }}
                  />
                </Suspense>
              </div>
            </div>
          </SectionCard>

          {/* 4. Settings */}
          <SectionCard id="settings" number={4} title="Property Settings" grid>
            <Field label="Default Currency">
              <SelectField
                options={CURRENCIES}
                value={watch('default_currency') ?? 'PHP'}
                onChange={(e) => setValue('default_currency', e.target.value)}
              />
            </Field>
            <Field label="Timezone">
              <SelectField
                options={TIMEZONES}
                value={watch('timezone') ?? 'Asia/Manila'}
                onChange={(e) => setValue('timezone', e.target.value)}
              />
            </Field>
            <Field label="Language">
              <SelectField
                options={LANGUAGES}
                value={watch('language') ?? 'en'}
                onChange={(e) => setValue('language', e.target.value)}
              />
            </Field>
          </SectionCard>

          {/* 5. Media */}
          <SectionCard id="media" number={5} title="Media" grid>
            <Field label="Logo">
              <ImageUploadField
                label="Logo"
                value={logoUrl || undefined}
                onChange={(url) => setValue('logo_url', url)}
                folder="logos"
              />
            </Field>
            <Field label="Banner Image">
              <ImageUploadField
                label="Banner Image"
                value={bannerUrl || undefined}
                onChange={(url) => setValue('banner_image_url', url)}
                folder="banners"
              />
            </Field>
          </SectionCard>

          <div className="flex justify-end gap-2 pt-2 pb-8">
            <Button variant="secondary" type="button" onClick={() => navigate(`/admin/properties/${id}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </FormBody>
        </form>
      </FormPage>

      <ConfirmDialog
        open={confirmAction === 'suspend'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('suspend')}
        title="Suspend Property"
        message="This will prevent hotel staff from logging in. You can reactivate later."
        confirmLabel="Suspend"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'reactivate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('reactivate')}
        title="Reactivate Property"
        message="Hotel staff will regain access."
        confirmLabel="Reactivate"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'deactivate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('deactivate')}
        title="Deactivate Property"
        message="This is a permanent soft deletion. The property will no longer appear in the platform."
        confirmLabel="Deactivate"
        loading={actionLoading}
      />
    </>
  )
}
