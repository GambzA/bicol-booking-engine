import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ratePlansApi } from '../../../api/property/ratePlans'
import { RatePlanForm, type RatePlanFormValues, type LinkedAccommodation } from './RatePlanForm'
import { useToast } from '../../../components/common/useToast'

export function CreateRatePlanPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (
    values: RatePlanFormValues,
    linked: LinkedAccommodation[],
  ) => {
    setSaving(true)
    try {
      await ratePlansApi.create({
        name: values.name,
        description: values.description,
        is_active: values.is_active,
        pricing_method: values.pricing_method,
        display_order: values.display_order,
        accommodations: linked,
        inclusions: values.inclusions,
      })
      toast.success('Rate plan created.')
      navigate('/rate-plans')
    } catch {
      toast.error('Failed to create rate plan.')
    }
    setSaving(false)
  }

  return <RatePlanForm mode="create" onSubmit={handleSubmit} saving={saving} />
}
