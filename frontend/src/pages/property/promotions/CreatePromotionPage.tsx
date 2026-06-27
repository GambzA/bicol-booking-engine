import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { promotionsApi } from '../../../api/property/promotions'
import { PromotionForm, type PromotionFormValues } from './PromotionForm'
import { useToast } from '../../../components/common/useToast'

export function CreatePromotionPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: PromotionFormValues) => {
    setSaving(true)
    try {
      await promotionsApi.create({
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
      toast.success('Promotion created.')
      navigate('/promotions')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to create promotion.')
    }
    setSaving(false)
  }

  return <PromotionForm mode="create" onSubmit={handleSubmit} saving={saving} />
}
