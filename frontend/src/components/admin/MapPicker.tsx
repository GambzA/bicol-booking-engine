import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, ZoomControl, useMapEvents, useMap } from 'react-leaflet'
import { Search, Loader } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER: [number, number] = [12.9716, 124.0027] // Sorsogon

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 15, { animate: true, duration: 1 })
  }, [lat, lng, map])
  return null
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | undefined
  lng: number | undefined
  onPick: (lat: number, lng: number) => void
}) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    import('leaflet').then((mod) => {
      const L = mod.default
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
    })
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    setResults([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) return
    debounceRef.current = setTimeout(() => searchLocation(value), 500)
  }

  async function searchLocation(q: string) {
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
    } catch {
      // silently fail — user can still click map manually
    }
    setSearching(false)
  }

  function selectResult(r: NominatimResult) {
    const la = parseFloat(r.lat)
    const lo = parseFloat(r.lon)
    setQuery(r.display_name)
    setResults([])
    onPick(parseFloat(la.toFixed(7)), parseFloat(lo.toFixed(7)))
    setFlyTarget({ lat: la, lng: lo })
  }

  const center: [number, number] = [lat ?? DEFAULT_CENTER[0], lng ?? DEFAULT_CENTER[1]]

  return (
    <div className="relative h-full w-full">
      {/* Search box — offset left to clear the zoom controls (~36px wide + 10px margin) */}
      <div className="absolute top-2 left-12 right-2 z-[1000]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          {searching && (
            <Loader size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search location..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-8 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        {results.length > 0 && (
          <ul className="mt-1 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 leading-snug"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MapContainer center={center} zoom={13} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <ZoomControl position="topleft" />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ClickHandler onPick={onPick} />
        {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
        {lat != null && lng != null && <Marker position={[lat, lng]} />}
      </MapContainer>
    </div>
  )
}
