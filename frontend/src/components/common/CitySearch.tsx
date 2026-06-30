import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { referenceApi, type ReferenceCity } from '../../api/reference'

interface CitySearchProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  countryId?: string | null
  disabled?: boolean
  id?: string
  placeholder?: string
}

export function CitySearch({
  value = '',
  onChange,
  onBlur,
  countryId,
  disabled,
  id,
  placeholder = 'Search city...',
}: CitySearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const [results, setResults] = useState<ReferenceCity[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

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
  }, [open, results.length])

  const handleInput = (raw: string) => {
    setInputValue(raw)
    onChange?.(raw)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (raw.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const items = await referenceApi.searchCities(raw.trim(), countryId || undefined)
        setResults(items)
        setOpen(items.length > 0)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
  }

  const select = (city: ReferenceCity) => {
    setInputValue(city.city_name)
    onChange?.(city.city_name)
    setOpen(false)
    setResults([])
  }

  const showMenu = open && results.length > 0 && coords

  return (
    <div ref={containerRef} className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className="block w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
      />
      {searching && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          Searching...
        </span>
      )}
      {showMenu &&
        createPortal(
          <ul
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
            className="z-[1200] max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {results.map((city) => (
              <li
                key={city.id}
                onMouseDown={() => select(city)}
                className="cursor-pointer px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              >
                {city.city_name}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
