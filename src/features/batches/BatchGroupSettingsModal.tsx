import { useState } from "react"

import type { BatchType, GroupDiscountType, SellingUnit } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { kargoApi } from "@/services"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function BatchGroupSettingsModal({
  batch,
  onSaved,
  onClose,
}: {
  batch: BatchType
  onSaved: (batch: BatchType) => void
  onClose: () => void
}) {
  const [enabled, setEnabled] = useState(Boolean(batch.groupOrdersEnabled))
  const [discountEnabled, setDiscountEnabled] = useState(
    Boolean(batch.groupDiscountType),
  )
  const [discountType, setDiscountType] = useState<GroupDiscountType>(
    batch.groupDiscountType ?? "percentage",
  )
  const [discountValue, setDiscountValue] = useState(
    batch.groupDiscountValue ? String(batch.groupDiscountValue) : "",
  )
  const [minimum, setMinimum] = useState(
    batch.groupDiscountMinSubtotal
      ? String(batch.groupDiscountMinSubtotal)
      : "",
  )
  const [units, setUnits] = useState(
    batch.products.map((product) => ({
      id: product.dbId ?? "",
      sellingUnit: product.sellingUnit ?? "piece" as SellingUnit,
      piecesPerBox: product.piecesPerBox ? String(product.piecesPerBox) : "",
    })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const save = async () => {
    if (
      units.some(
        (unit) =>
          unit.sellingUnit === "box" &&
          (!Number.isInteger(Number(unit.piecesPerBox)) || Number(unit.piecesPerBox) < 1),
      )
    ) {
      setError("Enter the number of pieces in every box item.")
      return
    }
    if (
      enabled &&
      discountEnabled &&
      (Number(discountValue) <= 0 ||
        (discountType === "percentage" && Number(discountValue) > 100))
    ) {
      setError("Enter a valid group discount.")
      return
    }

    setSaving(true)
    setError("")
    try {
      if (isSupabaseConfigured) {
        if (!batch.dbId || units.some((unit) => !unit.id)) {
          throw new Error("This batch is missing its database identifiers.")
        }
        await kargoApi.updateBatchGroupSettings({
          batchId: batch.dbId,
          enabled,
          discountType: enabled && discountEnabled ? discountType : undefined,
          discountValue:
            enabled && discountEnabled ? Number(discountValue) : undefined,
          discountMinSubtotal:
            enabled && discountEnabled && Number(minimum) > 0
              ? Number(minimum)
              : undefined,
          products: units.map((unit) => ({
            id: unit.id,
            sellingUnit: unit.sellingUnit,
            piecesPerBox:
              unit.sellingUnit === "box"
                ? Number(unit.piecesPerBox)
                : undefined,
          })),
        })
      }

      onSaved({
        ...batch,
        groupOrdersEnabled: enabled,
        groupDiscountType:
          enabled && discountEnabled ? discountType : undefined,
        groupDiscountValue:
          enabled && discountEnabled ? Number(discountValue) : undefined,
        groupDiscountMinSubtotal:
          enabled && discountEnabled && Number(minimum) > 0
            ? Number(minimum)
            : undefined,
        products: batch.products.map((product, index) => ({
          ...product,
          sellingUnit: units[index].sellingUnit,
          piecesPerBox:
            units[index].sellingUnit === "box"
              ? Number(units[index].piecesPerBox)
              : undefined,
        })),
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save group settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Selling Units & Group Orders" onClose={onClose} width={620}>
      <div className="batch-group-settings-modal">
        <section>
          <strong>Selling units</strong>
          {batch.products.map((product, index) => (
            <div className="batch-group-settings-product" key={product.dbId ?? product.name}>
              <span>{product.name}</span>
              <select
                value={units[index].sellingUnit}
                onChange={(event) =>
                  setUnits((current) =>
                    current.map((unit, unitIndex) =>
                      unitIndex === index
                        ? { ...unit, sellingUnit: event.target.value as SellingUnit }
                        : unit,
                    ),
                  )
                }
              >
                <option value="piece">Per Piece</option>
                <option value="box">Per Box</option>
              </select>
              {units[index].sellingUnit === "box" && (
                <input
                  type="number"
                  min="1"
                  value={units[index].piecesPerBox}
                  onChange={(event) =>
                    setUnits((current) =>
                      current.map((unit, unitIndex) =>
                        unitIndex === index
                          ? { ...unit, piecesPerBox: event.target.value }
                          : unit,
                      ),
                    )
                  }
                  placeholder="Pieces per box"
                />
              )}
            </div>
          ))}
        </section>

        <label className="batch-group-config__toggle">
          <span><strong>Allow Group Orders</strong><small>One group can combine any item in this batch.</small></span>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        </label>

        {enabled && (
          <section>
            <label className="batch-group-config__toggle batch-group-config__toggle--nested">
              <span><strong>Offer a group discount</strong><small>Optional. Shipping stays full price.</small></span>
              <input type="checkbox" checked={discountEnabled} onChange={(event) => setDiscountEnabled(event.target.checked)} />
            </label>
            {discountEnabled && (
              <div className="batch-group-discount-fields">
                <select value={discountType} onChange={(event) => setDiscountType(event.target.value as GroupDiscountType)}>
                  <option value="percentage">Percentage off</option>
                  <option value="fixed">Fixed amount off</option>
                </select>
                <input type="number" min="0.01" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder="Discount" />
                <input type="number" min="0" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="Minimum subtotal" />
              </div>
            )}
          </section>
        )}

        {error && <p className="group-order-error" role="alert">{error}</p>}
        <div className="kargo-modal-actions">
          <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          <PrimaryBtn loading={saving} onClick={save}>Save Settings</PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
