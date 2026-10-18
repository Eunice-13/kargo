import { useState, useEffect } from "react"
import type React from "react"
import type { FulfillmentOrder } from "@/types"
import type { KanbanCol } from "@/constants/fulfillment"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { TrackingDetailsInput } from "./TrackingDetailsModal"

// Shared board behaviour: which card is expanded, moving a card between
// columns, screen-reader announcement, and keeping focus on the status select
// after the card jumps to another column.
export function useFulfillmentBoard(
  setFulfillment: React.Dispatch<React.SetStateAction<FulfillmentOrder[]>>,
) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [refocusId, setRefocusId] = useState<string | null>(null)

  const toggle = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id))

  const move = async (order: FulfillmentOrder, col: KanbanCol) => {
    if (order.col === col) return
    if (isSupabaseConfigured) {
      const status = {
        Claimed: "payment_submitted",
        "Pending Payment": "payment_pending",
        "Payment Confirmed": "payment_confirmed",
        Preparing: "preparing",
        Shipped: "shipped",
        "In Transit": "in_transit",
        Delivered: "completed",
        Cancelled: "cancelled",
      }[col]
      try {
        await kargoApi.setFulfillmentStatus(order.id, status)
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Unable to update fulfillment status.",
        )
        return
      }
    }
    setFulfillment((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, col } : o)),
    )
    setExpandedId(order.id)
    setAnnouncement(`Moved ${order.product} for ${order.buyer} to ${col}`)
    setRefocusId(order.id)
  }

  const saveTracking = async (
    order: FulfillmentOrder,
    tracking: TrackingDetailsInput,
  ) => {
    if (isSupabaseConfigured) {
      await kargoApi.setOrderTracking(order.id, tracking)
    }
    setFulfillment((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              courierCompany: tracking.courier,
              riderName: tracking.riderName,
              riderContact: tracking.riderContact,
              trackingNumber: tracking.trackingNumber,
              eta: tracking.eta,
              trackingUrl: tracking.trackingUrl,
            }
          : item,
      ),
    )
  }

  useEffect(() => {
    if (!refocusId) return
    document.getElementById(`fulfillment-status-${refocusId}`)?.focus()
    setRefocusId(null)
  }, [refocusId])

  return { expandedId, toggle, move, saveTracking, announcement }
}
