import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Star, Upload, X } from 'lucide-react'
import { accommodationsApi } from '../../../../api/property/accommodations'
import type { BankAccount } from '../../../../api/property/paymentMethods'
import { Button } from '../../../../components/common/Button'
import { Input } from '../../../../components/common/Input'
import { SectionCard, Field, FormPage, FormHeader, FormBody } from '../../../../components/common/FormLayout'
import { PAYMENT_METHOD_TYPES, DEPOSIT_TYPES } from '../../../../constants/propertyOptions'
import { useToast } from '../../../../components/common/useToast'

export interface PaymentMethodFormValues {
  name: string
  is_enabled: boolean
  instructions: string | null
  deposit_required: boolean
  deposit_type: string | null
  deposit_value: string | null
  bank_accounts: BankAccount[]
}

export interface PaymentMethodFormProps {
  mode: 'create' | 'edit'
  methodType: string
  defaults?: {
    name?: string
    is_enabled?: boolean
    instructions?: string | null
    deposit_required?: boolean
    deposit_type?: string | null
    deposit_value?: string | null
    bank_accounts?: BankAccount[]
  }
  onSubmit: (values: PaymentMethodFormValues) => Promise<void>
  saving?: boolean
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  instructions: z.string().optional().default(''),
  deposit_value: z.string().optional().default(''),
})

type FormValues = z.infer<typeof schema>

const emptyAccount = (): BankAccount => ({
  account_name: '', bank_name: '', account_number: '',
  branch: '', swift_code: '', iban: '', qr_image_url: '', instructions: '', is_default: false,
})

const TYPE_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHOD_TYPES.map((t) => [t.value, t.label]))

