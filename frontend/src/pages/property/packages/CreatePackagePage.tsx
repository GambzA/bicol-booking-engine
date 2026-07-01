import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { packagesApi } from '../../../api/property/packages'
import { PackageForm, type PackageFormValues } from './PackageForm'
import { useToast } from '../../../components/common/useToast'

export function CreatePackagePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: PackageFormValues, accommodationIds: string[]) => {
    setSaving(true)
    try {
      await packagesApi.create({
        name: values.name,
        description: values.description,
        is_active: values.is_active,
        pricing_type: values.pricing_type,
        price_value: values.price_value,
        display_order: values.display_order,
        accommodation_ids: accommodationIds,
        inclusions: values.inclusions,
      })
      toast.success('Package created.')
      navigate('/packages')
    } catch {
      toast.error('Failed to create package.')
    }
    setSaving(false)
  }

  return <PackageForm mode="create" onSubmit={handleSubmit} saving={saving} />
}
