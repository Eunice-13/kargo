import { productAvailability } from "./productAvailability";

import { canManageBatch } from "./batchAccess";
import { sellerLabel } from "./sellerLabel";

import { batchClosedByDate, batchOrdersClosed, formatBatchEndDate } from "./batchAvailability";

import { useEffect, useRef, useState } from "react";

import {
  Lock,
  ArrowLeft,
  ArrowRight,
  Plane,
  Check,
  ImageUp,
  Users,
  Tag,
  CalendarDays,
  Clock,
  MessageCircle,
  ChevronDown,
  Settings2,
} from "lucide-react";

import type {
  ClaimRow,
  ToPayRow,
  BatchType,
  Role,
  UserInfo,
  WaitlistEntry,
  ClaimReservationInput,
} from "@/types";
import { batchImage } from "@/constants/categories";
import { INDIGO, CYAN_L, GREEN, AMBER, batchCoverSrc } from "@/constants/theme";

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
} from "@/components/shared";
import { productImageUrl } from "@/components/shared/ProductThumb";

import ItemClaimModal from "./ItemClaimModal";

import JoinWaitlistModal from "./JoinWaitlistModal";
import GroupOrderModal, { GroupOrderChoiceModal } from "./GroupOrderModal";
import BatchGroupSettingsModal from "./BatchGroupSettingsModal";
import AddBatchItemsModal from "./AddBatchItemsModal";

import { toggleBatchLock } from "./toggleBatchLock";

import { isSupabaseConfigured } from "@/lib/supabase";

import { navIntent, subscribeNavIntent } from "@/state/navIntent";

import { kargoApi } from "@/services";
import { formatMoney } from "@/lib/format";
import "./batchEditorial.css";

