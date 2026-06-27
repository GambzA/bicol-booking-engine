import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { promotionsApi } from '../../../api/property/promotions'
import { PromotionForm, type PromotionFormValues } from './PromotionForm'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'

export function EditPromotionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<Partial<PromotionFormValues> | null>(null)

  useEffect(() => {
    if (!id) return
    promotionsApi
      .get(id)
      .then((r) => {
        const p = r.data
        setDefaults({
          name: p.name,
          description: p.description,
          is_active: p.is_active,
          discount_type: p.discount_type,
          discount_value: p.discount_value,
          stay_start_date: p.stay_start_date,
          stay_end_date: p.stay_end_date,
          booking_start_date: p.booking_start_date,
          booking_end_date: p.booking_end_date,
          promo_code: p.promo_code,
          accommodation_ids: (p.accommodations ?? []).map((a) => a.id),
          rate_plan_ids: (p.rate_plans ?? []).map((rp) => rp.id),
        })
      })
      .catch(() => {
        toast.error('Failed to load promotion.')
        navigate('/promotions')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: PromotionFormValues) => {
    if (!id) return
    setSaving(true)
    try {
      await promotionsApi.update(id, {
        name: values.name,
        description: values.description,
        is_active: values.is_active,
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        stay_start_date: values.stay_start_date,
        stay_end_date: values.stay_end_date,
        booking_start_date: values.booking_start_date,
        booking_end_date: values.booking_end_date,
        promo_code: values.promo_code,
        accommodation_ids: values.accommodation_ids,
        rate_plan_ids: values.rate_plan_ids,
      })
      toast.success('Promotion updated.')
      navigate('/promotions')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to update promotion.')
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return (
    <PromotionForm
      mode="edit"
      defaults={defaults ?? undefined}
      onSubmit={handleSubmit}
      saving={saving}
    />
  )
}
