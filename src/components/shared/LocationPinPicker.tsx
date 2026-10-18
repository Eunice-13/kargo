import { useEffect, useId, useRef, useState } from "react"
import { LoaderCircle, Search } from "lucide-react"
import L from "leaflet"

export type LocationPinValue = {
  lat?: number
  lng?: number
  url?: string
  address?: string
  isResolvingAddress?: boolean
}

type PhotonProperties = {
  osm_id?: number | string
  osm_type?: string
  name?: string
  housenumber?: string
  street?: string
  locality?: string
  district?: string
  city?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
}

type PhotonFeature = {
  properties?: PhotonProperties
  geometry?: {
    coordinates?: unknown[]
  }
}

type LocationSearchResult = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

const MANILA = { lat: 14.5995, lng: 120.9842 }

function photonResult(feature: PhotonFeature): LocationSearchResult | null {
  const coordinates = feature.geometry?.coordinates
  const properties = feature.properties
  const lng = Number(coordinates?.[0])
  const lat = Number(coordinates?.[1])
  if (!properties || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const name = properties.name?.trim() || properties.street?.trim() || "Location"
  const street = [properties.housenumber, properties.street]
    .filter(Boolean)
    .join(" ")
    .trim()
  const parts = [
    name,
    street,
    properties.locality,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
    properties.postcode,
    properties.country,
  ].filter((part): part is string => Boolean(part?.trim()))
  const uniqueParts = parts.filter(
    (part, index) =>
      parts.findIndex(
        (candidate) => candidate.toLowerCase() === part.toLowerCase(),
      ) === index,
  )
  const address = uniqueParts.join(", ")

  return {
    id: `${properties.osm_type ?? "place"}-${properties.osm_id ?? `${lat}-${lng}`}`,
    name,
    address,
    lat,
    lng,
  }
}

function photonResults(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return []
  const features = (payload as { features?: unknown }).features
  if (!Array.isArray(features)) return []
  return features
    .map((feature) => photonResult(feature as PhotonFeature))
    .filter((result): result is LocationSearchResult => result !== null)
}

export default function LocationPinPicker({
  value,
  onChange,
  readOnly = false,
}: {
  value: LocationPinValue
  onChange?: (value: LocationPinValue) => void
  readOnly?: boolean
}) {
  const mapId = useId().replace(/:/g, "")
  const resultListId = `${mapId}-results`
  const mapRef = useRef<L.Map | null>(null)
  const pinRef = useRef<L.CircleMarker | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const reverseAbortRef = useRef<AbortController | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const reverseTimerRef = useRef<number | null>(null)
  const searchTimerRef = useRef<number | null>(null)
  const reverseSequenceRef = useRef(0)
  const searchSequenceRef = useRef(0)
  const skipNextSearchRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState(value.address ?? "")
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState("")
  const [activeResultIndex, setActiveResultIndex] = useState(-1)

  valueRef.current = value
  onChangeRef.current = onChange

  const setQueryWithoutSearching = (query: string) => {
    skipNextSearchRef.current = true
    setSearchQuery(query)
  }

  const resolveAddress = async (
    lat: number,
    lng: number,
    requestSequence: number,
  ) => {
    if (requestSequence !== reverseSequenceRef.current) return
    reverseAbortRef.current?.abort()
    const controller = new AbortController()
    reverseAbortRef.current = controller

    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        lang: "en",
        limit: "1",
      })
      const response = await fetch(
        `https://photon.komoot.io/reverse?${params.toString()}`,
        { signal: controller.signal },
      )
      if (!response.ok) throw new Error("Address lookup failed")
      const [result] = photonResults(await response.json())
      const address = result?.address
      const nextValue = {
        ...valueRef.current,
        lat,
        lng,
        address,
        isResolvingAddress: false,
      }
      valueRef.current = nextValue
      onChangeRef.current?.(nextValue)
      if (address) setQueryWithoutSearching(address)
      setSearchMessage(
        address
          ? "Address found. Confirm the pin is in the correct spot."
          : "Pin selected. Confirm the coordinates below.",
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      const nextValue = {
        ...valueRef.current,
        lat,
        lng,
        address: undefined,
        isResolvingAddress: false,
      }
      valueRef.current = nextValue
      onChangeRef.current?.(nextValue)
      setSearchMessage(
        "The address could not be identified, but the selected map coordinates are saved.",
      )
    }
  }

  useEffect(() => {
    if (readOnly) return
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }

    const query = searchQuery.trim()
    searchAbortRef.current?.abort()
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    setActiveResultIndex(-1)

    if (query.length < 3) {
      searchSequenceRef.current += 1
      setSearching(false)
      setSearchResults([])
      setSearchMessage("")
      return
    }

    const requestSequence = ++searchSequenceRef.current
    setSearching(true)
    setSearchMessage("")
    searchTimerRef.current = window.setTimeout(async () => {
      const controller = new AbortController()
      searchAbortRef.current = controller

      try {
        const params = new URLSearchParams({
          q: query,
          limit: "10",
          countrycode: "PH",
          lang: "en",
          lat: String(valueRef.current.lat ?? MANILA.lat),
          lon: String(valueRef.current.lng ?? MANILA.lng),
          zoom: "8",
        })
        const response = await fetch(
          `https://photon.komoot.io/api/?${params.toString()}`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error("Location search failed")
        const results = photonResults(await response.json())
        if (requestSequence !== searchSequenceRef.current) return
        setSearchResults(results)
        setSearchMessage(
          results.length === 0
            ? "No matching places found. Add a city, province, or landmark."
            : "",
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        if (requestSequence !== searchSequenceRef.current) return
        setSearchResults([])
        setSearchMessage(
          "Suggestions are temporarily unavailable. You can still choose a pin on the map.",
        )
      } finally {
        if (requestSequence === searchSequenceRef.current) setSearching(false)
      }
    }, 400)

    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    }
  }, [readOnly, searchQuery])

  useEffect(() => {
    const center =
      value.lat != null && value.lng != null
        ? { lat: value.lat, lng: value.lng }
        : MANILA
    const map = L.map(mapId, {
      zoomControl: true,
      attributionControl: true,
      dragging: !readOnly,
      scrollWheelZoom: !readOnly,
      doubleClickZoom: !readOnly,
    }).setView([center.lat, center.lng], value.lat != null ? 15 : 11)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map)

    if (value.lat != null && value.lng != null) {
      pinRef.current = L.circleMarker([value.lat, value.lng], {
        radius: 8,
        color: "#191BA9",
        fillColor: "#191BA9",
        fillOpacity: 0.9,
      }).addTo(map)
    }

    if (!readOnly && onChangeRef.current) {
      map.on("click", (event: L.LeafletMouseEvent) => {
        const { lat, lng } = event.latlng
        pinRef.current?.remove()
        pinRef.current = L.circleMarker(event.latlng, {
          radius: 8,
          color: "#191BA9",
          fillColor: "#191BA9",
          fillOpacity: 0.9,
        }).addTo(map)
        searchAbortRef.current?.abort()
        setQueryWithoutSearching("")
        setSearchResults([])
        setSearchMessage("Finding the address for this pin...")
        const requestSequence = ++reverseSequenceRef.current
        const nextValue = { lat, lng, isResolvingAddress: true }
        valueRef.current = nextValue
        onChangeRef.current?.(nextValue)
        if (reverseTimerRef.current)
          window.clearTimeout(reverseTimerRef.current)
        reverseTimerRef.current = window.setTimeout(
          () => void resolveAddress(lat, lng, requestSequence),
          400,
        )
      })
    }

    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)
    return () => {
      reverseSequenceRef.current += 1
      searchSequenceRef.current += 1
      reverseAbortRef.current?.abort()
      searchAbortRef.current?.abort()
      if (reverseTimerRef.current) window.clearTimeout(reverseTimerRef.current)
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
      map.remove()
      mapRef.current = null
      pinRef.current = null
    }
  }, [mapId, readOnly])

  useEffect(() => {
    if (value.lat == null || value.lng == null || !mapRef.current) return
    pinRef.current?.remove()
    pinRef.current = L.circleMarker([value.lat, value.lng], {
      radius: 8,
      color: "#191BA9",
      fillColor: "#191BA9",
      fillOpacity: 0.9,
    }).addTo(mapRef.current)
    mapRef.current.setView([value.lat, value.lng], 15)
  }, [value.lat, value.lng])

  const selectSearchResult = (result: LocationSearchResult) => {
    reverseSequenceRef.current += 1
    reverseAbortRef.current?.abort()
    if (reverseTimerRef.current) window.clearTimeout(reverseTimerRef.current)
    setQueryWithoutSearching(result.address)
    setSearchResults([])
    setActiveResultIndex(-1)
    setSearchMessage("Location selected. Confirm the pin and address below.")
    const nextValue = {
      lat: result.lat,
      lng: result.lng,
      address: result.address,
      isResolvingAddress: false,
    }
    valueRef.current = nextValue
    onChange?.(nextValue)
  }

  const coordinateText =
    value.lat != null && value.lng != null
      ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`
      : null

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="space-y-2">
          <label
            htmlFor={`${mapId}-search`}
            className="block text-sm font-medium text-gray-700"
          >
            Delivery address
          </label>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              id={`${mapId}-search`}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={resultListId}
              aria-expanded={searchResults.length > 0}
              aria-activedescendant={
                activeResultIndex >= 0
                  ? `${mapId}-result-${activeResultIndex}`
                  : undefined
              }
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && searchResults.length > 0) {
                  event.preventDefault()
                  setActiveResultIndex((current) =>
                    Math.min(current + 1, searchResults.length - 1),
                  )
                } else if (
                  event.key === "ArrowUp" &&
                  searchResults.length > 0
                ) {
                  event.preventDefault()
                  setActiveResultIndex((current) => Math.max(current - 1, 0))
                } else if (event.key === "Enter" && searchResults.length > 0) {
                  event.preventDefault()
                  selectSearchResult(
                    searchResults[
                      activeResultIndex >= 0 ? activeResultIndex : 0
                    ],
                  )
                } else if (event.key === "Escape") {
                  setSearchResults([])
                  setActiveResultIndex(-1)
                }
              }}
              placeholder="Start typing a barangay, street, or landmark"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-10 text-sm"
            />
            {searching && (
              <LoaderCircle
                size={16}
                aria-label="Loading address suggestions"
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
              />
            )}
          </div>

          {searchResults.length > 0 && (
            <div
              id={resultListId}
              role="listbox"
              className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white"
              aria-label="Address suggestions"
            >
              {searchResults.map((result, index) => (
                <button
                  id={`${mapId}-result-${index}`}
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={activeResultIndex === index}
                  onMouseEnter={() => setActiveResultIndex(index)}
                  onClick={() => selectSearchResult(result)}
                  className={`block w-full px-3 py-2.5 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#191BA9] ${
                    index > 0 ? "border-t border-gray-100" : ""
                  } ${activeResultIndex === index ? "bg-gray-50" : ""}`}
                >
                  <span className="block text-sm font-medium text-gray-800">
                    {result.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-gray-500">
                    {result.address}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div aria-live="polite" aria-atomic="true">
            {searchMessage && (
              <p className="text-xs text-gray-500">{searchMessage}</p>
            )}
          </div>
        </div>
      )}

      <div
        id={mapId}
        className="kargo-location-map w-full overflow-hidden rounded-lg border border-gray-200"
        aria-label={
          readOnly ? "Delivery location map" : "Choose delivery location on map"
        }
      />

      {(value.address || coordinateText) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-gray-700">
            Selected address
          </p>
          <p className="mt-1 text-sm leading-5 text-gray-700">
            {value.address ?? "Address unavailable for this pin"}
          </p>
          {coordinateText && (
            <p className="mt-1 text-xs text-gray-500">Pin: {coordinateText}</p>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            Choose a suggestion above, or tap the map to fine-tune the pin.
          </p>
          <p className="text-[11px] text-gray-400">
            Address suggestions by Photon · Map data by OpenStreetMap
            contributors
          </p>
        </div>
      )}
    </div>
  )
}
