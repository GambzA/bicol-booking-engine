import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, Check } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
  hint?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  /** Single-select mode: at most one option, picking one closes the menu. */
  single?: boolean
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled,
  className = '',
  single = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const updateCoords = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  useLayoutEffect(() => {
    if (!open) return
    updateCoords()
    const reposition = () => updateCoords()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const toggle = (v: string) => {
    if (single) {
      onChange([v])
      setOpen(false)
      return
    }
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options
  const allSelected = options.length > 0 && value.length === options.length

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? '1 selected'
        : `${value.length} selected`

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50 ${value.length === 0 ? 'text-slate-400' : 'text-slate-800'} ${className}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={16} className="flex-shrink-0 text-slate-400" />
      </button>

      {open && coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
            className="z-[1200] rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-2">
              <Search size={14} className="flex-shrink-0 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
            {!single && (
              <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="text-slate-400">{value.length} selected</span>
                <button
                  type="button"
                  onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            )}
            <ul className="max-h-56 overflow-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
              ) : (
                filtered.map((o) => {
                  const checked = value.includes(o.value)
                  return (
                    <li
                      key={o.value}
                      onMouseDown={(e) => { e.preventDefault(); toggle(o.value) }}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center border ${single ? 'rounded-full' : 'rounded'} ${checked ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300'}`}>
                        {checked && <Check size={12} />}
                      </span>
                      <span className="truncate">{o.label}</span>
                      {o.hint && <span className="ml-auto flex-shrink-0 text-xs text-slate-400">{o.hint}</span>}
                    </li>
                  )
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
