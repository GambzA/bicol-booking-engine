import { useNavigate } from 'react-router-dom'
import { Receipt, CreditCard, ChevronRight } from 'lucide-react'

const SETTINGS = [
  {
    to: '/settings/taxes',
    icon: Receipt,
    title: 'Tax Configuration',
    description: 'Configure the taxes applied to your bookings (VAT, service charge, fees).',
  },
  {
    to: '/settings/payment-methods',
    icon: CreditCard,
    title: 'Payment Methods',
    description: 'Configure how guests pay: bank transfer accounts and pay-at-property deposits.',
  },
]

export function SettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage property-wide configuration.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS.map(({ to, icon: Icon, title, description }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-slate-400"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                {title} <ChevronRight size={14} className="text-slate-400" />
              </p>
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
