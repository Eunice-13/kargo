import { productAvailability } from "./productAvailability"

import { canManageBatch } from "./batchAccess"

import { useState } from "react"

import { Lock, ArrowLeft, ArrowRight, Plane, Check, Link2, ImageUp, Users, Tag, CalendarDays, Clock } from "lucide-react"

import type {
  ClaimRow,
  ToPayRow,
  BatchType,
  Role,
  UserInfo,
  WaitlistEntry,
  ClaimReservationInput,
} from "@/types"
import { batchImage } from "@/constants/categories"
import {
  INDIGO,
  CYAN_L,
  GREEN,
  AMBER,
  batchCoverSrc,
} from "@/constants/theme"

import {
  Card,
  PrimaryBtn,
  SecondaryBtn,
  SH,
  Avatar,
  ProductThumb,
  Toggle,
  ContactModal,
  ShareButton,
  Modal,
} from "@/components/shared"
import { productImageUrl } from "@/components/shared/ProductThumb"

import ItemClaimModal from "./ItemClaimModal"

import JoinWaitlistModal from "./JoinWaitlistModal"
import GroupOrderModal, { GroupOrderChoiceModal } from "./GroupOrderModal"
import BatchGroupSettingsModal from "./BatchGroupSettingsModal"

import { toggleBatchLock } from "./toggleBatchLock"

import { isSupabaseConfigured } from "@/lib/supabase"

import { kargoApi } from "@/services"

