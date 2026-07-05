import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Landmark, Building2 } from 'lucide-react'
import { paymentMethodsApi, type PaymentMethod } from '../../../../api/property/paymentMethods'
import { PAYMENT_METHOD_TYPES } from '../../../../constants/propertyOptions'
import { Button } from '../../../../components/common/Button'
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog'
import { useToast } from '../../../../components/common/useToast'

const TYPE_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_METHOD_TYPES.map((t) => [t.value, t.label]))
const TYPE_ICONS: Record<string, typeof Landmark> = { bank_transfer: Landmark, pay_at_property: Building2 }

export function PaymentMethodsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await paymentMethodsApi.list()
      setItems(r.data.items)
    } catch {
      toast.error('Failed to load payment methods.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleToggle = async (id: string) => {
    try {
      const r = await paymentMethodsApi.toggle(id)
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...r.data } : m)))
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await paymentMethodsApi.delete(deleteTarget.id)
      toast.success('Payment method deleted.')
      setDeleteTarget(null)
      fetchItems()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete payment method.')
    }
    setDeleting(false)
  }

  return (
    <div className="p-8">
      <button onClick={() => navigate('/settings')} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Settings
      </button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payment Methods</h1>
          <p className="mt-1 text-sm text-slate-500">Control how guests can pay for their bookings.</p>
        </div>
        <Button onClick={() => navigate('/settings/payment-methods/new')}>
          <Plus size={16} /> Add Payment Method
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
            <p className="text-sm font-medium text-slate-500">No payment methods yet</p>
            <p className="mt-1 text-xs text-slate-400">Add Bank Transfer or Pay at Property so guests can check out.</p>
          </div>
        ) : items.map((m) => {
          const Icon = TYPE_ICONS[m.method_type] ?? Landmark
          return (
            <div key={m.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <button onClick={() => navigate(`/settings/payment-methods/${m.id}/edit`)} className="text-sm font-semibold text-slate-800 hover:underline">
                  {m.name}
                </button>
                <p className="text-xs text-slate-400">
                  {TYPE_LABELS[m.method_type] ?? m.method_type}
                  {m.method_type === 'bank_transfer' ? ` · ${m.bank_account_count ?? 0} account(s)` : ''}
                  {m.method_type === 'pay_at_property' && m.deposit_required
                    ? ` · ${m.deposit_type === 'percentage' ? `${parseFloat(m.deposit_value ?? '0')}% deposit` : `₱${parseFloat(m.deposit_value ?? '0').toLocaleString('en-PH')} deposit`}`
                    : ''}
                </p>
              </div>
              <span className={`text-xs font-medium ${m.is_enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                {m.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => handleToggle(m.id)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${m.is_enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                title={m.is_enabled ? 'Enabled -- click to disable' : 'Disabled -- click to enable'}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${m.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => navigate(`/settings/payment-methods/${m.id}/edit`)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDeleteTarget(m)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Payment Method"
        message={`Delete "${deleteTarget?.name}"? Existing bookings keep the method they were created with.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
