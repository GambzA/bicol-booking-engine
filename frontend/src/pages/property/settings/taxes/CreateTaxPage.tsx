import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { taxesApi } from '../../../../api/property/taxes'
import { TaxForm, type TaxFormValues } from './TaxForm'
import { useToast } from '../../../../components/common/useToast'

export function CreateTaxPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: TaxFormValues) => {
    setSaving(true)
    try {
      await taxesApi.create({
        name: values.name,
        description: values.description,
        tax_type: values.tax_type,
        rate: values.rate,
        calculation_method: values.calculation_method,
        application_scope: values.application_scope,
        is_active: values.is_active,
        display_order: values.display_order,
      })
      toast.success('Tax created.')
      navigate('/settings/taxes')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to create tax.')
    }
    setSaving(false)
  }

  return <TaxForm mode="create" onSubmit={handleSubmit} saving={saving} />
}
