import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../../components/common/Button'
import { Input } from '../../../components/common/Input'
import { Textarea } from '../../../components/common/Textarea'
import { CountrySelect } from '../../../components/common/CountrySelect'
import { ProvinceSelect } from '../../../components/common/ProvinceSelect'
import { CitySearch } from '../../../components/common/CitySearch'
import { NationalitySelect } from '../../../components/common/NationalitySelect'
import {
  SectionCard,
  Field,
  FormPage,
  FormHeader,
  FormBody,
} from '../../../components/common/FormLayout'
import { referenceApi, type ReferenceCountry } from '../../../api/reference'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), {
      message: 'Enter a valid email address',
    }),
  mobile_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state_province: z.string().optional(),
  postal_code: z.string().optional(),
  country_id: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Public types ─────────────────────────────────────────────────────────────

export type GuestFormValues = FormValues

interface Props {
  mode: 'create' | 'edit'
  defaults?: Partial<FormValues>
  onSubmit: (values: FormValues) => Promise<void>
  saving: boolean
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function GuestForm({ mode, defaults, onSubmit, saving }: Props) {
  const navigate = useNavigate()
  const [countries, setCountries] = useState<ReferenceCountry[]>([])
  const isFirstRender = useRef(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: defaults?.first_name ?? '',
      last_name: defaults?.last_name ?? '',
      email: defaults?.email ?? '',
      mobile_number: defaults?.mobile_number ?? '',
      date_of_birth: defaults?.date_of_birth ?? '',
      nationality: defaults?.nationality ?? '',
      address_line_1: defaults?.address_line_1 ?? '',
      address_line_2: defaults?.address_line_2 ?? '',
      city: defaults?.city ?? '',
      state_province: defaults?.state_province ?? '',
      postal_code: defaults?.postal_code ?? '',
      country_id: defaults?.country_id ?? '',
      notes: defaults?.notes ?? '',
    },
  })

  const countryId = watch('country_id')

  useEffect(() => {
    referenceApi.countries().then(setCountries).catch(() => {})
  }, [])

  // Auto-populate nationality; clear city and state when country changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const country = countries.find((c) => c.id === countryId)
    if (country?.nationality) {
      setValue('nationality', country.nationality)
    }
    setValue('city', '')
    setValue('state_province', '')
  }, [countryId]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = mode === 'create' ? 'Add Guest' : 'Edit Guest'
  const subtitle =
    mode === 'create'
      ? 'Create a new guest profile'
      : 'Update guest details'

  return (
    <FormPage>
      <FormHeader
        onBack={() => navigate('/guests')}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => navigate('/guests')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>
              {mode === 'create' ? 'Add Guest' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormBody>
          {/* 1. Personal Information */}
          <SectionCard number={1} title="Personal Information" grid>
            <Field label="First Name" required error={errors.first_name?.message}>
              <Input {...register('first_name')} placeholder="e.g. Peter" />
            </Field>

            <Field label="Last Name" required error={errors.last_name?.message}>
              <Input {...register('last_name')} placeholder="e.g. Santos" />
            </Field>

            <Field label="Date of Birth">
              <Input type="date" {...register('date_of_birth')} />
            </Field>

            <Field label="Nationality" hint="Auto-filled when country is selected">
              <Controller
                name="nationality"
                control={control}
                render={({ field }) => (
                  <NationalitySelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Field>
          </SectionCard>

          {/* 2. Contact Information */}
          <SectionCard number={2} title="Contact Information" grid>
            <Field label="Email Address" error={errors.email?.message}>
              <Input type="email" {...register('email')} placeholder="e.g. peter@email.com" />
            </Field>

            <Field label="Mobile Number">
              <Input {...register('mobile_number')} placeholder="e.g. +63 917 123 4567" />
            </Field>
          </SectionCard>

          {/* 3. Address */}
          <SectionCard number={3} title="Address" grid>
            <Field label="Address Line 1" span2>
              <Input {...register('address_line_1')} placeholder="Street address, building, unit" />
            </Field>

            <Field label="Address Line 2" span2>
              <Input {...register('address_line_2')} placeholder="Apartment, suite, floor (optional)" />
            </Field>

            <Field label="Country">
              <Controller
                name="country_id"
                control={control}
                render={({ field }) => (
                  <CountrySelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Field>

            <Field label="State / Province">
              <Controller
                name="state_province"
                control={control}
                render={({ field }) => (
                  <ProvinceSelect
                    countryId={countryId || null}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Field>

            <Field label="City">
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <CitySearch
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    countryId={countryId || null}
                    placeholder="Search city..."
                  />
                )}
              />
            </Field>

            <Field label="Postal Code">
              <Input {...register('postal_code')} placeholder="e.g. 1000" />
            </Field>
          </SectionCard>

          {/* 4. Notes */}
          <SectionCard number={4} title="Notes">
            <Textarea
              {...register('notes')}
              placeholder="Internal notes visible to authorized staff only..."
              rows={4}
            />
          </SectionCard>

          <div className="flex justify-end gap-2 pb-8">
            <Button variant="secondary" type="button" onClick={() => navigate('/guests')}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {mode === 'create' ? 'Add Guest' : 'Save Changes'}
            </Button>
          </div>
        </FormBody>
      </form>
    </FormPage>
  )
}
