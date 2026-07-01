import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { packagesApi } from '../../../api/property/packages'
import { PackageForm, type PackageFormValues } from './PackageForm'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'

export function EditPackagePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<{
    name: string
    description: string | null
    is_active: boolean
    pricing_type: string
    price_value: string
    display_order: number
    accommodation_ids: string[]
    inclusions: string[]
  } | null>(null)

  useEffect(() => {
    if (!id) return
    packagesApi
      .get(id)
      .then((r) => {
        const pkg = r.data
        const accs = (pkg.accommodations ?? []) as { id?: string; accommodation_id?: string }[]
        setDefaults({
          name: pkg.name,
          description: pkg.description,
          is_active: pkg.is_active,
          pricing_type: pkg.pricing_type,
          price_value: pkg.price_value,
          display_order: pkg.display_order,
          accommodation_ids: accs.map((a) => a.id ?? a.accommodation_id ?? '').filter(Boolean),
          inclusions: pkg.inclusions ?? [],
        })
      })
      .catch(() => {
        toast.error('Failed to load package.')
        navigate('/packages')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: PackageFormValues, accommodationIds: string[]) => {
    if (!id) return
    setSaving(true)
    try {
      await packagesApi.update(id, {
        name: values.name,
        description: values.description,
        is_active: values.is_active,
        pricing_type: values.pricing_type,
        price_value: values.price_value,
        display_order: values.display_order,
        accommodation_ids: accommodationIds,
        inclusions: values.inclusions,
      })
      toast.success('Package updated.')
      navigate('/packages')
    } catch {
      toast.error('Failed to update package.')
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return <PackageForm mode="edit" defaults={defaults ?? undefined} onSubmit={handleSubmit} saving={saving} />
}