export default function BatchPage({
  batch: batchProp,

  role,

  user,

  batches,

  claims,

  setClaims,

  toPay,

  setToPay,

  onBack,
  backLabel = "Back to Batches",
  onSellerClick,

  setBatches,

  waitlist,

  setWaitlist,

  refreshData,
}: {
  batch: BatchType

  role: Role

  user: UserInfo

  batches: BatchType[]

  claims: ClaimRow[]

  setClaims: React.Dispatch<React.SetStateAction<ClaimRow[]>>

  toPay: ToPayRow[]

  setToPay: React.Dispatch<React.SetStateAction<ToPayRow[]>>

  onBack: () => void
  backLabel?: string
  onSellerClick: (name: string) => void

  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>

  waitlist: WaitlistEntry[]

  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>

  refreshData: () => Promise<void>
}) {
  const batch = batches.find((b) => b.id === batchProp.id) ?? batchProp

  const canEdit = canManageBatch(batch, user, role)

  const [claimedKeys, setClaimedKeys] = useState<Record<string, boolean>>({})

  const [claimTarget, setClaimTarget] = useState<{
    p: typeof batch.products[0]

    key: string
  } | null>(null)

  const [purchaseModeTarget, setPurchaseModeTarget] = useState<{
    p: typeof batch.products[0]
    key: string
  } | null>(null)

  const sharedGroupCode =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("group") ?? ""

  const [groupOrderProductId, setGroupOrderProductId] = useState<string | null>(null)

  const [groupOrderOpen, setGroupOrderOpen] = useState(
    role === "Buyer" && batch.groupOrdersEnabled && Boolean(sharedGroupCode),
  )

  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)

  const [waitlistTarget, setWaitlistTarget] = useState<{
    p: typeof batch.products[0]

    pIdx: number
  } | null>(null)

  const [contact, setContact] = useState(false)

  const [waitlistLimitDrafts, setWaitlistLimitDrafts] =
    useState<Record<string, string>>({})

  const [savingWaitlistLimit, setSavingWaitlistLimit] = useState<string | null>(
    null,
  )

  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)

  const [photoPreview, setPhotoPreview] =
    useState<(typeof batch.products)[number] | null>(null)

  const [galleryZoomOpen, setGalleryZoomOpen] = useState(false)

  // Per-batch photo overrides keyed by batch title. The PLM thrift batch is a
  // live DB record whose stored images don't match its ukay-ukay listing, so
  // its first two gallery photos are swapped for curated thrift shots at render
  // time (purely visual; the database is left untouched).
  const BATCH_PHOTO_OVERRIDES: Record<
    string,
    { imageUrl: string; name: string }[]
  > = {
    "PLM - October 2026": [
      {
        imageUrl:
          "https://filebroker-cdn.lazada.com.ph/kf/Se45419c8921b45289b11e40d6b67fa415.jpg",
        name: "Floral Wide-Leg Jeans",
      },
      {
        imageUrl:
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTlH8LVnHJwC6jlvsk1HbSiFA9A5MGG_KcVAu-V3Jh_T8QmHZfGKWAWdJ3&s=10",
        name: "Assorted Thrifted Denim",
      },
    ],
  }
  const photoOverrides = BATCH_PHOTO_OVERRIDES[batch.title.trim()] ?? []

  // Display-only category correction for the PLM thrift batch (its DB record
  // still reads "Food"). Visual only — does not touch the stored category.
  const BATCH_CATEGORY_OVERRIDES: Record<string, string> = {
    "PLM - October 2026": "Apparel",
  }
  const displayCategory =
    BATCH_CATEGORY_OVERRIDES[batch.title.trim()] ?? batch.category

  const baseGalleryItems = [
    ...(batch.galleryImages ?? []).map((imageUrl, index) => ({
      key: `batch-${index}`,
      imageUrl,
      name: `Batch photo ${index + 1}`,
    })),
    ...batch.products
      .filter((product) => product.imageUrl)
      .map((product, index) => ({
        key: product.dbId ?? product.id ?? `product-${index}`,
        imageUrl: product.imageUrl!,
        name: product.name,
      })),
  ]
  // Exchange the first N photos for the override images and their captions,
  // keeping each item's key so selection stays stable.
  const uploadedGalleryItems = baseGalleryItems.map((item, index) =>
    index < photoOverrides.length
      ? {
          ...item,
          imageUrl: photoOverrides[index].imageUrl,
          name: photoOverrides[index].name,
        }
      : item,
  )
  const galleryItems = uploadedGalleryItems.length
    ? uploadedGalleryItems
    : [
        {
          key: "sample-cover",
          imageUrl: batchCoverSrc(batch.coverImage, batch.category),
          name: batch.coverImage ? "Cover photo" : "Sample cover photo",
        },
        ...[1, 2].map((index) => ({
          key: `sample-${index}`,
          imageUrl: batchImage(batch.category, `${batch.id}-sample-${index}`),
          name: `Sample batch photo ${index}`,
        })),
      ]
  const [selectedProductIndex, setSelectedProductIndex] = useState(0)
  const selectedGalleryItem =
    galleryItems[selectedProductIndex] ?? galleryItems[0]

  const changeCoverPhoto = async (file?: File) => {
    if (!file || !canEdit) return
    setUploadingPhoto("cover")
    try {
      const imageUrl = isSupabaseConfigured
        ? batch.dbId
          ? await kargoApi.updateBatchCover(batch.dbId, file)
          : (() => {
              throw new Error("This batch is missing its database identifier.")
            })()
        : URL.createObjectURL(file)

      setBatches((current) =>
        current.map((item) =>
          item.id === batch.id ? { ...item, coverImage: imageUrl } : item,
        ),
      )
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update photo.")
    } finally {
      setUploadingPhoto(null)
    }
  }

  const addBatchPhotos = async (files: File[]) => {
    if (!files.length || !canEdit) return
    setUploadingPhoto("gallery")
    try {
      const imageUrls = isSupabaseConfigured
        ? batch.dbId
          ? await kargoApi.addBatchGalleryImages(batch.dbId, files)
          : (() => {
              throw new Error("This batch is missing its database identifier.")
            })()
        : files.map((file) => URL.createObjectURL(file))

      setBatches((current) =>
        current.map((item) =>
          item.id === batch.id
            ? { ...item, galleryImages: [...(item.galleryImages ?? []), ...imageUrls] }
            : item,
        ),
      )
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to add batch photos.")
    } finally {
      setUploadingPhoto(null)
    }
  }

  const changeProductPhoto = async (
    product: typeof batch.products[0],
    productIndex: number,
    file?: File,
  ) => {
    if (!file || !canEdit) return
    const key = product.dbId ?? `${batch.id}-${productIndex}`
    setUploadingPhoto(key)
    try {
      const imageUrl = isSupabaseConfigured
        ? batch.dbId && product.dbId
          ? await kargoApi.updateProductImage(batch.dbId, product.dbId, file)
          : (() => {
              throw new Error("This item is missing its database identifier.")
            })()
        : URL.createObjectURL(file)

      setBatches((current) =>
        current.map((item) =>
          item.id !== batch.id
            ? item
            : {
                ...item,
                products: item.products.map((candidate, index) =>
                  index === productIndex
                    ? { ...candidate, imageUrl }
                    : candidate,
                ),
              },
        ),
      )
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update photo.")
    } finally {
      setUploadingPhoto(null)
    }
  }

  const pct = Math.round((batch.claimed / batch.items) * 100)

  const reserveHrs = batch.reserveHours || 48

  const saveWaitlistLimit = async (
    product: typeof batch.products[0],

    productIndex: number,
  ) => {
    if (!canEdit) return

    const key = product.dbId ?? `${batch.id}-${productIndex}`

    const raw = waitlistLimitDrafts[key] ?? String(product.waitlistLimit ?? "")

    const parsed = Number(raw)

    if (raw.trim() !== "" && (!Number.isInteger(parsed) || parsed < 0)) {
      alert("Waitlist slots must be a whole number of 0 or more.")

      return
    }

    const limit = raw.trim() === "" ? undefined : parsed

    setSavingWaitlistLimit(key)

    try {
      if (isSupabaseConfigured) {
        if (!product.dbId)
          throw new Error("This product is missing its database identifier.")

        await kargoApi.setProductWaitlistLimit(product.dbId, limit)
      }

      setBatches((current) =>
        current.map((item) =>
          item.id !== batch.id
            ? item
            : {
                ...item,

                products: item.products.map((candidate, index) =>
                  index === productIndex
                    ? { ...candidate, waitlistLimit: limit }
                    : candidate,
                ),
              },
        ),
      )

      setWaitlistLimitDrafts((current) => ({
        ...current,

        [key]: limit !== undefined ? String(limit) : "",
      }))
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save waitlist limit.",
      )
    } finally {
      setSavingWaitlistLimit(null)
    }
  }

  // Join a waitlist with the buyer's chosen quantity (from JoinWaitlistModal).

  const handleJoinWaitlist = async (
    p: typeof batch.products[0],

    pIdx: number,

    qty: number,
  ) => {
    const currentProduct = batch.products[pIdx]

    if (
      role !== "Buyer" ||
      !currentProduct ||
      !productAvailability(currentProduct, batch.locked).canWaitlist
    ) {
      alert("This product is no longer available for waitlisting.")

      return
    }

    if (isSupabaseConfigured) {
      if (!p.dbId) return

      try {
        await kargoApi.joinWaitlist(p.dbId, qty)
      } catch (error) {
        alert(
          error instanceof Error ? error.message : "Unable to join waitlist.",
        )

        return
      }
    }

    setWaitlist((prev) => {
      if (
        prev.some(
          (e) =>
            (p.dbId && e.productId === p.dbId) ||
            (e.batchId === batch.id && e.product === p.name),
        )
      ) {
        return prev
      }

      const nextPos = p.waitlist + 1

      return [
        ...prev.map((e) =>
          e.batchId === batch.id && e.product === p.name
            ? { ...e, queueSize: nextPos, desiredQuantity: qty }
            : e,
        ),

        {
          id: p.dbId ?? `wl-${batch.id}-${p.name}`,

          productId: p.dbId,

          product: p.name,

          batchId: batch.id,

          batch: batch.title,

          seller: batch.seller,

          trips: batch.trips,

          position: nextPos,

          queueSize: nextPos,

          amount: p.price,

          desiredQuantity: qty,

          status: "waiting",
        },
      ]
    })

    setBatches((prev) =>
      prev.map((b) =>
        b.id !== batch.id
          ? b
          : {
              ...b,

              products: b.products.map((prod, i) =>
                i === pIdx ? { ...prod, waitlist: prod.waitlist + 1 } : prod,
              ),
            },
      ),
    )
  }

  const handleClaim = async (
    key: string,

    b: BatchType,

    product: typeof batch.products[0],

    reservation: ClaimReservationInput,
  ) => {
    const qty = reservation.quantity
    const claimQty = Math.max(1, Math.floor(qty))

    const currentProduct = b.products.find((p) =>
      product.dbId ? p.dbId === product.dbId : p.name === product.name,
    )

    if (
      role !== "Buyer" ||
      !currentProduct ||
      !productAvailability(currentProduct, b.locked).canClaim ||
      claimQty > currentProduct.qty - currentProduct.claimed
    ) {
      alert("This product no longer has enough available claim slots.")

      return false
    }

    if (isSupabaseConfigured) {
      if (!product.dbId) {
        alert("This product is missing its database identifier.")

        return false
      }

      try {
        await kargoApi.claimProduct(product.dbId, reservation)
        await refreshData()

        setClaimedKeys((current) => ({ ...current, [key]: true }))

        return true
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Unable to claim this product.",
        )

        return false
      }
    }

    setClaimedKeys((c) => ({ ...c, [key]: true }))

    // Keep the batch/product claim counts accurate immediately (2.3) instead of

    // waiting for the next full data refresh.

    setBatches((prev) =>
      prev.map((bt) =>
        bt.id !== b.id
          ? bt
          : {
              ...bt,

              claimed: bt.claimed + claimQty,

              products: bt.products.map((prod) =>
                (product.dbId && prod.dbId === product.dbId) ||
                prod.name === product.name
                  ? { ...prod, claimed: prod.claimed + claimQty }
                  : prod,
              ),
            },
      ),
    )

    const claimId = Date.now()

    const createdAt = new Date().toISOString()
    const expiresAt = new Date(
      Date.now() + reserveHrs * 3_600_000,
    ).toISOString()
    const shippingApplies = reservation.paymentMethod !== "Cash on Meetup"
    setClaims((prev) => [
      {
        id: claimId,

        createdAt,

        productId: product.dbId,

        product: product.name,

        batch: b.title,

        seller: b.seller,

        qty: claimQty,

        amount: product.price * claimQty,

        status: "Pending",

        hours: reserveHrs,

        expiresAt,
        reservedPaymentMethod: reservation.paymentMethod,
        shippingApplies,
        shippingState: shippingApplies ? "waiting_for_seller" : undefined,
        deadlinePausedAt: shippingApplies ? createdAt : undefined,
        deliveryPinLat: reservation.pinLat,
        deliveryPinLng: reservation.pinLng,
        deliveryPinUrl: reservation.pinUrl,
        deliveryPinAddress: reservation.pinAddress,
      },

      ...prev,
    ])

    if (!toPay.some((t) => t.product === product.name))
      setToPay((prev) => [
        {
          id: claimId,

          createdAt,

          orderId: String(claimId),

          product: product.name,

          seller: b.seller,

          sellerId: b.sellerId,

          amount: product.price * claimQty,

          qty: claimQty,

          hours: reserveHrs,

          expiresAt,
          reservedPaymentMethod: reservation.paymentMethod,
          shippingApplies,
          shippingState: shippingApplies ? "waiting_for_seller" : undefined,
          deadlinePausedAt: shippingApplies ? createdAt : undefined,
        },

        ...prev,
      ])

    return true
  }

  return (
    <div className="p-6 fi batch-page">
      {/* Breadcrumb + share */}
      <div
        style={{
          display: "flex",

          alignItems: "center",

          justifyContent: "space-between",

          paddingBottom: 16,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",

            alignItems: "center",

            gap: 6,

            fontSize: 13,

            fontWeight: 600,

            color: INDIGO,

            background: "none",

            border: "none",

            cursor: "pointer",

            padding: 0,

            fontFamily: "'Josefin Sans',sans-serif",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> {backLabel}
        </button>
        <ShareButton
          batchId={batch.id}
          title={batch.title}
          label="Share batch"
        />
      </div>

      <section className="batch-gallery" aria-label={`${batch.title} photos`}>
        <div className="batch-gallery__main">
          {role === "Buyer" ? (
            <button
              type="button"
              className="batch-gallery__zoom-trigger"
              aria-label={`Zoom ${selectedGalleryItem?.name ?? `${batch.title} cover`}`}
              onClick={() => setGalleryZoomOpen(true)}
            >
              <img
                src={selectedGalleryItem?.imageUrl ?? batchCoverSrc(batch.coverImage, batch.category)}
                alt={selectedGalleryItem?.name ?? `${batch.title} cover`}
              />
            </button>
          ) : (
            <img
              src={selectedGalleryItem?.imageUrl ?? batchCoverSrc(batch.coverImage, batch.category)}
              alt={selectedGalleryItem?.name ?? `${batch.title} cover`}
            />
          )}
          {galleryItems.length > 1 && (
            <>
              <button
                type="button"
                className="batch-gallery__arrow batch-gallery__arrow--previous"
                aria-label="Previous item photo"
                onClick={() =>
                  setSelectedProductIndex((index) =>
                    (index - 1 + galleryItems.length) % galleryItems.length,
                  )
                }
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="batch-gallery__arrow batch-gallery__arrow--next"
                aria-label="Next item photo"
                onClick={() =>
                  setSelectedProductIndex((index) =>
                    (index + 1) % galleryItems.length,
                  )
                }
              >
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        <div className="batch-gallery__side">
          <h1>{batch.title}</h1>
          {batch.locked && role === "Buyer" && (
            <span className="batch-gallery__status">
              <Lock size={14} aria-hidden="true" /> Not Accepting Orders
            </span>
          )}
          <div className="batch-gallery__meta">
            <span className="batch-chip batch-chip--category">
              <Tag size={13} aria-hidden="true" />
              <span className="batch-chip__text">
                <span className="batch-chip__label">Category</span>
                <span className="batch-chip__value">{displayCategory}</span>
              </span>
            </span>
            <span className="batch-chip batch-chip--trip">
              <CalendarDays size={13} aria-hidden="true" />
              <span className="batch-chip__text">
                <span className="batch-chip__label">Trip dates</span>
                <span className="batch-chip__value">{batch.trips}</span>
              </span>
            </span>
            <span className="batch-chip batch-chip--window">
              <Clock size={13} aria-hidden="true" />
              <span className="batch-chip__text">
                <span className="batch-chip__label">Reservation</span>
                <span className="batch-chip__value">48h window</span>
              </span>
            </span>
          </div>
          <div className="batch-gallery__thumbnails" aria-label="Batch photos and item photos">
            {galleryItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`batch-gallery__thumbnail${index === selectedProductIndex ? " is-selected" : ""}`}
                onClick={() => setSelectedProductIndex(index)}
                aria-label={`Show ${item.name}`}
                aria-pressed={index === selectedProductIndex}
              >
                <img src={item.imageUrl} alt="" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
          <div className="batch-gallery__actions">
            {canEdit && (
              <label className="batch-hero-photo-action">
                <ImageUp size={15} aria-hidden="true" />
                <span>{uploadingPhoto === "gallery" ? "Uploading…" : "Add batch photos"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  disabled={uploadingPhoto !== null}
                  onChange={(event) => {
                    void addBatchPhotos(Array.from(event.target.files ?? []))
                    event.currentTarget.value = ""
                  }}
                />
              </label>
            )}
            {canEdit && (
              <label className="batch-hero-photo-action">
                <ImageUp size={15} aria-hidden="true" />
                <span>{uploadingPhoto === "cover" ? "Uploading…" : "Change cover"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploadingPhoto !== null}
                  onChange={(event) => changeCoverPhoto(event.target.files?.[0])}
                />
              </label>
            )}
            {canEdit && (
              <button
                type="button"
                className="batch-group-settings-action"
                onClick={() => setGroupSettingsOpen(true)}
              >
                <Users size={15} aria-hidden="true" /> Selling & groups
              </button>
            )}
            {role === "Buyer" && batch.groupOrdersEnabled && (
              <button
                type="button"
                className="batch-group-order-action"
                onClick={() => {
                  setGroupOrderProductId(null)
                  setGroupOrderOpen(true)
                }}
              >
                <Users size={15} aria-hidden="true" /> Group Order
              </button>
            )}
          </div>
        </div>
      </section>

      {batch.notes && (
        <div
          style={{
            background: "#fff",

            border: "1px solid #E5E7EB",

            borderRadius: 12,

            padding: "16px 18px",

            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 11,

              fontWeight: 700,

              color: "#9CA3AF",

              letterSpacing: 0.8,

              marginBottom: 8,
            }}
          >
            DESCRIPTION
          </div>
          <p
            style={{
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {batch.notes}
          </p>
        </div>
      )}

      <div
        className="batch-page-layout"
        style={{
          display: "grid",

          gridTemplateColumns: "1fr 300px",

          gap: 24,

          alignItems: "start",
        }}
      >
        {/* Left: products */}
        <div>
          <SH
            title="Items in this Batch"
            action={
              role === "Buyer" ? (
                <SecondaryBtn onClick={() => setContact(true)}>
                  Contact Seller
                </SecondaryBtn>
              ) : undefined
            }
          />
          <div className="space-y-3">
            {batch.products.map((p, pIdx) => {
              const pKey = `${batch.id}-${pIdx}`

              const isClaimed = claimedKeys[pKey]

              // p.claimed is bumped by the claimed quantity on confirm, so it is

              // already authoritative — no extra manual offset needed.

              const left = p.qty - p.claimed

              const availability = productAvailability(p, batch.locked)

              const soldOut = availability.claimsFull

              const waitEntry = waitlist.find(
                (e) =>
                  (p.dbId && e.productId === p.dbId) ||
                  (e.batchId === batch.id && e.product === p.name),
              )

              const onWaitlist = Boolean(waitEntry)

              const waitlistFull = availability.waitlistFull

              const waitlistLimitKey = p.dbId ?? `${batch.id}-${pIdx}`

              return (
                <Card
                  key={pIdx}
                  style={{ display: "flex", alignItems: "center", gap: 14 }}
                >
                  <div className="batch-product-photo-control">
                    <button
                      type="button"
                      className="claim-review-photo-button"
                      aria-label={`Zoom photo of ${p.name}`}
                      onClick={() => setPhotoPreview(p)}
                    >
                      <ProductThumb name={p.name} imageUrl={p.imageUrl} />
                    </button>
                    {canEdit && (
                      <label>
                        <ImageUp size={12} aria-hidden="true" />
                        <span>
                          {uploadingPhoto === waitlistLimitKey
                            ? "Uploading…"
                            : "Photo"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          disabled={uploadingPhoto !== null}
                          onChange={(event) =>
                            changeProductPhoto(
                              p,
                              pIdx,
                              event.target.files?.[0],
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 14,

                        fontWeight: 700,

                        color: "#111827",

                        fontFamily: "'Josefin Sans',sans-serif",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {p.sellingUnit === "box"
                        ? `₱${p.price.toLocaleString()} / box · ${p.piecesPerBox ?? 1} pieces · `
                        : `₱${p.price.toLocaleString()} / piece · `}
                      {p.claimed}/{p.qty} claimed
                      {p.waitlist > 0
                        ? p.waitlistLimit !== undefined
                          ? ` · ${p.waitlist}/${p.waitlistLimit} waitlist slots`
                          : ` · ${p.waitlist} on waitlist`
                        : ""}
                    </div>
                    <div
                      style={{
                        display: "flex",

                        gap: 6,

                        marginTop: 5,

                        flexWrap: "wrap" as const,
                      }}
                    >
                      {soldOut && !isClaimed && (
                        <span
                          style={{
                            fontSize: 10,

                            fontWeight: 600,

                            color: "#EF4444",

                            background: "#FEE2E2",

                            borderRadius: 999,

                            padding: "2px 8px",
                          }}
                        >
                          Sold Out
                        </span>
                      )}
                      {!soldOut && left <= 2 && (
                        <span
                          style={{
                            fontSize: 10,

                            fontWeight: 600,

                            color: "#D97706",

                            background: "#FEF3C7",

                            borderRadius: 999,

                            padding: "2px 8px",
                          }}
                        >
                          Only {left} left!
                        </span>
                      )}
                      {isClaimed && (
                        <span
                          style={{
                            fontSize: 10,

                            fontWeight: 600,

                            color: GREEN,

                            background: "#D4F5EA",

                            borderRadius: 999,

                            padding: "2px 8px",
                          }}
                        >
                          <Check
                            size={11}
                            aria-hidden="true"
                            style={{
                              display: "inline",
                              verticalAlign: -1,
                              marginRight: 2,
                            }}
                          />
                          Claimed
                        </span>
                      )}
                      {role !== "Seller" && onWaitlist && (
                        <span
                          style={{
                            fontSize: 10,

                            fontWeight: 600,

                            color: "#0369A1",

                            background: CYAN_L,

                            borderRadius: 999,

                            padding: "2px 8px",
                          }}
                        >
                          Queue #{waitEntry?.position ?? p.waitlist + 1}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 16,

                        fontWeight: 800,

                        color: INDIGO,

                        fontFamily: "'Josefin Sans',sans-serif",

                        marginBottom: 8,
                      }}
                    >
                      ₱{p.price.toLocaleString()}
                    </div>
                    {canEdit ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#6B7280" }}>
                          {availability.fullyLocked
                            ? "Locked"
                            : soldOut
                              ? "Claims locked · Waitlist open"
                              : availability.queuePending
                                ? "Allocating stock to waitlist"
                                : "Claims open"}
                        </span>
                        <span style={{ fontSize: 10, color: "#6B7280" }}>
                          Manual availability
                        </span>
                        <Toggle
                          on={!p.locked}
                          label={`${p.locked ? "Unlock" : "Lock"} ${p.name}`}
                          onChange={() => {
                            if (canEdit)
                              toggleBatchLock(setBatches, batch.id, pIdx)
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <label
                            htmlFor={`waitlist-limit-${waitlistLimitKey}`}
                            style={{
                              fontSize: 10,
                              color: "#6B7280",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Waitlist max
                          </label>
                          <input
                            id={`waitlist-limit-${waitlistLimitKey}`}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={
                              waitlistLimitDrafts[waitlistLimitKey] ??
                              (p.waitlistLimit !== undefined
                                ? String(p.waitlistLimit)
                                : "")
                            }
                            onChange={(event) =>
                              setWaitlistLimitDrafts((current) => ({
                                ...current,

                                [waitlistLimitKey]: event.target.value,
                              }))
                            }
                            placeholder="∞"
                            style={{
                              width: 54,
                              border: "1px solid #D1D5DB",
                              borderRadius: 6,
                              padding: "5px 7px",
                              fontSize: 11,
                            }}
                          />
                          <SecondaryBtn
                            size="sm"
                            disabled={savingWaitlistLimit === waitlistLimitKey}
                            onClick={() => saveWaitlistLimit(p, pIdx)}
                          >
                            {savingWaitlistLimit === waitlistLimitKey
                              ? "Saving…"
                              : "Save"}
                          </SecondaryBtn>
                        </div>
                      </div>
                    ) : role !== "Buyer" ? null : batch.locked ||
                      p.locked ||
                      (availability.fullyLocked && !onWaitlist) ? (
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        <>
                          <Lock size={13} aria-hidden="true" />{" "}
                          {soldOut && waitlistFull
                            ? "Locked · Waitlist full"
                            : "Locked"}
                        </>
                      </span>
                    ) : isClaimed ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: GREEN,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Check size={12} aria-hidden="true" /> In Claims
                      </span>
                    ) : !soldOut && availability.queuePending ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#0369A1",
                          fontWeight: 600,
                        }}
                      >
                        {onWaitlist
                          ? "On Waitlist"
                          : "Reserved for waitlisted buyers"}
                      </span>
                    ) : soldOut ? (
                      onWaitlist ? (
                        <span
                          style={{
                            fontSize: 11,

                            color: "#0369A1",

                            fontWeight: 600,
                          }}
                        >
                          On Waitlist
                        </span>
                      ) : waitlistFull ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#9CA3AF",
                            fontWeight: 600,
                          }}
                        >
                          Waitlist Full
                        </span>
                      ) : (
                        <PrimaryBtn
                          size="sm"
                          onClick={() => setWaitlistTarget({ p, pIdx })}
                        >
                          Join Waitlist
                        </PrimaryBtn>
                      )
                    ) : (
                      <PrimaryBtn
                        size="sm"
                        onClick={() => {
                          if (batch.groupOrdersEnabled) {
                            setPurchaseModeTarget({ p, key: pKey })
                          } else {
                            setClaimTarget({ p, key: pKey })
                          }
                        }}
                        style={{
                          background: "#C81E62",

                          boxShadow: "0 2px 8px rgba(200,30,98,0.35)",
                        }}
                      >
                        Claim this item
                      </PrimaryBtn>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Right: seller panel */}
        <div className="space-y-4">
          <Card>
            <div
              style={{
                fontSize: 11,

                fontWeight: 700,

                color: "#9CA3AF",

                letterSpacing: 0.8,

                marginBottom: 12,
              }}
            >
              SELLER
            </div>
            <div
              style={{
                display: "flex",

                alignItems: "center",

                gap: 10,

                cursor: "pointer",
              }}
              onClick={() => onSellerClick(batch.seller)}
              role="button"
              tabIndex={0}
              aria-label={`View ${batch.seller}'s shop`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()

                  onSellerClick(batch.seller)
                }
              }}
            >
              <Avatar name={batch.seller} size={40} />
              <div>
                <div
                  style={{
                    fontSize: 14,

                    fontWeight: 700,

                    color: "#111827",

                    fontFamily: "'Josefin Sans',sans-serif",

                    display: "flex",

                    alignItems: "center",

                    gap: 6,
                  }}
                >
                  {batch.seller}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6B7280",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span>Tap to view shop</span>
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,

                padding: "10px 12px",

                background: "#EEF0FF",

                borderRadius: 8,

                display: "flex",

                gap: 8,
              }}
            >
              <Link2
                size={16}
                aria-hidden="true"
                style={{ color: INDIGO, flexShrink: 0, marginTop: 1 }}
              />
              <div>
                <div
                  style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}
                >
                  Linked Facebook account
                </div>
                <div style={{ fontSize: 11, color: INDIGO }}>
                  facebook.com/{batch.seller.toLowerCase().replace(" ", ".")}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                  Credibility reference only — not a payment guarantee.
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div
              style={{
                fontSize: 11,

                fontWeight: 700,

                color: "#9CA3AF",

                letterSpacing: 0.8,

                marginBottom: 12,
              }}
            >
              BATCH PROGRESS
            </div>
            <div
              style={{
                display: "flex",

                justifyContent: "space-between",

                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {batch.claimed}/{batch.items} claimed
              </span>
              <span
                style={{
                  fontSize: 12,

                  fontWeight: 700,

                  color: pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                }}
              >
                {pct}%
              </span>
            </div>
            <div
              style={{
                background: "#F3F4F6",

                borderRadius: 999,

                height: 6,

                overflow: "hidden",

                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,

                  height: "100%",

                  background: pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,

                  borderRadius: 999,
                }}
              />
            </div>
            {[
              ["Items", String(batch.items)],

              ["Claimed", String(batch.claimed)],

              ["Remaining", String(batch.items - batch.claimed)],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",

                  justifyContent: "space-between",

                  padding: "5px 0",

                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{k}</span>
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}
                >
                  {v}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {galleryZoomOpen && role === "Buyer" && (
        <Modal
          title={selectedGalleryItem?.name ?? `${batch.title} photo`}
          variant="detail"
          showTitleIcon={false}
          width={900}
          onClose={() => setGalleryZoomOpen(false)}
        >
          <div className="claim-review-photo-zoom">
            <img
              src={selectedGalleryItem?.imageUrl ?? batchCoverSrc(batch.coverImage, batch.category)}
              alt={selectedGalleryItem?.name ?? `${batch.title} cover`}
            />
          </div>
        </Modal>
      )}

      {photoPreview && (
        <Modal
          title={`${photoPreview.name} photo`}
          variant="detail"
          showTitleIcon={false}
          width={900}
          onClose={() => setPhotoPreview(null)}
        >
          <div className="claim-review-photo-zoom">
            <img
              src={productImageUrl(photoPreview.name, 1200, photoPreview.imageUrl)}
              alt={photoPreview.name}
            />
          </div>
        </Modal>
      )}

      {claimTarget && (
        <ItemClaimModal
          batch={batch}
          product={
            batch.products.find((p) =>
              claimTarget.p.dbId
                ? p.dbId === claimTarget.p.dbId
                : p.name === claimTarget.p.name,
            ) ?? claimTarget.p
          }
          onConfirm={async (reservation) => {
            const claimed = await handleClaim(
              claimTarget.key,

              batch,

              claimTarget.p,

              reservation,
            )

            if (claimed) setClaimTarget(null)
          }}
          onClose={() => setClaimTarget(null)}
        />
      )}
      {purchaseModeTarget && (
        <GroupOrderChoiceModal
          onSolo={() => {
            setClaimTarget(purchaseModeTarget)
            setPurchaseModeTarget(null)
          }}
          onGroup={() => {
            setGroupOrderProductId(purchaseModeTarget.p.dbId ?? null)
            setPurchaseModeTarget(null)
            setGroupOrderOpen(true)
          }}
          onClose={() => setPurchaseModeTarget(null)}
        />
      )}
      {groupOrderOpen && (
        <GroupOrderModal
          batch={batch}
          initialProductId={groupOrderProductId ?? undefined}
          initialCode={sharedGroupCode}
          onCheckoutComplete={refreshData}
          onClose={() => {
            setGroupOrderOpen(false)
            setGroupOrderProductId(null)
          }}
        />
      )}
      {groupSettingsOpen && (
        <BatchGroupSettingsModal
          batch={batch}
          onSaved={(updated) =>
            setBatches((current) =>
              current.map((item) => (item.id === updated.id ? updated : item)),
            )
          }
          onClose={() => setGroupSettingsOpen(false)}
        />
      )}

      {waitlistTarget && (
        <JoinWaitlistModal
          productName={waitlistTarget.p.name}
          batchTitle={batch.title}
          price={waitlistTarget.p.price}
          limitPerUser={waitlistTarget.p.limitPerUser}
          onConfirm={(qty) => {
            handleJoinWaitlist(waitlistTarget.p, waitlistTarget.pIdx, qty)

            setWaitlistTarget(null)
          }}
          onClose={() => setWaitlistTarget(null)}
        />
      )}
      {contact && (
        <ContactModal
          name={batch.seller}
          context={batch.title}
          contactUrl={batch.sellerFb}
          onClose={() => setContact(false)}
        />
      )}
    </div>
  )
}
