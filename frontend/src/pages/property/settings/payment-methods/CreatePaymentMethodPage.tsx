import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Landmark, Building2 } from 'lucide-react'
import { paymentMethodsApi } from '../../../../api/property/paymentMethods'
import { PaymentMethodForm, type PaymentMethodFormValues } from './PaymentMethodForm'
import { PAYMENT_METHOD_TYPES } from '../../../../constants/propertyOptions'
import { useToast } from '../../../../components/common/useToast'

const TYPE_ICONS: Record<string, typeof Landmark> = {
  bank_transfer: Landmark,
  pay_at_property: Building2,
}

export function CreatePaymentMethodPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const methodType = params.get('type') ?? ''
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (values: PaymentMethodFormValues) => {
    setSaving(true)
    try {
      await paymentMethodsApi.create({
        method_type: methodType,
        name: values.name,
        is_enabled: values.is_enabled,
        instructions: values.instructions,
        deposit_required: values.deposit_required,
        deposit_type: values.deposit_type,
        deposit_value: values.deposit_value,
        bank_accounts: values.bank_accounts,
      })
      toast.success('Payment method created.')
      navigate('/settings/payment-methods')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to create payment method.')
    }
    setSaving(false)
  }

  if (methodType !== 'bank_transfer' && methodType !== 'pay_at_property') {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <button onClick={() => navigate('/settings/payment-methods')} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Payment Methods
        </button>
        <h1 className="text-xl font-bold text-slate-900">Add a Payment Method</h1>
        <p className="mt-1 text-sm text-slate-500">Choose the type of payment method to configure.</p>
        <div className="mt-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {PAYMENT_METHOD_TYPES.map((t) => {
            const Icon = TYPE_ICONS[t.value]
            return (
              <button
                key={t.value}
                onClick={() => setParams({ type: t.value })}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-slate-400"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return <PaymentMethodForm mode="create" methodType={methodType} onSubmit={handleSubmit} saving={saving} />
}
