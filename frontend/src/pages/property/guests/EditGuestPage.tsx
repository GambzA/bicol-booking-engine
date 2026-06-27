import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { guestsApi, type DuplicateError } from '../../../api/property/guests'
import { GuestForm, type GuestFormValues } from './GuestForm'
import { PageLoader } from '../../../components/common/PageLoader'
import { useToast } from '../../../components/common/useToast'

export function EditGuestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaults, setDefaults] = useState<Partial<GuestFormValues> | null>(null)

  useEffect(() => {
    if (!id) return
    guestsApi
      .get(id)
      .then((r) => {
        const g = r.data
        setDefaults({
          first_name: g.first_name,
          last_name: g.last_name,
          email: g.email ?? '',
          mobile_number: g.mobile_number ?? '',
          date_of_birth: g.date_of_birth ?? '',
          nationality: g.nationality ?? '',
          address_line_1: g.address_line_1 ?? '',
          address_line_2: g.address_line_2 ?? '',
          city: g.city ?? '',
          state_province: g.state_province ?? '',
          postal_code: g.postal_code ?? '',
          country_id: g.country_id ?? '',
          notes: g.notes ?? '',
        })
      })
      .catch(() => {
        toast.error('Failed to load guest.')
        navigate('/guests')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: GuestFormValues) => {
    if (!id) return
    setSaving(true)
    try {
      await guestsApi.update(id, {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        mobile_number: values.mobile_number || null,
        date_of_birth: values.date_of_birth || null,
        nationality: values.nationality || null,
        address_line_1: values.address_line_1 || null,
        address_line_2: values.address_line_2 || null,
        city: values.city || null,
        state_province: values.state_province || null,
        postal_code: values.postal_code || null,
        country_id: values.country_id || null,
        notes: values.notes || null,
      })
      toast.success('Guest updated.')
      navigate(`/guests/${id}`)
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response
      if (resp?.status === 409) {
        const detail = resp.data?.detail as DuplicateError
        toast.error(detail.message)
      } else {
        const msg = (resp?.data?.detail as string) ?? 'Failed to update guest.'
        toast.error(msg)
      }
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return (
    <GuestForm
      mode="edit"
      defaults={defaults ?? undefined}
      onSubmit={handleSubmit}
      saving={saving}
    />
  )
}