export function getRelatedBatches(
  batchId: number,
  options: { limit?: number; source: BatchType[] },
): BatchType[] {
  const { limit = 5, source } = options;
  const current = source.find((candidate) => candidate.id === batchId);
  if (!current) return [];

  return source
    .filter(
      (candidate) =>
        candidate.id !== batchId &&
        candidate.live &&
        !batchOrdersClosed(candidate) &&
        candidate.claimed < candidate.items,
    )
    .map((candidate) => ({
      candidate,
      score:
        (candidate.category === current.category ? 1000 : 0) +
        (candidate.sellerId && candidate.sellerId === current.sellerId ? 500 : 0) +
        (candidate.title.toLowerCase().includes(current.title.toLowerCase()) ? 250 : 0) +
        Math.round((candidate.claimed / Math.max(1, candidate.items)) * 100),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

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
  batch: BatchType;

  role: Role;

  user: UserInfo;

  batches: BatchType[];

  claims: ClaimRow[];

  setClaims: React.Dispatch<React.SetStateAction<ClaimRow[]>>;

  toPay: ToPayRow[];

  setToPay: React.Dispatch<React.SetStateAction<ToPayRow[]>>;

  onBack: () => void;
  backLabel?: string;
  onSellerClick: (name: string) => void;

  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>;

  waitlist: WaitlistEntry[];

  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>;

  refreshData: () => Promise<void>;
}) {
  const batch = batches.find((b) => b.id === batchProp.id) ?? batchProp;

  const canEdit = canManageBatch(batch, user, role);

  // Claims, waitlists, and group orders all close together when the batch is
  // locked or past its end date, so the page never offers an action the server
  // will refuse.
  const ordersClosed = batchOrdersClosed(batch);

  const closedByDate = batchClosedByDate(batch);

  const [claimedKeys, setClaimedKeys] = useState<Record<string, boolean>>({});

  const [claimTarget, setClaimTarget] = useState<{
    p: (typeof batch.products)[0];

    key: string;
  } | null>(null);

  const [purchaseModeTarget, setPurchaseModeTarget] = useState<{
    p: (typeof batch.products)[0];
    key: string;
  } | null>(null);

  const sharedGroupCode =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("group") ?? "");

  const [groupOrderProductId, setGroupOrderProductId] = useState<string | null>(null);

  // A notification can open this batch straight onto one of its group orders.
  // Read it once on mount, and again if the batch is already on screen.
  const [groupOrderTargetId, setGroupOrderTargetId] = useState<string | null>(() => {
    const requested =
      role === "Buyer" && batch.groupOrdersEnabled ? navIntent.batchGroupOrderId : null;
    if (requested) navIntent.batchGroupOrderId = null;
    return requested;
  });

  const [groupOrderOpen, setGroupOrderOpen] = useState(
    role === "Buyer" &&
      batch.groupOrdersEnabled &&
      (Boolean(sharedGroupCode) || Boolean(groupOrderTargetId)),
  );

  useEffect(() => {
    if (role !== "Buyer" || !batch.groupOrdersEnabled) return;
    const openRequestedGroup = () => {
      const requested = navIntent.batchGroupOrderId;
      if (!requested) return;
      navIntent.batchGroupOrderId = null;
      setGroupOrderTargetId(requested);
      setGroupOrderOpen(true);
    };
    return subscribeNavIntent(openRequestedGroup);
  }, [role, batch.groupOrdersEnabled]);

  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [gallerySettingsOpen, setGallerySettingsOpen] = useState(false);
  const gallerySettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gallerySettingsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!gallerySettingsRef.current?.contains(event.target as Node)) {
        setGallerySettingsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGallerySettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [gallerySettingsOpen]);

  const [waitlistTarget, setWaitlistTarget] = useState<{
    p: (typeof batch.products)[0];

    pIdx: number;
  } | null>(null);

  const [contact, setContact] = useState(false);

  const [waitlistLimitDrafts, setWaitlistLimitDrafts] = useState<Record<string, string>>({});

  const [savingWaitlistLimit, setSavingWaitlistLimit] = useState<string | null>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

  const [photoPreview, setPhotoPreview] = useState<(typeof batch.products)[number] | null>(null);

  const [galleryZoomOpen, setGalleryZoomOpen] = useState(false);
  const [galleryAspect, setGalleryAspect] = useState(1);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const groupOrderButtonRef = useRef<HTMLButtonElement>(null);
  const [showMobileGroupBar, setShowMobileGroupBar] = useState(false);
  const relatedBatches = getRelatedBatches(batch.id, { limit: 5, source: batches });

  useEffect(() => {
    const button = groupOrderButtonRef.current;
    if (!button || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileGroupBar(!entry.isIntersecting),
      { threshold: 0.3 },
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  // Display-only category correction for the PLM thrift batch (its DB record
  // still reads "Food"). Visual only — does not touch the stored category.
  const BATCH_CATEGORY_OVERRIDES: Record<string, string> = {
    "PLM - October 2026": "Apparel",
  };
  const displayCategory = BATCH_CATEGORY_OVERRIDES[batch.title.trim()] ?? batch.category;

  // The stored gallery already leads with the batch photo followed by the item
  // photos. Fall back to that same order for local/seed batches that predate
  // the derived gallery, and to samples only when the batch has no media.
  // Each item remembers which product it belongs to so the matching card in
  // "Items in this Batch" can be highlighted while that photo is showing.
  const productIndexByImage = new Map<string, number>();
  batch.products.forEach((product, index) => {
    if (product.imageUrl && product.imageUrl !== batch.coverImage) {
      productIndexByImage.set(product.imageUrl, index);
    }
  });
  const derivedGalleryItems = (batch.galleryImages ?? []).length
    ? (batch.galleryImages ?? []).map((imageUrl, index) => {
        const productIndex = productIndexByImage.get(imageUrl);
        return {
          key: `batch-${index}`,
          imageUrl,
          name:
            productIndex !== undefined
              ? batch.products[productIndex].name
              : index === 0
                ? "Batch photo"
                : `Item photo ${index}`,
          productIndex,
        };
      })
    : [
        ...(batch.coverImage
          ? [
              {
                key: "cover",
                imageUrl: batchCoverSrc(batch.coverImage, batch.category),
                name: "Cover photo",
                productIndex: undefined,
              },
            ]
          : []),
        ...batch.products
          .filter((product) => product.imageUrl)
          .map((product, index) => ({
            key: product.dbId ?? product.id ?? `product-${index}`,
            imageUrl: product.imageUrl!,
            name: product.name,
            productIndex: batch.products.indexOf(product),
          })),
      ];
  const galleryItems = derivedGalleryItems.length
    ? derivedGalleryItems
    : [
        {
          key: "sample-cover",
          imageUrl: batchCoverSrc(batch.coverImage, batch.category),
          name: batch.coverImage ? "Cover photo" : "Sample cover photo",
          productIndex: undefined,
        },
        ...[1, 2].map((index) => ({
          key: `sample-${index}`,
          imageUrl: batchImage(batch.category, `${batch.id}-sample-${index}`),
          name: `Sample batch photo ${index}`,
          productIndex: undefined,
        })),
      ];
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const selectedGalleryItem = galleryItems[selectedProductIndex] ?? galleryItems[0];
  const highlightedProductIndex = selectedGalleryItem?.productIndex;

  const changeCoverPhoto = async (file?: File) => {
    if (!file || !canEdit) return;
    setUploadingPhoto("cover");
    try {
      const imageUrl = isSupabaseConfigured
        ? batch.dbId
          ? await kargoApi.updateBatchCover(batch.dbId, file)
          : (() => {
              throw new Error("This batch is missing its database identifier.");
            })()
        : URL.createObjectURL(file);

      setBatches((current) =>
        current.map((item) =>
          item.id === batch.id
            ? {
                ...item,
                coverImage: imageUrl,
                galleryImages: [
                  imageUrl,
                  ...(item.galleryImages ?? []).filter(
                    (url) => url !== item.coverImage && url !== imageUrl,
                  ),
                ],
              }
            : item,
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update photo.");
    } finally {
      setUploadingPhoto(null);
    }
  };

  const addBatchPhotos = async (files: File[]) => {
    if (!files.length || !canEdit) return;
    setUploadingPhoto("gallery");
    try {
      const imageUrls = isSupabaseConfigured
        ? batch.dbId
          ? await kargoApi.addBatchGalleryImages(batch.dbId, files)
          : (() => {
              throw new Error("This batch is missing its database identifier.");
            })()
        : files.map((file) => URL.createObjectURL(file));

      setBatches((current) =>
        current.map((item) =>
          item.id === batch.id
            ? { ...item, galleryImages: [...(item.galleryImages ?? []), ...imageUrls] }
            : item,
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to add batch photos.");
    } finally {
      setUploadingPhoto(null);
    }
  };

  const changeProductPhoto = async (
    product: (typeof batch.products)[0],
    productIndex: number,
    file?: File,
  ) => {
    if (!file || !canEdit) return;
    const key = product.dbId ?? `${batch.id}-${productIndex}`;
    setUploadingPhoto(key);
    try {
      const imageUrl = isSupabaseConfigured
        ? batch.dbId && product.dbId
          ? await kargoApi.updateProductImage(batch.dbId, product.dbId, file)
          : (() => {
              throw new Error("This item is missing its database identifier.");
            })()
        : URL.createObjectURL(file);

      setBatches((current) =>
        current.map((item) =>
          item.id !== batch.id
            ? item
            : {
                ...item,
                products: item.products.map((candidate, index) =>
                  index === productIndex ? { ...candidate, imageUrl } : candidate,
                ),
                galleryImages: (item.galleryImages ?? []).map((url) =>
                  url === product.imageUrl ? imageUrl : url,
                ),
              },
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update photo.");
    } finally {
      setUploadingPhoto(null);
    }
  };

  const pct = Math.round((batch.claimed / batch.items) * 100);

  const reserveHrs = batch.reserveHours || 48;

  const saveWaitlistLimit = async (
    product: (typeof batch.products)[0],

    productIndex: number,
  ) => {
    if (!canEdit) return;

    const key = product.dbId ?? `${batch.id}-${productIndex}`;

    const raw = waitlistLimitDrafts[key] ?? String(product.waitlistLimit ?? "");

    const parsed = Number(raw);

    if (raw.trim() !== "" && (!Number.isInteger(parsed) || parsed < 0)) {
      alert("Waitlist slots must be a whole number of 0 or more.");

      return;
    }

    const limit = raw.trim() === "" ? undefined : parsed;

    setSavingWaitlistLimit(key);

    try {
      if (isSupabaseConfigured) {
        if (!product.dbId) throw new Error("This product is missing its database identifier.");

        await kargoApi.setProductWaitlistLimit(product.dbId, limit);
      }

      setBatches((current) =>
        current.map((item) =>
          item.id !== batch.id
            ? item
            : {
                ...item,

                products: item.products.map((candidate, index) =>
                  index === productIndex ? { ...candidate, waitlistLimit: limit } : candidate,
                ),
              },
        ),
      );

      setWaitlistLimitDrafts((current) => ({
        ...current,

        [key]: limit !== undefined ? String(limit) : "",
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save waitlist limit.");
    } finally {
      setSavingWaitlistLimit(null);
    }
  };

  // Join a waitlist with the buyer's chosen quantity (from JoinWaitlistModal).

  const handleJoinWaitlist = async (
    p: (typeof batch.products)[0],

    pIdx: number,

    qty: number,
  ) => {
    const currentProduct = batch.products[pIdx];

    if (
      role !== "Buyer" ||
      !currentProduct ||
      !productAvailability(currentProduct, ordersClosed).canWaitlist
    ) {
      alert("This product is no longer available for waitlisting.");

      return;
    }

    if (isSupabaseConfigured) {
      if (!p.dbId) return;

      try {
        await kargoApi.joinWaitlist(p.dbId, qty);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to join waitlist.");

        return;
      }
    }

    setWaitlist((prev) => {
      if (
        prev.some(
          (e) =>
            (p.dbId && e.productId === p.dbId) || (e.batchId === batch.id && e.product === p.name),
        )
      ) {
        return prev;
      }

      const nextPos = p.waitlist + 1;

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
      ];
    });

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
    );
  };

  const handleClaim = async (
    key: string,

    b: BatchType,

    product: (typeof batch.products)[0],

    reservation: ClaimReservationInput,
  ) => {
    const qty = reservation.quantity;
    const claimQty = Math.max(1, Math.floor(qty));

    const currentProduct = b.products.find((p) =>
      product.dbId ? p.dbId === product.dbId : p.name === product.name,
    );
    const buyerClaimedQty = claims
      .filter(
        (claim) =>
          claim.status !== "Cancelled" &&
          claim.status !== "Expired" &&
          (product.dbId && claim.productId
            ? claim.productId === product.dbId
            : claim.batch === b.title && claim.product === product.name),
      )
      .reduce((total, claim) => total + claim.qty, 0);
    const buyerLimit =
      currentProduct?.limitPerUser && currentProduct.limitPerUser > 0
        ? currentProduct.limitPerUser
        : 5;

    if (
      role !== "Buyer" ||
      !currentProduct ||
      !productAvailability(currentProduct, batchOrdersClosed(b)).canClaim ||
      claimQty > currentProduct.qty - currentProduct.claimed
    ) {
      alert("This product no longer has enough available claim slots.");

      return false;
    }

    if (buyerClaimedQty + claimQty > buyerLimit) return false;

    if (isSupabaseConfigured) {
      if (!product.dbId) {
        alert("This product is missing its database identifier.");

        return false;
      }

      try {
        await kargoApi.claimProduct(product.dbId, reservation);
        await refreshData();

        setClaimedKeys((current) => ({ ...current, [key]: true }));

        return true;
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to claim this product.");

        return false;
      }
    }

    setClaimedKeys((c) => ({ ...c, [key]: true }));

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
                (product.dbId && prod.dbId === product.dbId) || prod.name === product.name
                  ? { ...prod, claimed: prod.claimed + claimQty }
                  : prod,
              ),
            },
      ),
    );

    const claimId = Date.now();

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + reserveHrs * 3_600_000).toISOString();
    const shippingApplies = reservation.paymentMethod !== "Cash on Meetup";
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
    ]);

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
      ]);

    return true;
  };

  return (
    <div className="p-6 fi batch-page">
      {/* Breadcrumb + share */}
      <div
        className="batch-detail-nav"
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
          <ArrowLeft size={14} aria-hidden="true" /> Back to Shop
        </button>
        <ShareButton batchId={batch.id} title={batch.title} label="Share" />
      </div>

      <section className="batch-gallery" aria-label={`${batch.title} photos`}>
        <div
          className="batch-gallery__main"
          style={{ "--gallery-aspect": String(galleryAspect) } as React.CSSProperties}
        >
          <img
            className="batch-gallery__ambient"
            src={selectedGalleryItem?.imageUrl ?? batchCoverSrc(batch.coverImage, batch.category)}
            alt=""
            aria-hidden="true"
          />
          {role === "Buyer" ? (
            <button
              type="button"
              className="batch-gallery__zoom-trigger"
              aria-label={`Zoom ${selectedGalleryItem?.name ?? `${batch.title} cover`}`}
              onClick={() => setGalleryZoomOpen(true)}
            >
              <img
                className="batch-gallery__foreground"
                src={
                  selectedGalleryItem?.imageUrl ?? batchCoverSrc(batch.coverImage, batch.category)
                }
                alt={selectedGalleryItem?.name ?? `${batch.title} cover`}
                onLoad={(event) => {
                  if (selectedProductIndex !== 0) return;
                  const image = event.currentTarget;
                  if (!image.naturalWidth || !image.naturalHeight) return;
                  setGalleryAspect(
                    Math.min(4 / 3, Math.max(3 / 4, image.naturalWidth / image.naturalHeight)),
                  );
                }}
              />
            </button>
          ) : (
            <img
              className="batch-gallery__foreground"
              src={selectedGalleryItem?.imageUrl ?? batchCoverSrc(batch.coverImage, batch.category)}
              alt={selectedGalleryItem?.name ?? `${batch.title} cover`}
            />
          )}
          <span className="batch-gallery__counter">
            {selectedProductIndex + 1}/{galleryItems.length}
          </span>
          {galleryItems.length > 1 && (
            <>
              <button
                type="button"
                className="batch-gallery__arrow batch-gallery__arrow--previous"
                aria-label="Previous item photo"
                onClick={() =>
                  setSelectedProductIndex(
                    (index) => (index - 1 + galleryItems.length) % galleryItems.length,
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
                  setSelectedProductIndex((index) => (index + 1) % galleryItems.length)
                }
              >
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            </>
          )}
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
          <div className="batch-gallery__dots" aria-label="Choose photo">
            {galleryItems.map((item, index) => (
              <button
                key={`${item.key}-dot`}
                type="button"
                className={index === selectedProductIndex ? "is-active" : ""}
                onClick={() => setSelectedProductIndex(index)}
                aria-label={`Show photo ${index + 1}`}
              />
            ))}
          </div>
        </div>
        <div className="batch-gallery__side">
          <h1>{batch.title}</h1>
          {ordersClosed && role === "Buyer" && (
            <span className="batch-gallery__status">
              <Lock size={14} aria-hidden="true" /> Not Accepting Orders
              {closedByDate && (
                <span className="batch-gallery__status-date">
                  Closed {formatBatchEndDate(batch.endsOn)}
                </span>
              )}
            </span>
          )}
          <div className="batch-editorial-meta">
            <div>
              <Tag size={16} aria-hidden="true" />
              <span>
                <small>Category</small>
                <strong>{displayCategory}</strong>
              </span>
            </div>
            <div>
              <CalendarDays size={16} aria-hidden="true" />
              <span>
                <small>Trip dates</small>
                <strong>{batch.trips}</strong>
              </span>
            </div>
            <div
              title={`Reserve within ${batch.reserveHours || 48}h of claiming`}
              className={(batch.reserveHours || 48) < 6 ? "is-closing" : ""}
              tabIndex={0}
              data-tooltip={`Reserve within ${batch.reserveHours || 48}h of claiming`}
            >
              <Clock size={16} aria-hidden="true" />
              <span>
                <small>Reservation</small>
                <strong>{batch.reserveHours || 48}h</strong>
              </span>
            </div>
          </div>
          <div className="batch-editorial-seller">
            <button type="button" onClick={() => onSellerClick(batch.seller)}>
              <Avatar name={sellerLabel(batch)} size={28} />
              by {sellerLabel(batch)}
            </button>
          </div>
          {batch.notes && (
            <div className={`batch-detail-description${descriptionExpanded ? " is-expanded" : ""}`}>
              <p>{batch.notes}</p>
              {batch.notes.length > 140 && (
                <button type="button" onClick={() => setDescriptionExpanded((value) => !value)}>
                  {descriptionExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
          <div className="batch-gallery__summary">
            <div className="batch-gallery__price">
              <span>From</span>
              {formatMoney(
                Math.min(...batch.products.map((product) => Number(product.price) || 0)),
              )}
              <small>per slot</small>
            </div>
            <div className="batch-continuous-progress" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="batch-gallery__claim-summary">
              {batch.claimed === 0 ? (
                <span>
                  {batch.items} of {batch.items} slots open
                </span>
              ) : (
                <span>
                  {batch.claimed} of {batch.items} claimed ·{" "}
                  <b>{Math.max(0, batch.items - batch.claimed)} left</b>
                </span>
              )}
            </div>
          </div>
          {role === "Buyer" && (
            <>
              <section className="batch-detail-section">
                <h2>In this batch ({batch.products.length})</h2>
                <div className="batch-detail-items">
                  {batch.products.map((product, index) => (
                    <div className="batch-detail-item" key={`${product.name}-${index}`}>
                      <button type="button" onClick={() => setSelectedProductIndex(index + 1)}>
                        <ProductThumb name={product.name} imageUrl={product.imageUrl} />
                        <span>
                          <strong>{product.name}</strong>
                          <small>{formatMoney(product.price)}</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="batch-detail-item__claim"
                        disabled={ordersClosed || product.qty - product.claimed <= 0}
                        onClick={() => setClaimTarget({ p: product, key: `${batch.id}-${index}` })}
                      >
                        {product.qty - product.claimed <= 0 ? "Sold out" : "Claim"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <div className="batch-panel-actions">
                <button
                  ref={groupOrderButtonRef}
                  type="button"
                  className="batch-panel-primary"
                  disabled={ordersClosed}
                  onClick={() => {
                    setGroupOrderProductId(null);
                    setGroupOrderOpen(true);
                  }}
                >
                  <Users size={16} aria-hidden="true" />
                  {ordersClosed ? "Join waitlist" : "Group Order"}
                </button>
                <button
                  type="button"
                  className="batch-panel-message"
                  onClick={() => setContact(true)}
                >
                  Message seller
                </button>
              </div>
              {showMobileGroupBar && (
                <div className="batch-mobile-actions">
                  <button
                    type="button"
                    className="batch-panel-primary"
                    disabled={ordersClosed}
                    onClick={() => {
                      setGroupOrderProductId(null);
                      setGroupOrderOpen(true);
                    }}
                  >
                    <Users size={16} aria-hidden="true" />
                    {ordersClosed ? "Join waitlist" : "Group Order"}
                  </button>
                  <button
                    type="button"
                    className="batch-mobile-message"
                    onClick={() => setContact(true)}
                    aria-label="Message seller"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
          <div className="batch-gallery__actions">
            {canEdit && (
              <div className="batch-gallery-settings" ref={gallerySettingsRef}>
                <button
                  type="button"
                  className="batch-gallery-settings__trigger"
                  aria-haspopup="true"
                  aria-expanded={gallerySettingsOpen}
                  onClick={() => setGallerySettingsOpen((value) => !value)}
                >
                  <Settings2 size={15} aria-hidden="true" />
                  Settings
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={gallerySettingsOpen ? "is-open" : ""}
                  />
                </button>
                {gallerySettingsOpen && (
                  <div className="batch-gallery-settings__menu" aria-label="Batch settings">
                    <label
                      className="batch-gallery-settings__item"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.currentTarget.querySelector("input")?.click();
                        }
                      }}
                    >
                      <ImageUp size={15} aria-hidden="true" />
                      <span>
                        {uploadingPhoto === "gallery" ? "Uploading…" : "Add batch photos"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        disabled={uploadingPhoto !== null}
                        onChange={(event) => {
                          void addBatchPhotos(Array.from(event.target.files ?? []));
                          event.currentTarget.value = "";
                          setGallerySettingsOpen(false);
                        }}
                      />
                    </label>
                    <label
                      className="batch-gallery-settings__item"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.currentTarget.querySelector("input")?.click();
                        }
                      }}
                    >
                      <ImageUp size={15} aria-hidden="true" />
                      <span>{uploadingPhoto === "cover" ? "Uploading…" : "Change cover"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={uploadingPhoto !== null}
                        onChange={(event) => {
                          changeCoverPhoto(event.target.files?.[0]);
                          setGallerySettingsOpen(false);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="batch-gallery-settings__item"
                      onClick={() => {
                        setGallerySettingsOpen(false);
                        setGroupSettingsOpen(true);
                      }}
                    >
                      <Users size={15} aria-hidden="true" />
                      Selling &amp; groups
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div
        className={`batch-page-layout${role === "Buyer" ? " batch-page-layout--buyer-gallery" : ""}`}
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
              <div className="flex items-center gap-2">
                {canEdit && (
                  <SecondaryBtn size="sm" onClick={() => setAddItemsOpen(true)}>
                    Add Item
                  </SecondaryBtn>
                )}
                {role === "Buyer" ? (
                  <SecondaryBtn onClick={() => setContact(true)}>Contact Seller</SecondaryBtn>
                ) : undefined}
              </div>
            }
          />
          <div className="space-y-3">
            {batch.products.map((p, pIdx) => {
              const pKey = `${batch.id}-${pIdx}`;

              const isClaimed = claimedKeys[pKey];

              // p.claimed is bumped by the claimed quantity on confirm, so it is

              // already authoritative — no extra manual offset needed.

              const left = p.qty - p.claimed;

              const buyerClaimedQty = claims
                .filter(
                  (claim) =>
                    claim.status !== "Cancelled" &&
                    claim.status !== "Expired" &&
                    (p.dbId && claim.productId
                      ? claim.productId === p.dbId
                      : claim.batch === batch.title && claim.product === p.name),
                )
                .reduce((total, claim) => total + claim.qty, 0);

              const buyerLimit = p.limitPerUser && p.limitPerUser > 0 ? p.limitPerUser : 5;

              const buyerLimitReached = role === "Buyer" && buyerClaimedQty >= buyerLimit;

              const remainingBuyerLimit = Math.max(0, buyerLimit - buyerClaimedQty);

              const availability = productAvailability(p, ordersClosed);

              const soldOut = availability.claimsFull;

              const waitEntry = waitlist.find(
                (e) =>
                  (p.dbId && e.productId === p.dbId) ||
                  (e.batchId === batch.id && e.product === p.name),
              );

              const onWaitlist = Boolean(waitEntry);

              const waitlistFull = availability.waitlistFull;

              const waitlistLimitKey = p.dbId ?? `${batch.id}-${pIdx}`;

              return (
                <Card
                  key={pIdx}
                  className={
                    pIdx === highlightedProductIndex
                      ? "batch-product-card is-gallery-selected"
                      : "batch-product-card"
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
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
                        <span>{uploadingPhoto === waitlistLimitKey ? "Uploading…" : "Photo"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          disabled={uploadingPhoto !== null}
                          onChange={(event) => changeProductPhoto(p, pIdx, event.target.files?.[0])}
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
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                      {p.sellingUnit === "box"
                        ? `${formatMoney(p.price)} / box · ${p.piecesPerBox ?? 1} pieces · `
                        : `${formatMoney(p.price)} / piece · `}
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
                  <div
                    className="batch-product-side"
                    style={{ textAlign: "right" as const, flexShrink: 0 }}
                  >
                    <div
                      className="batch-product-price"
                      style={{
                        fontSize: 16,

                        fontWeight: 800,

                        color: INDIGO,

                        fontFamily: "'Josefin Sans',sans-serif",

                        marginBottom: 8,
                      }}
                    >
                      {formatMoney(p.price)}
                    </div>
                    {canEdit ? (
                      <div
                        className="batch-product-controls"
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
                        <span style={{ fontSize: 10, color: "#6B7280" }}>Manual availability</span>
                        <Toggle
                          on={!p.locked}
                          label={`${p.locked ? "Unlock" : "Lock"} ${p.name}`}
                          onChange={() => {
                            if (canEdit) toggleBatchLock(setBatches, batch.id, pIdx);
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
                              (p.waitlistLimit !== undefined ? String(p.waitlistLimit) : "")
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
                            {savingWaitlistLimit === waitlistLimitKey ? "Saving…" : "Save"}
                          </SecondaryBtn>
                        </div>
                      </div>
                    ) : role !== "Buyer" ? null : ordersClosed ||
                      p.locked ||
                      (availability.fullyLocked && !onWaitlist) ? (
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        <>
                          <Lock size={13} aria-hidden="true" />{" "}
                          {closedByDate
                            ? `Closed ${formatBatchEndDate(batch.endsOn)}`
                            : soldOut && waitlistFull
                              ? "Locked · Waitlist full"
                              : "Locked"}
                        </>
                      </span>
                    ) : buyerLimitReached ? (
                      <span
                        role="status"
                        style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}
                      >
                        You have claimed the maximum amount for this batch item.
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
                        {onWaitlist ? "On Waitlist" : "Reserved for waitlisted buyers"}
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
                        <PrimaryBtn size="sm" onClick={() => setWaitlistTarget({ p, pIdx })}>
                          Join Waitlist
                        </PrimaryBtn>
                      )
                    ) : (
                      <PrimaryBtn
                        size="sm"
                        onClick={() => {
                          if (batch.groupOrdersEnabled) {
                            setPurchaseModeTarget({ p, key: pKey });
                          } else {
                            setClaimTarget({ p, key: pKey });
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
              );
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
              aria-label={`View ${sellerLabel(batch)}'s shop`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();

                  onSellerClick(batch.seller);
                }
              }}
            >
              <Avatar name={sellerLabel(batch)} size={40} />
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
                  {sellerLabel(batch)}
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
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {relatedBatches.length >= 2 && (
        <section className="batch-related" aria-labelledby="related-batches-title">
          <div className="batch-related__header">
            <h2 id="related-batches-title">You might like</h2>
            <button type="button" onClick={onBack}>
              See all
            </button>
          </div>
          <div className="batch-related__grid">
            {relatedBatches.map((related) => {
              const remaining = Math.max(0, related.items - related.claimed);
              const startingPrice = Math.min(
                ...related.products.map((product) => Number(product.price) || 0),
              );
              return (
                <button
                  type="button"
                  className="batch-related__card"
                  key={related.id}
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("batch", String(related.id));
                    window.location.assign(url);
                  }}
                >
                  <span className="batch-related__image">
                    <img
                      src={batchCoverSrc(related.coverImage, related.category)}
                      alt={`${related.title} batch`}
                    />
                    <small>{remaining} left</small>
                  </span>
                  <span className="batch-related__body">
                    <strong>{related.title}</strong>
                    <small>{sellerLabel(related)}</small>
                    <b>From {formatMoney(startingPrice)}</b>
                    <span className="batch-related__progress">
                      <i
                        style={{
                          width: `${Math.min(100, (related.claimed / Math.max(1, related.items)) * 100)}%`,
                        }}
                      />
                    </span>
                    <em>
                      {related.claimed}/{related.items} claimed
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

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
              claimTarget.p.dbId ? p.dbId === claimTarget.p.dbId : p.name === claimTarget.p.name,
            ) ?? claimTarget.p
          }
          remainingBuyerLimit={(() => {
            const product =
              batch.products.find((p) =>
                claimTarget.p.dbId ? p.dbId === claimTarget.p.dbId : p.name === claimTarget.p.name,
              ) ?? claimTarget.p;
            const buyerLimit =
              product.limitPerUser && product.limitPerUser > 0 ? product.limitPerUser : 5;
            const claimedQty = claims
              .filter(
                (claim) =>
                  claim.status !== "Cancelled" &&
                  claim.status !== "Expired" &&
                  (product.dbId && claim.productId
                    ? claim.productId === product.dbId
                    : claim.batch === batch.title && claim.product === product.name),
              )
              .reduce((total, claim) => total + claim.qty, 0);
            return Math.max(0, buyerLimit - claimedQty);
          })()}
          onConfirm={async (reservation) => {
            const claimed = await handleClaim(
              claimTarget.key,

              batch,

              claimTarget.p,

              reservation,
            );

            if (claimed) setClaimTarget(null);
          }}
          onClose={() => setClaimTarget(null)}
        />
      )}
      {purchaseModeTarget && (
        <GroupOrderChoiceModal
          onSolo={() => {
            setClaimTarget(purchaseModeTarget);
            setPurchaseModeTarget(null);
          }}
          onGroup={() => {
            setGroupOrderProductId(purchaseModeTarget.p.dbId ?? null);
            setPurchaseModeTarget(null);
            setGroupOrderOpen(true);
          }}
          onClose={() => setPurchaseModeTarget(null)}
        />
      )}
      {groupOrderOpen && (
        <GroupOrderModal
          key={groupOrderTargetId ?? "current"}
          batch={batch}
          groupOrderId={groupOrderTargetId ?? undefined}
          initialProductId={groupOrderProductId ?? undefined}
          initialCode={groupOrderTargetId ? "" : sharedGroupCode}
          onCheckoutComplete={refreshData}
          onClose={() => {
            setGroupOrderOpen(false);
            setGroupOrderProductId(null);
            setGroupOrderTargetId(null);
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
            handleJoinWaitlist(waitlistTarget.p, waitlistTarget.pIdx, qty);

            setWaitlistTarget(null);
          }}
          onClose={() => setWaitlistTarget(null)}
        />
      )}
      {contact && (
        <ContactModal
          name={sellerLabel(batch)}
          context={batch.title}
          contactUrl={batch.sellerFb}
          onClose={() => setContact(false)}
        />
      )}
      {addItemsOpen && (
        <AddBatchItemsModal
          onAdd={(added) => {
            setBatches((current) =>
              current.map((item) => {
                if (item.id !== batch.id) return item;
                return {
                  ...item,
                  products: [
                    ...item.products,
                    ...added.map((a, idx) => ({
                      ...a,
                      dbId: `new-${batch.id}-${item.products.length + idx}`,
                      id: item.products.length + idx + 1,
                      waitlist: 0,
                    })),
                  ],
                  items: item.items + added.reduce((s, p) => s + p.qty, 0),
                };
              }),
            );
          }}
          onClose={() => setAddItemsOpen(false)}
        />
      )}
    </div>
  );
}
