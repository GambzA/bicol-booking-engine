import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { accommodationsApi, type AmenityItem, type AccommodationImage } from '../../../api/property/accommodations'
import { AccommodationForm, type AccommodationFormValues } from './AccommodationForm'
import { useToast } from '../../../components/common/useToast'

export function CreateAccommodationPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (
    values: AccommodationFormValues,
    amenities: AmenityItem[],
    images: AccommodationImage[],
  ) => {
    setSaving(true)
    try {
      await accommodationsApi.create({
        name: values.name,
        accommodation_type: values.accommodation_type,
        description: values.description || null,
        num_units: values.num_units,
        max_occupancy: values.max_occupancy,
        max_adults: values.max_adults ?? null,
        max_children: values.max_children ?? null,
        base_rate: String(values.base_rate),
        weekend_rate: values.weekend_rate != null ? String(values.weekend_rate) : null,
        check_in_time: values.check_in_time || null,
        check_out_time: values.check_out_time || null,
        unit_prefix: values.unit_prefix ?? null,
        amenities,
        images,
      })
      toast.success('Accommodation created.')
      navigate('/accommodations')
    } catch {
      toast.error('Failed to create accommodation.')
    }
    setSaving(false)
  }

  return <AccommodationForm mode="create" onSubmit={handleSubmit} saving={saving} />
}
