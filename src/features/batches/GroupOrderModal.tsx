import { formationExpired, formatFormationDeadline } from "@/services/groupFormation"
import { groupOrderErrorMessage, groupCommitmentMaximum, validGroupCommitmentQuantity } from "./groupOrderFeedback"
import GroupMembershipNotice from "./GroupMembershipNotice"
import { GroupMembershipConflict } from "@/services/groupMembership"
import { useEffect, useMemo, useState } from "react"
import { Link2, RefreshCw, Users } from "lucide-react"

import type { BatchType, GroupOrder } from "@/types"
import {
  LocationPinPicker,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  type LocationPinValue,
} from "@/components/shared"
import { kargoApi } from "@/services"
import type { SellerReceiveMethod } from "@/services/kargoApi"

export function GroupOrderChoiceModal({
  onSolo,
  onGroup,
  onClose,
}: {
  onSolo: () => void
  onGroup: () => void
  onClose: () => void
}) {
  return (
    <Modal title="How would you like to order?" onClose={onClose} width={440}>
      <div className="group-order-choice">
        <button type="button" onClick={onSolo}>
          <strong>Buy Solo</strong>
          <span>Reserve and pay for your own items.</span>
        </button>
        <button type="button" onClick={onGroup}>
          <Users size={20} aria-hidden="true" />
          <strong>Group Order</strong>
          <span>Combine items with at least one other KARGO account.</span>
        </button>
      </div>
    </Modal>
  )
}

