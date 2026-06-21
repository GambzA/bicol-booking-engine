import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: ReactNode
  variant?: 'default' | 'warning' | 'danger'
}

const variantClasses = {
  default: 'bg-white border-slate-200',
  warning: 'bg-yellow-50 border-yellow-200',
  danger: 'bg-red-50 border-red-200',
}

export function StatCard({ title, value, description, icon, variant = 'default' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${variantClasses[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
        {icon && <div className="text-slate-300">{icon}</div>}
      </div>
    </div>
  )
}