export function PaymentMethodForm({ mode, methodType, defaults, onSubmit, saving }: PaymentMethodFormProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const isBank = methodType === 'bank_transfer'
  const isPap = methodType === 'pay_at_property'

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? TYPE_LABEL[methodType] ?? '',
      instructions: defaults?.instructions ?? '',
      deposit_value: defaults?.deposit_value ?? '',
    },
  })

  const [isEnabled, setIsEnabled] = useState(defaults?.is_enabled ?? false)
  const [depositRequired, setDepositRequired] = useState(defaults?.deposit_required ?? false)
  const [depositType, setDepositType] = useState(defaults?.deposit_type ?? 'percentage')
  const [accounts, setAccounts] = useState<BankAccount[]>(
    defaults?.bank_accounts && defaults.bank_accounts.length > 0
      ? defaults.bank_accounts.map((a) => ({ ...a }))
      : [],
  )
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const patchAccount = (i: number, patch: Partial<BankAccount>) =>
    setAccounts((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)))

  const addAccount = () => setAccounts((prev) => [...prev, { ...emptyAccount(), is_default: prev.length === 0 }])
  const removeAccount = (i: number) =>
    setAccounts((prev) => {
      const next = prev.filter((_, j) => j !== i)
      if (next.length > 0 && !next.some((a) => a.is_default)) next[0].is_default = true
      return next
    })
  const setDefault = (i: number) => setAccounts((prev) => prev.map((a, j) => ({ ...a, is_default: j === i })))

  const handleQrUpload = async (i: number, file: File) => {
    setUploadingIdx(i)
    try {
      const r = await accommodationsApi.uploadImage(file, 'payment_qr')
      patchAccount(i, { qr_image_url: r.data.url })
    } catch {
      toast.error('Failed to upload QR image.')
    }
    setUploadingIdx(null)
  }

  const handleFormSubmit = async (values: FormValues) => {
    if (isBank) {
      if (isEnabled && accounts.length === 0) {
        setFormError('Add at least one bank account before enabling Bank Transfer.')
        return
      }
      for (const a of accounts) {
        if (!a.account_name.trim() || !a.bank_name.trim() || !a.account_number.trim()) {
          setFormError('Each bank account needs an account name, bank name, and account number.')
          return
        }
      }
    }
    let depositValue: string | null = null
    if (isPap && depositRequired) {
      const val = parseFloat(values.deposit_value)
      if (isNaN(val) || val < 0) { setFormError('Deposit value must be zero or greater.'); return }
      if (depositType === 'percentage' && val > 100) { setFormError('Percentage deposit cannot exceed 100%.'); return }
      depositValue = String(val)
    }
    setFormError(null)
    await onSubmit({
      name: values.name,
      is_enabled: isEnabled,
      instructions: values.instructions || null,
      deposit_required: isPap ? depositRequired : false,
      deposit_type: isPap && depositRequired ? depositType : null,
      deposit_value: depositValue,
      bank_accounts: isBank ? accounts : [],
    })
  }

  return (
    <FormPage>
      <FormHeader
        onBack={() => navigate('/settings/payment-methods')}
        title={mode === 'create' ? `New ${TYPE_LABEL[methodType]}` : `Edit ${TYPE_LABEL[methodType]}`}
        subtitle={isBank ? 'Configure the bank accounts guests can transfer to' : 'Let guests settle on arrival, with an optional deposit'}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => navigate('/settings/payment-methods')}>Cancel</Button>
            <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <FormBody>
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</div>
          )}

          {/* 1. Basic Info */}
          <SectionCard number={1} title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Display Name" required error={errors.name?.message} span2>
                <Input {...register('name')} placeholder={TYPE_LABEL[methodType]} />
              </Field>
              <Field label="Enabled" span2>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setIsEnabled((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-slate-600">{isEnabled ? 'Available at checkout' : 'Hidden from checkout'}</span>
                </div>
              </Field>
              <Field label="Instructions" hint="Shown to the guest during checkout" span2>
                <textarea
                  {...register('instructions')}
                  rows={3}
                  placeholder={isBank ? 'e.g. Send proof of transfer to our email after paying.' : 'e.g. Please settle the balance at the front desk on arrival.'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
                />
              </Field>
            </div>
          </SectionCard>

          {/* 2a. Bank accounts */}
          {isBank && (
            <SectionCard number={2} title="Bank Accounts">
              {accounts.length === 0 ? (
                <p className="text-sm text-slate-400">No bank accounts yet. Add one so guests know where to pay.</p>
              ) : (
                <div className="space-y-4">
                  {accounts.map((a, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setDefault(i)}
                          className={`flex items-center gap-1.5 text-xs font-medium ${a.is_default ? 'text-amber-600' : 'text-slate-400 hover:text-slate-700'}`}
                        >
                          <Star size={14} className={a.is_default ? 'fill-amber-400 text-amber-500' : ''} />
                          {a.is_default ? 'Default account' : 'Set as default'}
                        </button>
                        <button type="button" onClick={() => removeAccount(i)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Account Name" required>
                          <Input value={a.account_name} onChange={(e) => patchAccount(i, { account_name: e.target.value })} placeholder="Account holder" />
                        </Field>
                        <Field label="Bank Name" required>
                          <Input value={a.bank_name} onChange={(e) => patchAccount(i, { bank_name: e.target.value })} placeholder="e.g. BDO" />
                        </Field>
                        <Field label="Account Number" required>
                          <Input value={a.account_number} onChange={(e) => patchAccount(i, { account_number: e.target.value })} placeholder="0000 0000 00" />
                        </Field>
                        <Field label="Branch">
                          <Input value={a.branch ?? ''} onChange={(e) => patchAccount(i, { branch: e.target.value })} placeholder="Optional" />
                        </Field>
                        <Field label="SWIFT Code">
                          <Input value={a.swift_code ?? ''} onChange={(e) => patchAccount(i, { swift_code: e.target.value })} placeholder="Optional" />
                        </Field>
                        <Field label="IBAN">
                          <Input value={a.iban ?? ''} onChange={(e) => patchAccount(i, { iban: e.target.value })} placeholder="Optional" />
                        </Field>
                        <Field label="Payment Instructions" span2>
                          <Input value={a.instructions ?? ''} onChange={(e) => patchAccount(i, { instructions: e.target.value })} placeholder="Optional note for this account" />
                        </Field>
                        <Field label="QR Code / Image" span2>
                          <div className="flex items-center gap-3">
                            {a.qr_image_url ? (
                              <div className="relative">
                                <img src={a.qr_image_url} alt="QR" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                                <button type="button" onClick={() => patchAccount(i, { qr_image_url: '' })} className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 text-slate-400 shadow hover:text-red-600">
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400">
                                <Upload size={15} />
                                {uploadingIdx === i ? 'Uploading...' : 'Upload QR'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQrUpload(i, f) }}
                                />
                              </label>
                            )}
                          </div>
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button className="mt-4" variant="secondary" type="button" onClick={addAccount}>
                <Plus size={15} /> Add bank account
              </Button>
            </SectionCard>
          )}

          {/* 2b. Deposit */}
          {isPap && (
            <SectionCard number={2} title="Deposit">
              <Field label="Require a deposit before confirming">
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setDepositRequired((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${depositRequired ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${depositRequired ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-slate-600">{depositRequired ? 'Deposit required' : 'No deposit'}</span>
                </div>
              </Field>

              {depositRequired && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Deposit Type">
                    <div className="grid grid-cols-2 gap-2">
                      {DEPOSIT_TYPES.map((d) => {
                        const sel = depositType === d.value
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setDepositType(d.value)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${sel ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                  <Field label={depositType === 'percentage' ? 'Deposit (%)' : 'Deposit Amount (₱)'}>
                    <Input type="number" min="0" step="0.01" max={depositType === 'percentage' ? 100 : undefined} {...register('deposit_value')} placeholder={depositType === 'percentage' ? '20' : '500.00'} />
                  </Field>
                </div>
              )}
            </SectionCard>
          )}

          <div className="flex justify-end gap-2 pb-8">
            <Button variant="secondary" type="button" onClick={() => navigate('/settings/payment-methods')}>Cancel</Button>
            <Button type="submit" loading={saving}>{mode === 'create' ? 'Create' : 'Save Changes'}</Button>
          </div>
        </FormBody>
      </form>
    </FormPage>
  )
}
