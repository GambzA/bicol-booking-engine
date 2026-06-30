import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { referenceApi } from '../../api/reference'

interface NationalitySelectProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  id?: string
}

export function NationalitySelect({
  value = '',
  onChange,
  onBlur,
  disabled,
  id,
}: NationalitySelectProps) {
  const [nationalities, setNationalities] = useState<string[]>([])
  const [inputValue, setInputValue] = useState(value)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    referenceApi.countries().then((countries) => {
      const unique = Array.from(
        new Set(countries.map((c) => c.nationality).filter(Boolean) as string[])
      ).sort()
      setNationalities(unique)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close when clicking outside both the input and the portaled menu.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = inputValue.trim()
    ? nationalities.filter((n) => n.toLowerCase().includes(inputValue.trim().toLowerCase()))
    : nationalities

  const updateCoords = () => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  // The menu is portaled to <body> with fixed positioning so the section
  // card's `overflow-hidden` can't clip it. Keep it anchored on scroll/resize.
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
  }, [open, filtered.length])

  const handleInput = (raw: string) => {
    setInputValue(raw)
    onChange?.(raw)
    setOpen(true)
  }

  const select = (nat: string) => {
    setInputValue(nat)
    onChange?.(nat)
    setOpen(false)
  }

  const inputClass =
    'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed'

  const showMenu = open && filtered.length > 0 && coords

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="Select or type nationality..."
        autoComplete="off"
        className={inputClass}
      />
      {showMenu &&
        createPortal(
          <ul
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
            className="z-[1200] max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {filtered.map((nat) => (
              <li
                key={nat}
                onMouseDown={() => select(nat)}
                className="cursor-pointer px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              >
                {nat}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
