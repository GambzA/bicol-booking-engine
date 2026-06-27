import { ArrowLeft } from 'lucide-react'

// ─── SectionCard ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  id?: string
  number: number
  title: string
  children: React.ReactNode
  grid?: boolean
}

export function SectionCard({ id, number, title, children, grid = false }: SectionCardProps) {
  return (
    <div id={id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <span className="flex-none w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className={`px-6 py-5${grid ? ' grid grid-cols-1 gap-4 sm:grid-cols-2' : ''}`}>
        {children}
      </div>
    </div>
  )
}

// ─── Field ───────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  span2?: boolean
  hint?: string
  children: React.ReactNode
}

export function Field({ label, required, error, span2, hint, children }: FieldProps) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── FormPage ─────────────────────────────────────────────────────────────────

export function FormPage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>
}

// ─── FormHeader ───────────────────────────────────────────────────────────────

interface FormHeaderProps {
  onBack: () => void
  title: string
  subtitle?: string
  actions: React.ReactNode
}

export function FormHeader({ onBack, title, subtitle, actions }: FormHeaderProps) {
  return (
    <div className="sticky top-0 z-[1100] bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </div>
  )
}

// ─── FormBody ─────────────────────────────────────────────────────────────────

export function FormBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {children}
    </div>
  )
}
