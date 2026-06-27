import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ratePlansApi } from '../../../api/property/ratePlans'
import { RatePlanForm, type RatePlanFormValues, type LinkedAccommodation } from './RatePlanForm'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'

export function EditRatePlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<{
    name: string
    description: string | null
    is_active: boolean
    pricing_method: string
    display_order: number
    accommodations: LinkedAccommodation[]
    inclusions: string[]
  } | null>(null)

  useEffect(() => {
    if (!id) return
    ratePlansApi
      .get(id)
      .then((r) => {
        const rp = r.data
        setDefaults({
          name: rp.name,
          description: rp.description,
          is_active: rp.is_active,
          pricing_method: rp.pricing_method,
          display_order: rp.display_order,
          accommodations: (rp.accommodations ?? []).map((a) => ({
            accommodation_id: a.accommodation_id,
            pricing_value: a.pricing_value,
          })),
          inclusions: rp.inclusions ?? [],
        })
      })
      .catch(() => {
        toast.error('Failed to load rate plan.')
        navigate('/rate-plans')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (
    values: RatePlanFormValues,
    linked: LinkedAccommodation[],
  ) => {
    if (!id) return
    setSaving(true)
    try {
      await ratePlansApi.update(id, {
        name: values.name,
        description: values.description,
        is_active: values.is_active,
        pricing_method: values.pricing_method,
        display_order: values.display_order,
        accommodations: linked,
        inclusions: values.inclusions,
      })
      toast.success('Rate plan updated.')
      navigate('/rate-plans')
    } catch {
      toast.error('Failed to update rate plan.')
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return (
    <RatePlanForm
      mode="edit"
      defaults={defaults ?? undefined}
      onSubmit={handleSubmit}
      saving={saving}
    />
  )
}
