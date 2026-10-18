import { useEffect, useId, useMemo, useRef, useState } from "react"
import L from "leaflet"
import { ExternalLink, MapPinned } from "lucide-react"

import { courierTrackUrl, safeTrackingUrl } from "./courierTrackUrl"

const DEFAULT_DESTINATION = { lat: 14.5995, lng: 120.9842 }

export default function DeliveryPreviewCard({
  company,
  trackingNumber,
  trackingUrl,
  destinationLat,
  destinationLng,
  demo = false,
}: {
  company?: string
  trackingNumber?: string
  trackingUrl?: string
  destinationLat?: number
  destinationLng?: number
  demo?: boolean
}) {
  const mapId = useId().replace(/:/g, "")
  const mapRef = useRef<L.Map | null>(null)
  const riderRef = useRef<L.CircleMarker | null>(null)
  const [copied, setCopied] = useState(false)
  const destination = useMemo(
    () => ({
      lat: destinationLat ?? DEFAULT_DESTINATION.lat,
      lng: destinationLng ?? DEFAULT_DESTINATION.lng,
    }),
    [destinationLat, destinationLng],
  )
  const outboundUrl =
    safeTrackingUrl(trackingUrl) ?? courierTrackUrl(company, trackingNumber)

  useEffect(() => {
    const map = L.map(mapId, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    }).setView([destination.lat, destination.lng], 14)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map)
    L.circleMarker([destination.lat, destination.lng], {
      radius: 8,
      color: "#191BA9",
      fillColor: "#191BA9",
      fillOpacity: 0.95,
    })
      .bindTooltip("Delivery pin")
      .addTo(map)

    if (demo) {
      const path = [
        [destination.lat - 0.012, destination.lng - 0.014],
        [destination.lat - 0.008, destination.lng - 0.009],
        [destination.lat - 0.004, destination.lng - 0.005],
      ] as [number, number][]
      let position = 0
      riderRef.current = L.circleMarker(path[0], {
        radius: 7,
        color: "#F97316",
        fillColor: "#F97316",
        fillOpacity: 0.95,
      })
        .bindTooltip("Demo rider position")
        .addTo(map)
      const timer = window.setInterval(() => {
        position = (position + 1) % path.length
        riderRef.current?.setLatLng(path[position])
      }, 1800)
      window.setTimeout(() => map.invalidateSize(), 0)
      mapRef.current = map
      return () => {
        window.clearInterval(timer)
        map.remove()
      }
    }

    window.setTimeout(() => map.invalidateSize(), 0)
    mapRef.current = map
    return () => map.remove()
  }, [destination.lat, destination.lng, demo, mapId])

  const handleTracking = async () => {
    if (outboundUrl) {
      window.open(outboundUrl, "_blank", "noopener,noreferrer")
      return
    }
    if (!trackingNumber) return
    await navigator.clipboard.writeText(trackingNumber)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        id={mapId}
        className="kargo-delivery-preview w-full"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3 p-3 max-[480px]:items-stretch max-[480px]:flex-col">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPinned size={16} aria-hidden="true" /> Delivery route preview
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {demo
              ? "The moving rider marker is a demo preview, not live GPS."
              : "Open the courier page for the latest delivery status."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleTracking}
          disabled={!outboundUrl && !trackingNumber}
          className="kargo-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#191BA9] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <ExternalLink size={14} aria-hidden="true" />
          {outboundUrl
            ? "Open tracking"
            : copied
              ? "Copied"
              : "Copy tracking number"}
        </button>
      </div>
      {!outboundUrl && trackingNumber && (
        <p className="px-3 pb-3 text-xs text-gray-500">
          This courier has no stable public tracking link. Paste the copied
          number on its official tracking page.
        </p>
      )}
    </div>
  )
}