export default function GroupOrderModal({
  batch,
  initialProductId,
  initialCode = "",
  groupOrderId,
  readOnly = false,
  onOpenClaims,
  onClose,
  onCheckoutComplete,
}: {
  batch: BatchType
  groupOrderId?: string
  readOnly?: boolean
  onOpenClaims?: () => void
  initialProductId?: string
  initialCode?: string
  onClose: () => void
  onCheckoutComplete: () => Promise<void>
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const [group, setGroup] = useState<GroupOrder | null>(null)
  const [joining, setJoining] = useState(Boolean(initialCode))
  const [code, setCode] = useState(initialCode)
  const [quantities, setQuantities] = useState<Record<string, number>>(
    initialProductId ? { [initialProductId]: 1 } : {},
  )
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")
  const [membershipConflict, setMembershipConflict] = useState<GroupMembershipConflict | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [methods, setMethods] = useState<SellerReceiveMethod[]>([])
  const [paymentMethod, setPaymentMethod] = useState("")
  const [pin, setPin] = useState<LocationPinValue>({})
  const [acceptShipping, setAcceptShipping] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const syncGroup = async () => {
    if (!batch.dbId) return
    const current = groupOrderId
      ? // Members open their own groups too; row-level security (not this
        // client filter) decides who can read a group.
        await kargoApi.loadGroupOrder(groupOrderId, false)
      : await kargoApi.loadMyGroupOrder(batch.dbId)
    if (current && current.batchId !== batch.dbId) throw new Error("This group no longer belongs to the selected batch.")
    // An invitation must not silently reopen a completed historical group.
    if (!groupOrderId && initialCode && current?.status === "payment_confirmed") {
      setGroup(null)
      return
    }
    setGroup(current)
    if (!groupOrderId && initialCode && current && current.referralCode !== initialCode.trim().toUpperCase() &&
        ["forming", "waiting_for_seller", "payment_pending", "payment_submitted"].includes(current.status)) {
      setMembershipConflict(new GroupMembershipConflict(current.status === "forming"))
    }
    if (current) {
      const own = Object.fromEntries(
        current.commitments
          .filter((commitment) => commitment.userId === current.currentUserId)
          .map((commitment) => [commitment.productId, commitment.quantity]),
      )
      if (Object.keys(own).length > 0) setQuantities(own)
    }
  }

  useEffect(() => {
    syncGroup()
      .catch((caught) =>
        setError(groupOrderErrorMessage(caught, "Unable to load group order.")),
      )
      .finally(() => setLoading(false))
  }, [batch.dbId, groupOrderId])

  useEffect(() => {
    if (!checkoutOpen || !batch.sellerId) return
    kargoApi
      .loadSellerReceiveMethods(batch.sellerId)
      .then((available) => {
        setMethods(available)
        setPaymentMethod(available[0]?.methodType ?? "")
      })
      .catch((caught) =>
        setError(groupOrderErrorMessage(caught, "Unable to load payment methods.")),
      )
  }, [checkoutOpen, batch.sellerId])

  const formationClosed = Boolean(group && formationExpired(group.status, group.formationDeadline, now))
  const activeMembers = group?.members.filter((member) => member.status === "active") ?? []
  const subtotal = useMemo(
    () =>
      group?.commitments.reduce(
        (sum, commitment) => sum + commitment.quantity * commitment.unitPrice,
        0,
      ) ?? 0,
    [group],
  )
  const qualifiesForDiscount = Boolean(
    batch.groupDiscountType &&
      batch.groupDiscountValue &&
      (!batch.groupDiscountMinSubtotal || subtotal >= batch.groupDiscountMinSubtotal),
  )
  const projectedDiscount = qualifiesForDiscount
    ? batch.groupDiscountType === "percentage"
      ? Math.min(subtotal, subtotal * (batch.groupDiscountValue ?? 0) / 100)
      : Math.min(subtotal, batch.groupDiscountValue ?? 0)
    : 0
  const leaderHasItems = Boolean(
    group?.commitments.some(
      (commitment) => commitment.userId === group.leaderId && commitment.quantity > 0,
    ),
  )
  const canCheckout = Boolean(
    group?.isLeader && activeMembers.length >= 2 && leaderHasItems && subtotal > 0,
  )
  const shippingApplies = Boolean(
    paymentMethod && paymentMethod !== "Cash on Meetup",
  )
  const inviteUrl = group
    ? `${window.location.origin}${window.location.pathname}?batch=${encodeURIComponent(String(batch.id))}&group=${group.referralCode}`
    : ""

  const run = async (action: () => Promise<void>) => {
    setError("")
    setMembershipConflict(null)
    setWorking(true)
    try {
      await action()
    } catch (caught) {
      if (caught instanceof GroupMembershipConflict) {
        setMembershipConflict(caught)
        await syncGroup().catch(() => setGroup(null))
      } else setError(groupOrderErrorMessage(caught, "Unable to update group order."))
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <Modal title="Group Order" onClose={onClose} width={620}>
        <p className="group-order-loading">Loading group order…</p>
      </Modal>
    )
  }

  if (groupOrderId && !group) {
    return <Modal title="Group Order" onClose={onClose} width={620}>
      <p role="alert">{error || "This group is unavailable or you no longer have leader access."}</p>
      <SecondaryBtn onClick={onClose}>Close</SecondaryBtn>
    </Modal>
  }

  return (
    <Modal title="Group Order" onClose={onClose} width={680}>
      <div className="group-order-modal">
        {!group ? (
          <div className="group-order-entry">
            <div className="group-order-entry__intro">
              <Users size={24} aria-hidden="true" />
              <div>
                <strong>Order together from {batch.title}</strong>
                <span>At least two separate KARGO accounts are required.</span>
              </div>
            </div>
            {joining ? (
              <div className="group-order-code-entry">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                />
                <PrimaryBtn
                  disabled={working || code.trim().length !== 8}
                  onClick={() =>
                    run(async () => setGroup(await kargoApi.joinGroupOrder(code)))
                  }
                >
                  Join Group
                </PrimaryBtn>
                <button type="button" onClick={() => setJoining(false)}>
                  Start a new group instead
                </button>
              </div>
            ) : (
              <div className="group-order-entry__actions">
                <PrimaryBtn
                  disabled={working || !batch.dbId}
                  onClick={() =>
                    run(async () => setGroup(await kargoApi.startGroupOrder(batch.dbId!)))
                  }
                >
                  Start a Group
                </PrimaryBtn>
                <SecondaryBtn onClick={() => setJoining(true)}>
                  Join with Code
                </SecondaryBtn>
              </div>
            )}
          </div>
        ) : (
          <>
            <header className="group-order-header">
              <div>
                <span>Referral code</span>
                <strong>{group.referralCode}</strong>
              </div>
              {group.isLeader && group.status === "forming" && !formationClosed && !readOnly && (
                <div className="group-order-share-actions">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(inviteUrl)}
                  >
                    <Link2 size={14} aria-hidden="true" /> Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      run(async () => {
                        const nextCode = await kargoApi.regenerateGroupCode(group.id)
                        setGroup({ ...group, referralCode: nextCode })
                      })
                    }
                  >
                    <RefreshCw size={14} aria-hidden="true" /> New code
                  </button>
                </div>
              )}
            </header>

            <p className="group-order-status" role="status">
              Formation deadline: <time dateTime={group.formationDeadline}>{formatFormationDeadline(group.formationDeadline)}</time>
              {formationClosed && <span className="block">The formation deadline has passed. Checkout is closed and un-checked-out commitments no longer reserve stock.</span>}
            </p>

            <section className="group-order-members">
              <div className="group-order-section-title">
                <strong>Members</strong>
                <span>{activeMembers.length} joined</span>
              </div>
              <div className="group-order-member-list">
                {activeMembers.map((member) => (
                  <div key={member.userId}>
                    <span>{member.name}</span>
                    <small>{member.role === "leader" ? "Leader" : "Member"}</small>
                    {group.isLeader && member.role !== "leader" && group.status === "forming" && !formationClosed && !readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          run(async () =>
                            setGroup(
                              await kargoApi.removeGroupMember(group.id, member.userId),
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {group.isLeader && group.commitments.length > 0 && (
              <section className="group-order-commitment-breakdown">
                <div className="group-order-section-title">
                  <strong>Member commitments</strong>
                  <span>{group.commitments.length} selections</span>
                </div>
                {group.commitments.map((commitment) => (
                  <div
                    key={`${commitment.userId}-${commitment.productId}`}
                    className="group-order-commitment-line"
                  >
                    <span>{commitment.memberName}</span>
                    <span>{commitment.productName} ×{commitment.quantity}</span>
                    <strong>
                      ₱{(commitment.unitPrice * commitment.quantity).toLocaleString()}
                    </strong>
                  </div>
                ))}
              </section>
            )}

            <section className="group-order-products">
              <div className="group-order-section-title">
                <strong>Your commitments</strong>
                <span>{formationClosed || group.status === "expired" ? "Commitments are retained for history; inventory is released." : "Inventory is reserved after saving."}</span>
              </div>
              {batch.products.map((product) => {
                const key = product.dbId ?? product.name
                const ownSaved = group.commitments.find(commitment =>
                  commitment.productId === product.dbId && commitment.userId === group.currentUserId)?.quantity ?? 0
                const maximum = groupCommitmentMaximum(product, ownSaved)
                const hintId = `group-quantity-hint-${encodeURIComponent(key)}`
                const quantity = quantities[key] ?? 1
                const valid = validGroupCommitmentQuantity(quantity, maximum)
                return (
                <div key={key} className="group-order-product-row">
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      ₱{product.price.toLocaleString()} / {product.sellingUnit === "box" ? "box" : "piece"}
                    </span>
                  <p id={hintId} className="mt-1 text-xs text-[var(--kargo-muted)]">
                    {product.limitPerUser ? `Limit: ${product.limitPerUser} per buyer. ` : ""}
                    {maximum > 0 ? `Available for your commitment: ${maximum}.` : "No quantity is currently available."}
                  </p>
                  </div>
                  <input
                    aria-label={`Quantity for ${product.name}`}
                    aria-describedby={hintId}
                    aria-invalid={!valid}
                    type="number"
                    min="1"
                    step="1"
                    max={Math.max(1, maximum)}
                    value={quantity}
                    disabled={readOnly || formationClosed || group.status !== "forming"}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [product.dbId ?? product.name]: Math.max(1, Number(event.target.value)),
                      }))
                    }
                  />
                  <SecondaryBtn
                    size="sm"
                    disabled={readOnly || formationClosed || working || group.status !== "forming" || !product.dbId || !valid}
                    onClick={() =>
                      run(async () => {
                        if (!valid) { setError(`Choose a whole-number quantity between 1 and ${maximum}.`); return }
                        setGroup(
                          await kargoApi.setGroupCommitment(
                            group.id,
                            product.dbId!,
                            quantity,
                          ),
                        )
                      })
                    }
                  >
                    Save
                  </SecondaryBtn>
                </div>
              )})}
            </section>

            <section className="group-order-summary">
              <div><span>Regular subtotal</span><strong>₱{subtotal.toLocaleString()}</strong></div>
              {batch.groupDiscountType && (
                <div>
                  <span>
                    {qualifiesForDiscount
                      ? "Group discount"
                      : `Discount unlocks at ₱${(batch.groupDiscountMinSubtotal ?? 0).toLocaleString()}`}
                  </span>
                  <strong>−₱{projectedDiscount.toLocaleString()}</strong>
                </div>
              )}
              <div className="is-total">
                <span>Projected total</span>
                <strong>₱{(subtotal - projectedDiscount).toLocaleString()}</strong>
              </div>
            </section>

            {group.isLeader && group.status === "forming" && !formationClosed && !readOnly && !checkoutOpen && (
              <PrimaryBtn disabled={!canCheckout} onClick={() => setCheckoutOpen(true)}>
                Checkout Group Order
              </PrimaryBtn>
            )}

            {checkoutOpen && !readOnly && !formationClosed && (
              <section className="group-order-checkout">
                <div className="group-order-section-title"><strong>Leader checkout</strong></div>
                <div className="group-order-methods">
                  {methods.map((method) => (
                    <button
                      type="button"
                      key={method.methodType}
                      aria-pressed={paymentMethod === method.methodType}
                      onClick={() => setPaymentMethod(method.methodType)}
                    >
                      {method.methodType}
                    </button>
                  ))}
                </div>
                {shippingApplies && (
                  <>
                    <LocationPinPicker value={pin} onChange={setPin} />
                    <label className="group-order-ack">
                      <input
                        type="checkbox"
                        checked={acceptShipping}
                        onChange={(event) => setAcceptShipping(event.target.checked)}
                      />
                      <span>I accept the seller-set shipping fee.</span>
                    </label>
                  </>
                )}
                <label className="group-order-ack">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  <span>I’ll pay the full group total and receive the combined delivery.</span>
                </label>
                <div className="kargo-modal-actions">
                  <SecondaryBtn onClick={() => setCheckoutOpen(false)}>Back</SecondaryBtn>
                  <PrimaryBtn
                    disabled={
                      working ||
                      !paymentMethod ||
                      !acknowledged ||
                      (shippingApplies &&
                        (!acceptShipping ||
                          (!(pin.lat != null && pin.lng != null) && !pin.url)))
                    }
                    onClick={() =>
                      run(async () => {
                        const checkedOut = await kargoApi.checkoutGroupOrder({
                          groupOrderId: group.id,
                          paymentMethod,
                          pinLat: pin.lat,
                          pinLng: pin.lng,
                          pinUrl: pin.url,
                          pinAddress: pin.address,
                          acceptShipping,
                        })
                        setGroup(checkedOut)
                        await onCheckoutComplete()
                      })
                    }
                  >
                    Confirm Group Checkout
                  </PrimaryBtn>
                </div>
              </section>
            )}

            {group.status !== "forming" && (
              <p className="group-order-status" role="status">
                {group.status === "waiting_for_seller"
                  ? "Waiting for the seller to set the shipping fee."
                  : group.status === "payment_pending"
                    ? "Checkout is ready. The leader can submit payment from My Claims."
                    : group.status === "payment_submitted"
                      ? "Payment submitted for seller review."
                      : group.status === "payment_confirmed"
                        ? "Payment confirmed."
                        : "This group order is closed."}
              </p>
            )}

            {group.status === "forming" && !formationClosed && !readOnly && (
              <button
                type="button"
                className="group-order-leave"
                onClick={() =>
                  run(async () => {
                    await kargoApi.leaveGroupOrder(group.id)
                    setGroup(null)
                  })
                }
              >
                {group.isLeader ? "Cancel group" : "Leave group"}
              </button>
            )}
          </>
        )}

        {group && group.status !== "forming" && onOpenClaims && (
          <SecondaryBtn onClick={onOpenClaims}>Open My Claims</SecondaryBtn>
        )}
        {membershipConflict && <GroupMembershipNotice message={membershipConflict.message} status={group?.status} />}
        {error && <p className="group-order-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
