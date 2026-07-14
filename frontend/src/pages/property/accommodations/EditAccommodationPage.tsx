import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { accommodationsApi, type AmenityItem, type AccommodationImage } from '../../../api/property/accommodations'
import { AccommodationForm, type AccommodationFormValues, type AccommodationFormDefaults } from './AccommodationForm'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'

export function EditAccommodationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<AccommodationFormDefaults | null>(null)

  useEffect(() => {
    if (!id) return
    accommodationsApi
      .get(id)
      .then((r) => setDefaults({
        ...r.data,
        child_policies: r.data.child_policies.map((p) => ({
          min_age: p.min_age,
          max_age: p.max_age,
          charge_type: p.charge_type,
          charge_value: p.charge_value != null ? Number(p.charge_value) : null,
          sort_order: p.sort_order,
        })),
      }))
      .catch(() => toast.error('Failed to load accommodation.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (
    values: AccommodationFormValues,
    amenities: AmenityItem[],
    images: AccommodationImage[],
  ) => {
    if (!id) return
    setSaving(true)
    try {
      await accommodationsApi.update(id, {
        name: values.name,
        accommodation_type: values.accommodation_type,
        description: values.description || null,
        num_units: values.num_units,
        base_occupancy: values.base_occupancy,
        max_occupancy: values.max_occupancy,
        max_adults: values.max_adults ?? null,
        max_children: values.max_children ?? null,
        base_rate: String(values.base_rate),
        weekend_rate: values.weekend_rate != null ? String(values.weekend_rate) : null,
        additional_adult_fee: String(values.additional_adult_fee),
        additional_adult_requires_extra_bed: values.additional_adult_requires_extra_bed,
        extra_bed_fee: values.extra_bed_fee != null ? String(values.extra_bed_fee) : null,
        check_in_time: values.check_in_time || null,
        check_out_time: values.check_out_time || null,
        amenities,
        images,
        child_policies: values.child_policies.map((p, i) => ({
          min_age: p.min_age,
          max_age: p.max_age,
          charge_type: p.charge_type,
          charge_value: p.charge_value != null ? String(p.charge_value) : null,
          sort_order: i,
        })),
      })
      toast.success('Accommodation updated.')
      navigate('/accommodations')
    } catch {
      toast.error('Failed to update accommodation.')
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return (
    <AccommodationForm
      mode="edit"
      defaults={defaults ?? undefined}
      onSubmit={handleSubmit}
      saving={saving}
    />
  )
}
