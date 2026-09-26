import { useState, useEffect } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { Card, SH, PrimaryBtn, PaymentIcon } from "@/components/shared"
import { METHOD_COLORS, isCashMethod } from "./buyerPaymentMethods"
import type { PayMethod } from "./paymentMethodTypes"
import AddPaymentMethodModal from "./AddPaymentMethodModal"
import EditPaymentMethodModal from "./EditPaymentMethodModal"
import RemovePaymentMethodModal from "./RemovePaymentMethodModal"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

// Seller-side payment-method management, matching the buyer-side card format:
// a "Payment Methods" section header with "+ Add Method" top-right, and a grid
// of cards (icon, method name, masked number, edit + delete icons).
export default function SellerPaymentMethods() {
  const [payMethods, setPayMethods] = useState<PayMethod[]>(
    isSupabaseConfigured
      ? []
      : [
          { id: 1, name: "GCash", detail: "09XX-XXX-8821", icon: "", verified: true },
          { id: 2, name: "Maya", detail: "09XX-XXX-5543", icon: "", verified: true },
        ],
  )
  const [showAddPM, setShowAddPM] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<PayMethod | null>(null)
  const [editTarget, setEditTarget] = useState<PayMethod | null>(null)
  const [pmType, setPmType] = useState("GCash")
  const [pmName, setPmName] = useState("")
  const [pmNum, setPmNum] = useState("")
  const [pmQr, setPmQr] = useState<File | null>(null)
  const [pmLoading, setPmLoading] = useState(false)
  const [editName, setEditName] = useState("")
  const [editNum, setEditNum] = useState("")
  const [editQr, setEditQr] = useState<File | null>(null)

  const refreshPaymentMethods = async () => {
    if (!isSupabaseConfigured) return
    const rows = await kargoApi.loadPaymentMethods()
    setPayMethods(
      rows.map((row) => ({
        id: row.id,
        name: row.method_type,
        detail: row.account_number ?? "",
        icon: "",
        verified: row.is_verified,
        qrUrl: kargoApi.paymentQrUrl(row.qr_path),
      })),
    )
  }

  useEffect(() => {
    void refreshPaymentMethods()
  }, [])

  const addPayMethod = async () => {
    const cash = isCashMethod(pmType)
    // Cash methods are label-only; other methods require name + number.
    if (!cash && (!pmName.trim() || !pmNum.trim())) return
    const name = cash ? "" : pmName.trim()
    const num = cash ? "" : pmNum.trim()
    setPmLoading(true)
    if (isSupabaseConfigured) {
      try {
        await kargoApi.addPaymentMethod(pmType, name, num, cash ? undefined : pmQr ?? undefined)
        await refreshPaymentMethods()
        setPmName("")
        setPmNum("")
        setPmQr(null)
        setPmLoading(false)
        setShowAddPM(false)
      } catch (error) {
        setPmLoading(false)
        alert(error instanceof Error ? error.message : "Unable to add payment method.")
      }
      return
    }
    setTimeout(() => {
      setPayMethods((prev) => [
        ...prev,
        { id: Date.now(), name: pmType, detail: num, icon: "", verified: false },
      ])
      setPmName("")
      setPmNum("")
      setPmLoading(false)
      setShowAddPM(false)
    }, 800)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    if (payMethods.length <= 1) return
    if (isSupabaseConfigured) {
      try {
        await kargoApi.deactivatePaymentMethod(String(removeTarget.id))
        await refreshPaymentMethods()
        setRemoveTarget(null)
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to remove payment method.")
      }
      return
    }
    setPayMethods((p) => p.filter((m) => m.id !== removeTarget.id))
    setRemoveTarget(null)
  }

  const openEdit = (m: PayMethod) => {
    setEditTarget(m)
    setEditName(m.name)
    setEditNum(m.detail)
    setEditQr(null)
  }

  const saveEdit = async () => {
    if (!editTarget || !editName.trim() || !editNum.trim()) return
    setPmLoading(true)
    if (isSupabaseConfigured) {
      try {
        await kargoApi.updatePaymentMethod(
          String(editTarget.id),
          editName.trim(),
          editNum.trim(),
          undefined,
          editQr ?? undefined,
        )
        await refreshPaymentMethods()
        setPmLoading(false)
        setEditQr(null)
        setEditTarget(null)
      } catch (error) {
        setPmLoading(false)
        alert(error instanceof Error ? error.message : "Unable to update payment method.")
      }
      return
    }
    setTimeout(() => {
      setPayMethods((p) =>
        p.map((m) => (m.id === editTarget.id ? { ...m, name: editName.trim(), detail: editNum.trim() } : m)),
      )
      setPmLoading(false)
      setEditQr(null)
      setEditTarget(null)
    }, 700)
  }

  return (
    <div>
      <SH
        title="Payment Methods"
        action={
          <PrimaryBtn size="sm" onClick={() => setShowAddPM(true)}>
            + Add Method
          </PrimaryBtn>
        }
      />
      {payMethods.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "8px 0" }}>
            No payment methods yet. Add one so buyers know how to pay you.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {payMethods.map((m) => {
            const color = METHOD_COLORS[m.name] ?? "#4B5563"
            return (
              <Card
                key={m.id}
                style={{ borderLeft: `4px solid ${color}` }}
                className="flex items-center gap-3"
              >
                {m.qrUrl ? (
                  <img
                    src={m.qrUrl}
                    alt={`${m.name} QR`}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      objectFit: "cover",
                      border: "1px solid #E5E7EB",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <span className="text-2xl" style={{ color }}>
                    <PaymentIcon method={m.name} size={22} />
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Josefin Sans',sans-serif",
                    }}
                  >
                    {m.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9CA3AF",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.detail || "—"}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => openEdit(m)}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#6B7280", padding: 4 }}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => setRemoveTarget(m)}
                    disabled={payMethods.length <= 1}
                    title={payMethods.length <= 1 ? "Keep at least one payment method" : undefined}
                    style={{
                      border: "none",
                      background: "none",
                      cursor: payMethods.length <= 1 ? "not-allowed" : "pointer",
                      color: payMethods.length <= 1 ? "#D1D5DB" : "#B91C1C",
                      padding: 4,
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showAddPM && (
        <AddPaymentMethodModal
          pmType={pmType}
          setPmType={setPmType}
          pmName={pmName}
          setPmName={setPmName}
          pmNum={pmNum}
          setPmNum={setPmNum}
          pmQr={pmQr}
          setPmQr={setPmQr}
          pmLoading={pmLoading}
          addPayMethod={addPayMethod}
          setShowAddPM={setShowAddPM}
        />
      )}
      {editTarget && (
        <EditPaymentMethodModal
          editTarget={editTarget}
          editName={editName}
          setEditName={setEditName}
          editNum={editNum}
          setEditNum={setEditNum}
          editQr={editQr}
          setEditQr={setEditQr}
          pmLoading={pmLoading}
          saveEdit={saveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {removeTarget && (
        <RemovePaymentMethodModal
          removeTarget={removeTarget}
          setRemoveTarget={setRemoveTarget}
          confirmRemove={confirmRemove}
          isLastMethod={payMethods.length <= 1}
        />
      )}
    </div>
  )
}
