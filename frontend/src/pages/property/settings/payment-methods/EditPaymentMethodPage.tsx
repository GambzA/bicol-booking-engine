import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { paymentMethodsApi, type BankAccount } from '../../../../api/property/paymentMethods'
import { PaymentMethodForm, type PaymentMethodFormValues } from './PaymentMethodForm'
import { PageLoader } from '../../../../components/common/PageLoader'
import { useToast } from '../../../../components/common/useToast'

export function EditPaymentMethodPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [methodType, setMethodType] = useState('')
  const [defaults, setDefaults] = useState<{
    name: string
    is_enabled: boolean
    instructions: string | null
    deposit_required: boolean
    deposit_type: string | null
    deposit_value: string | null
    bank_accounts: BankAccount[]
  } | null>(null)

  useEffect(() => {
    if (!id) return
    paymentMethodsApi
      .get(id)
      .then((r) => {
        const pm = r.data
        setMethodType(pm.method_type)
        setDefaults({
          name: pm.name,
          is_enabled: pm.is_enabled,
          instructions: pm.instructions,
          deposit_required: pm.deposit_required,
          deposit_type: pm.deposit_type,
          deposit_value: pm.deposit_value,
          bank_accounts: pm.bank_accounts ?? [],
        })
      })
      .catch(() => {
        toast.error('Failed to load payment method.')
        navigate('/settings/payment-methods')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (values: PaymentMethodFormValues) => {
    if (!id) return
    setSaving(true)
    try {
      await paymentMethodsApi.update(id, {
        name: values.name,
        is_enabled: values.is_enabled,
        instructions: values.instructions,
        deposit_required: values.deposit_required,
        deposit_type: values.deposit_type,
        deposit_value: values.deposit_value,
        bank_accounts: values.bank_accounts,
      })
      toast.success('Payment method updated.')
      navigate('/settings/payment-methods')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to update payment method.')
    }
    setSaving(false)
  }

  if (loading) return <PageLoader />

  return <PaymentMethodForm mode="edit" methodType={methodType} defaults={defaults ?? undefined} onSubmit={handleSubmit} saving={saving} />
}
