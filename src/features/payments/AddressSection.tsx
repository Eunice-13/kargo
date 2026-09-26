import { useCallback, useEffect, useState } from "react"
import { MapPin, Plus, AlertTriangle } from "lucide-react"
import { INDIGO, CREAM } from "@/constants/theme"
import { Card, SH, PrimaryBtn, SecondaryBtn, Modal, Toggle } from "@/components/shared"
import type { EntityId } from "@/types"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

type Address = {
  id: EntityId
  label: string
  line: string
  city: string
  isDefault: boolean
}

const SEED: Address[] = [
  {
    id: 1,
    label: "Home",
    line: "12 Mabini St., Barangay San Antonio",
    city: "Makati City",
    isDefault: true,
  },
]

// Shared Address section for the Payments tab (both Buyer and Seller). This is
// reference/coordination only — a saved detail both parties can view when
// arranging delivery or a meetup. It does not feed shipping/logistics.
export default function AddressSection() {
  const [addresses, setAddresses] = useState<Address[]>(isSupabaseConfigured ? [] : SEED)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<EntityId | null>(null)
  const [label, setLabel] = useState("")
  const [line, setLine] = useState("")
  const [city, setCity] = useState("")
  const [makeDefault, setMakeDefault] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Address | null>(null)

  const refreshAddresses = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const rows = await kargoApi.loadAddresses()
    setAddresses(rows.map((row) => ({
      id: row.id,
      label: row.label,
      line: row.address_line,
      city: row.city ?? "",
      isDefault: row.is_default,
    })))
  }, [])

  useEffect(() => {
    void refreshAddresses()
  }, [refreshAddresses])

  const openAdd = () => {
    setEditId(null)
    setLabel("")
    setLine("")
    setCity("")
    setMakeDefault(addresses.length === 0)
    setFormOpen(true)
  }

  const openEdit = (a: Address) => {
    setEditId(a.id)
    setLabel(a.label)
    setLine(a.line)
    setCity(a.city)
    setMakeDefault(a.isDefault)
    setFormOpen(true)
  }

  const save = async () => {
    if (!line.trim()) return
    const clean = {
      label: label.trim() || "Address",
      line: line.trim(),
      city: city.trim(),
    }
    if (isSupabaseConfigured) {
      try {
        await kargoApi.saveAddress({
          id: editId == null ? undefined : String(editId),
          label: clean.label,
          addressLine: clean.line,
          city: clean.city,
          isDefault: makeDefault,
        })
        await refreshAddresses()
        setFormOpen(false)
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to save address.")
      }
      return
    }
    setAddresses((prev) => {
      let next: Address[]
      if (editId != null) {
        next = prev.map((a) =>
          a.id === editId ? { ...a, ...clean, isDefault: makeDefault } : a,
        )
      } else {
        next = [
          ...prev,
          { id: Date.now(), ...clean, isDefault: makeDefault },
        ]
      }
      // Only one default at a time; if none is default, keep the first.
      if (makeDefault) {
        const targetId = editId != null ? editId : next[next.length - 1].id
        next = next.map((a) => ({ ...a, isDefault: a.id === targetId }))
      } else if (!next.some((a) => a.isDefault) && next.length > 0) {
        next = next.map((a, i) => ({ ...a, isDefault: i === 0 }))
      }
      return next
    })
    setFormOpen(false)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    if (isSupabaseConfigured) {
      try {
        await kargoApi.deleteAddress(String(removeTarget.id))
        await refreshAddresses()
        setRemoveTarget(null)
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to delete address.")
      }
      return
    }
    setAddresses((prev) => {
      const next = prev.filter((a) => a.id !== removeTarget.id)
      // If we removed the default, promote the first remaining address.
      if (removeTarget.isDefault && next.length > 0 && !next.some((a) => a.isDefault)) {
        return next.map((a, i) => ({ ...a, isDefault: i === 0 }))
      }
      return next
    })
    setRemoveTarget(null)
  }

  return (
    <div>
      <SH
        title="Address"
        action={
          <PrimaryBtn
            size="sm"
            onClick={openAdd}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <Plus size={13} aria-hidden="true" /> Add Address
          </PrimaryBtn>
        }
      />
      <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: -8, marginBottom: 12 }}>
        Saved meetup or delivery details for coordinating with the other party.
        For reference only — not used for automated shipping.
      </p>
      {addresses.length === 0 ? (
        <Card
          style={{
            textAlign: "center",
            padding: "24px 16px",
            color: "#9CA3AF",
            fontSize: 13,
          }}
        >
          No addresses saved yet. Add a meetup spot or delivery address.
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <Card key={a.id} className="flex items-start gap-3">
              <MapPin
                size={18}
                aria-hidden="true"
                style={{ color: INDIGO, flexShrink: 0, marginTop: 2 }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}
                  >
                    {a.label}
                  </span>
                  {a.isDefault && (
                    <span
                      style={{
                        background: "#EEF0FF",
                        color: INDIGO,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      Default
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                  {a.line}
                </div>
                {a.city && (
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>
                    {a.city}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
                <button
                  onClick={() => openEdit(a)}
                  style={{
                    color: "#374151",
                    background: "none",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setRemoveTarget(a)}
                  style={{
                    color: "#EF4444",
                    background: "none",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <Modal
          title={editId != null ? "Edit Address" : "Add Address"}
          onClose={() => setFormOpen(false)}
          width={440}
        >
          <div className="space-y-4">
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Label <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Home, Office, Meetup Spot"
                style={inputStyle}
                className="placeholder:text-gray-400"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Full Address / Meetup Location{" "}
                <span style={{ color: "#E11D2E" }}>*</span>
              </label>
              <textarea
                rows={3}
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="Street, barangay, building, landmark…"
                style={{ ...inputStyle, resize: "none" as const }}
                className="placeholder:text-gray-400"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                City / Municipality
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Quezon City"
                style={inputStyle}
                className="placeholder:text-gray-400"
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: CREAM,
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                Set as default
              </span>
              <Toggle on={makeDefault} onChange={setMakeDefault} />
            </div>
            <div className="flex gap-3 pt-1">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={save}
                disabled={!line.trim()}
              >
                {editId != null ? "Save Changes" : "Add Address"}
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {removeTarget && (
        <Modal
          title="Delete this address?"
          onClose={() => setRemoveTarget(null)}
          width={400}
        >
          <div className="space-y-4">
            <div
              style={{
                background: "#FFF7ED",
                border: "1px solid #FCD34D",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#92400E",
                display: "flex",
                gap: 8,
              }}
            >
              <AlertTriangle
                size={15}
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span>
                Delete <strong>{removeTarget.label}</strong> ({removeTarget.line}
                )? This can't be undone.
              </span>
            </div>
            <div className="flex gap-3">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </SecondaryBtn>
              <button
                onClick={confirmRemove}
                style={{
                  flex: 1,
                  background: "#EF4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Josefin Sans',sans-serif",
                }}
              >
                Delete Address
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

const inputStyle = {
  width: "100%",
  fontSize: 13,
  border: "1px solid #E5E7EB",
  borderRadius: 7,
  padding: "9px 12px",
  outline: "none",
  color: "#374151",
  fontFamily: "inherit",
  boxSizing: "border-box" as const,
}
