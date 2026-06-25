import { lazy, Suspense, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Upload, X, MapPin, Copy, Check } from 'lucide-react'
import { propertiesApi, uploadApi } from '../../api/admin/properties'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { useToast } from '../../components/common/useToast'
import { PROPERTY_TYPES, CURRENCIES, TIMEZONES, LANGUAGES } from '../../constants/propertyOptions'

const MapPicker = lazy(() =>
  import('../../components/admin/MapPicker').then((m) => ({ default: m.MapPicker }))
)

const schema = z.object({
  hotel_name: z.string().min(1, 'Property name is required'),
  business_name: z.string().optional(),
  property_type: z.string().min(1, 'Property type is required'),
  description: z.string().optional(),
  contact_email: z.string().email('Valid email required'),
  contact_person: z.string().min(1, 'Contact person is required'),
  mobile_number: z.string().min(1, 'Mobile number is required'),
  telephone_number: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  province: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  address_line_1: z.string().min(1, 'Address is required'),
  address_line_2: z.string().optional(),
  postal_code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  owner_first_name: z.string().min(1, 'First name is required'),
  owner_last_name: z.string().min(1, 'Last name is required'),
  owner_email: z.string().email('Valid email required'),
  owner_mobile: z.string().optional(),
  default_currency: z.string().default('PHP'),
  timezone: z.string().default('Asia/Manila'),
  language: z.string().default('en'),
  banner_image_url: z.string().optional(),
  logo_url: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Credentials {
  username: string
  email: string
  temporary_password: string
}


function SectionCard({ id, number, title, children }: {
  id: string; number: number; title: string; children: React.ReactNode
}) {
  return (
    <div id={id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <span className="flex-none w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="px-6 py-5 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({ label, required, children, span2 }: {
  label: string; required?: boolean; children: React.ReactNode; span2?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

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
  label, required, value, onChange, folder,
}: {
  label: string; required?: boolean; value: string | undefined
  onChange: (url: string) => void; folder: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const { data } = await uploadApi(file, folder)
      onChange(data.url)
    } catch {
      // user will see no preview — they can retry
    }
    setUploading(false)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
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

function CredentialsModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function CopyBtn({ text, id }: { text: string; id: string }) {
    return (
      <button
        onClick={() => copy(text, id)}
        className="ml-2 text-slate-400 hover:text-slate-700 flex-none"
        title="Copy"
      >
        {copied === id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Check size={16} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Property Created</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5 ml-10">
          Share these credentials with the property administrator. The password cannot be recovered after closing this dialog.
        </p>

        {[
          { label: 'Email', value: creds.email, id: 'email' },
          { label: 'Username', value: creds.username, id: 'username' },
          { label: 'Temporary Password', value: creds.temporary_password, id: 'password' },
        ].map(({ label, value, id }) => (
          <div key={id} className="mb-3">
            <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <span className={`text-sm font-mono ${id === 'password' ? 'tracking-wider' : ''}`}>{value}</span>
              <CopyBtn text={value} id={id} />
            </div>
          </div>
        ))}

        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 mt-4">
          The administrator should change their password on first login.
        </p>
        <Button className="w-full mt-4" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

export function CreatePropertyPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      property_type: 'hotel',
      country: 'Philippines',
      default_currency: 'PHP',
      timezone: 'Asia/Manila',
      language: 'en',
    },
  })

  const lat = watch('latitude')
  const lng = watch('longitude')
  const bannerUrl = watch('banner_image_url')
  const logoUrl = watch('logo_url')

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      const { data } = await propertiesApi.create(values)
      setCredentials(data.credentials)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to create property.'
      toast.error(msg)
    }
    setSubmitting(false)
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        {/* Sticky header */}
        <div className="sticky top-0 z-[1100] bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/properties')}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-base font-semibold text-slate-900">New Property</h1>
                <p className="text-xs text-slate-400">Fill in the details below to register a new property</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => navigate('/admin/properties')}>Cancel</Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Property'}
              </Button>
            </div>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto px-6 py-8 space-y-6">

          {/* 1. Basic Information */}
          <SectionCard id="basic" number={1} title="Basic Information">
            <Field label="Property Name" required span2>
              <Input {...register('hotel_name')} placeholder="e.g. Sorsogon Bay Hotel" />
              {errors.hotel_name && <p className="text-xs text-red-500 mt-1">{errors.hotel_name.message}</p>}
            </Field>
            <Field label="Business Name">
              <Input {...register('business_name')} placeholder="Registered business name (if different)" />
            </Field>
            <Field label="Property Type" required>
              <SelectField
                options={PROPERTY_TYPES}
                value={watch('property_type')}
                onChange={(e) => setValue('property_type', e.target.value)}
              />
              {errors.property_type && <p className="text-xs text-red-500 mt-1">{errors.property_type.message}</p>}
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
          <SectionCard id="contact" number={2} title="Contact Information">
            <p className="sm:col-span-2 -mt-1 -mb-1 text-xs text-slate-400">
              Primary contact for billing and notifications.
            </p>
            <Field label="Contact Person" required>
              <Input {...register('contact_person')} placeholder="Full name" />
              {errors.contact_person && <p className="text-xs text-red-500 mt-1">{errors.contact_person.message}</p>}
            </Field>
            <Field label="Contact Email" required>
              <Input {...register('contact_email')} type="email" placeholder="property@example.com" />
              {errors.contact_email && <p className="text-xs text-red-500 mt-1">{errors.contact_email.message}</p>}
            </Field>
            <Field label="Mobile Number" required>
              <Input {...register('mobile_number')} placeholder="+63 917 000 0000" />
              {errors.mobile_number && <p className="text-xs text-red-500 mt-1">{errors.mobile_number.message}</p>}
            </Field>
            <Field label="Telephone Number">
              <Input {...register('telephone_number')} placeholder="+63 56 000 0000" />
            </Field>
          </SectionCard>

          {/* 3. Location */}
          <SectionCard id="location" number={3} title="Location">
            <Field label="Country" required>
              <Input {...register('country')} placeholder="Philippines" />
              {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country.message}</p>}
            </Field>
            <Field label="Province / State">
              <Input {...register('province')} placeholder="Sorsogon" />
            </Field>
            <Field label="City / Municipality" required>
              <Input {...register('city')} placeholder="Sorsogon City" />
              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
            </Field>
            <Field label="Postal Code">
              <Input {...register('postal_code')} placeholder="4700" />
            </Field>
            <Field label="Address Line 1" required span2>
              <Input {...register('address_line_1')} placeholder="Building / Street / Barangay" />
              {errors.address_line_1 && <p className="text-xs text-red-500 mt-1">{errors.address_line_1.message}</p>}
            </Field>
            <Field label="Address Line 2" span2>
              <Input {...register('address_line_2')} placeholder="Unit, Floor, Landmark (optional)" />
            </Field>

            {/* Coordinates */}
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

            {/* Map picker */}
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <MapPin size={12} /> Click on the map to set the exact location
              </p>
              <div className="rounded-xl overflow-hidden border border-slate-200 h-80">
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

          {/* 4. Property Administrator */}
          <SectionCard id="admin" number={4} title="Property Administrator">
            <p className="sm:col-span-2 -mt-1 -mb-1 text-xs text-slate-400">
              The system will generate login credentials and display them after creation.
            </p>
            <Field label="First Name" required>
              <Input {...register('owner_first_name')} placeholder="First name" />
              {errors.owner_first_name && <p className="text-xs text-red-500 mt-1">{errors.owner_first_name.message}</p>}
            </Field>
            <Field label="Last Name" required>
              <Input {...register('owner_last_name')} placeholder="Last name" />
              {errors.owner_last_name && <p className="text-xs text-red-500 mt-1">{errors.owner_last_name.message}</p>}
            </Field>
            <Field label="Email" required>
              <Input {...register('owner_email')} type="email" placeholder="owner@property.com" />
              {errors.owner_email && <p className="text-xs text-red-500 mt-1">{errors.owner_email.message}</p>}
            </Field>
            <Field label="Mobile Number">
              <Input {...register('owner_mobile')} placeholder="+63 917 000 0000" />
            </Field>
          </SectionCard>

          {/* 5. Settings */}
          <SectionCard id="settings" number={5} title="Property Settings">
            <Field label="Default Currency">
              <SelectField
                options={CURRENCIES}
                value={watch('default_currency')}
                onChange={(e) => setValue('default_currency', e.target.value)}
              />
            </Field>
            <Field label="Timezone">
              <SelectField
                options={TIMEZONES}
                value={watch('timezone')}
                onChange={(e) => setValue('timezone', e.target.value)}
              />
            </Field>
            <Field label="Language">
              <SelectField
                options={LANGUAGES}
                value={watch('language')}
                onChange={(e) => setValue('language', e.target.value)}
              />
            </Field>
          </SectionCard>

          {/* 6. Media */}
          <SectionCard id="media" number={6} title="Media">
            <Field label="Logo">
              <ImageUploadField
                label=""
                value={logoUrl}
                onChange={(url) => setValue('logo_url', url)}
                folder="logos"
              />
            </Field>
            <Field label="Banner Image">
              <ImageUploadField
                label=""
                value={bannerUrl}
                onChange={(url) => setValue('banner_image_url', url)}
                folder="banners"
              />
            </Field>
          </SectionCard>

          {/* Bottom action bar */}
          <div className="flex justify-end gap-2 pt-2 pb-8">
            <Button variant="secondary" type="button" onClick={() => navigate('/admin/properties')}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Property'}
            </Button>
          </div>
        </form>
      </div>

      {credentials && (
        <CredentialsModal
          creds={credentials}
          onClose={() => { setCredentials(null); navigate('/admin/properties') }}
        />
      )}
    </>
  )
}
