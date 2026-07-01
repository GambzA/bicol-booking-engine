import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { taxesApi } from '../../../../api/property/taxes'
import { TaxForm, type TaxFormValues } from './TaxForm'
import { PageLoader } from '../../../../components/common/PageLoader'
import { useToast } from '../../../../components/common/useToast'

export function EditTaxPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<{
    name: string
    description: string | null
    tax_type: string
    rate: string
    calculation_method: string
    application_scope: string
    is_active: boolean
    display_order: number
  } | null>(null)

  useEffect(() => {
    if (!id) return
    taxesApi
      .get(id)
      .then((r) => {
        const t = r.data
        setDefaults({
          name: t.name,
          description: t.description,
          tax_type: t.tax_type,
          rate: t.rate,
          calculation_method: t.calculation_method,
          application_scope: t.application_scope,
          is_active: t.is_active,
          display_order: t.display_order,
        })
      })
      .catch(() => {
        toast.error('Failed to load tax.')
        navigate('/settings/taxes')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: TaxFormValues) => {
    if (!id) return
    setSaving(true)
    try {
      await taxesApi.update(id, {
        name: values.name,
        description: values.description,
        tax_type: values.tax_type,
        rate: values.rate,
        calculation_method: values.calculation_method,
        application_scope: values.application_scope,
        is_active: values.is_active,
        display_order: values.display_order,
      })
      toast.success('Tax updated.')
      navigate('/settings/taxes')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to update tax.')
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return <TaxForm mode="edit" defaults={defaults ?? undefined} onSubmit={handleSubmit} saving={saving} />
}
