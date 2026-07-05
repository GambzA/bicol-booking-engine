import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { billableItemsApi } from '../../../api/property/billableItems'
import { BillableItemForm, type BillableItemFormValues } from './BillableItemForm'
import { useToast } from '../../../components/common/useToast'

export function CreateBillableItemPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: BillableItemFormValues, accommodationIds: string[], ratePlanIds: string[]) => {
    setSaving(true)
    try {
      await billableItemsApi.create({
        ...values,
        accommodation_ids: accommodationIds,
        rate_plan_ids: ratePlanIds,
      })
      toast.success('Billable item created.')
      navigate('/billable-items')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to create billable item.')
    }
    setSaving(false)
  }

  return <BillableItemForm mode="create" onSubmit={handleSubmit} saving={saving} />
}
