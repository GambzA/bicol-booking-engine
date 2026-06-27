import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { guestsApi, type DuplicateError } from '../../../api/property/guests'
import { GuestForm, type GuestFormValues } from './GuestForm'
import { useToast } from '../../../components/common/useToast'

interface DuplicateInfo {
  message: string
  existing: DuplicateError['existing']
  pendingValues: GuestFormValues
}

export function CreateGuestPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)

  const submitGuest = async (values: GuestFormValues, force: boolean) => {
    setSaving(true)
    try {
      await guestsApi.create(
        {
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
        },
        force
      )
      toast.success('Guest created.')
      navigate('/guests')
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response
      if (resp?.status === 409) {
        const detail = resp.data?.detail as DuplicateError
        setDuplicate({ message: detail.message, existing: detail.existing, pendingValues: values })
      } else {
        const detail = (resp?.data?.detail as string) ?? 'Failed to create guest.'
        toast.error(detail)
      }
    }
    setSaving(false)
  }

  const handleSubmit = async (values: GuestFormValues) => {
    await submitGuest(values, false)
  }

  const handleForceCreate = async () => {
    if (!duplicate) return
    await submitGuest(duplicate.pendingValues, true)
    setDuplicate(null)
  }

  return (
    <>
      <GuestForm mode="create" onSubmit={handleSubmit} saving={saving} />

      {duplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Possible Duplicate Guest</h3>
            <p className="text-sm text-slate-600 mb-4">{duplicate.message}</p>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-5 text-sm text-amber-900">
              <p className="font-medium">{duplicate.existing.full_name}</p>
              {duplicate.existing.email && (
                <p className="text-xs mt-0.5">{duplicate.existing.email}</p>
              )}
              {duplicate.existing.mobile_number && (
                <p className="text-xs">{duplicate.existing.mobile_number}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  navigate(`/guests/${duplicate.existing.id}`)
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Existing Guest
              </button>
              <button
                onClick={handleForceCreate}
                disabled={saving}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Anyway'}
              </button>
              <button
                onClick={() => setDuplicate(null)}
                className="w-full text-sm text-slate-500 hover:text-slate-700 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
