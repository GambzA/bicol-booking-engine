import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`
          block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent
          disabled:bg-slate-50 disabled:cursor-not-allowed
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
)

Input.displayName = 'Input'
