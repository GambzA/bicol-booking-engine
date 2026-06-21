import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={3}
        className={`
          block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 resize-none
          focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent
          ${error ? 'border-red-400' : 'border-slate-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
)

Textarea.displayName = 'Textarea'
