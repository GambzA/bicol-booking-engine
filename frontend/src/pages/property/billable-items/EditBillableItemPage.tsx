import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { billableItemsApi } from '../../../api/property/billableItems'
import { BillableItemForm, type BillableItemFormValues } from './BillableItemForm'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'

export function EditBillableItemPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<
    (Partial<BillableItemFormValues> & { accommodation_ids?: string[]; rate_plan_ids?: string[] }) | null
  >(null)

  useEffect(() => {
    if (!id) return
    billableItemsApi
      .get(id)
      .then((r) => {
        const item = r.data
        setDefaults({
          name: item.name,
          description: item.description,
          category: item.category,
          pricing_type: item.pricing_type,
          unit_price: item.unit_price,
          is_taxable: item.is_taxable,
          is_active: item.is_active,
          display_order: item.display_order,
          applies_to_all_accommodations: item.applies_to_all_accommodations,
          applies_to_all_rate_plans: item.applies_to_all_rate_plans,
          available_at_booking: item.available_at_booking,
          available_at_checkin: item.available_at_checkin,
          available_at_stay: item.available_at_stay,
          available_at_checkout: item.available_at_checkout,
          accommodation_ids: (item.accommodations ?? []).map((a) => a.accommodation_id),
          rate_plan_ids: (item.rate_plans ?? []).map((rp) => rp.rate_plan_id),
        })
      })
      .catch(() => {
        toast.error('Failed to load billable item.')
        navigate('/billable-items')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: BillableItemFormValues, accommodationIds: string[], ratePlanIds: string[]) => {
    if (!id) return
    setSaving(true)
    try {
      await billableItemsApi.update(id, {
        ...values,
        accommodation_ids: accommodationIds,
        rate_plan_ids: ratePlanIds,
      })
      toast.success('Billable item updated.')
      navigate('/billable-items')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to update billable item.')
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return <BillableItemForm mode="edit" defaults={defaults ?? undefined} onSubmit={handleSubmit} saving={saving} />
}
