import { useState, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  Package,
  PackagePlus,
  CreditCard,
  CalendarX2,
  ReceiptText,
  Clock3,
  CheckCircle2,
  Plane,
  ClipboardList,
  Maximize2,
  Truck,
  X,
  FileText,
} from "lucide-react";

import type {
  ClaimRow,
  ClaimStatus,
  FulfillmentOrder,
  PayHistRow,
  Tab,
  SharedState,
} from "@/types";

import { navIntent } from "@/state/navIntent";

import { sortWaitlistUpcoming } from "@/data/waitlist";

import { INDIGO, CREAM, CYAN_L, GREEN, AMBER, TODAY } from "@/constants/theme";

import {
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  StatusBadge,
  InsufficientPaymentNotice,
  Countdown,
  BuyerProfileModal,
} from "@/components/shared";

import { BatchCheckoutModal } from "@/features/payments";

import type { PaymentSubmissionDetails } from "@/features/payments";

import {
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentBoard,
} from "@/features/fulfillment";
import { combinedRequestHasOpenPayment } from "@/features/combined-delivery";
import { OrderDetailsModal } from "@/features/orders";
import SalesReportModal from "./SalesReportModal";

import WaitlistModal from "./WaitlistModal";

import SellerWaitlistCard from "./SellerWaitlistCard";

import PopularBatchesCard from "./PopularBatchesCard";

import { isSupabaseConfigured } from "@/lib/supabase";

import { kargoApi } from "@/services";
import {
  countPendingExtensionRequests,
  createDemoSellerExtensionRequests,
} from "@/services/extensionRequests";

import {
  claimBelongsToPendingPayments,
  claimIsPayable,
  deadlineHasPassed,
} from "@/features/claims/claimExpiry";
import {
  claimShortfall,
  displayClaimStatus,
  reconcileRejectedClaim,
} from "@/features/claims/claimPaymentState";
import { claimPreview, combinedClaimMembers } from "./dashboardClaimRows";
import CombinedDeliveryDetailsModal from "./CombinedDeliveryDetailsModal";
import type { BuyerDeliveryRequestsState } from "@/features/combined-delivery/useBuyerDeliveryRequests";
import {
  buildClaimsListRows,
  getToPayTotal,
  isOpenPaymentStatus,
} from "@/features/claims/claimListRows";

export default function Dashboard({
  batches,

  claims,

  setClaims,

  toPay,

  setToPay,

  payHistory,

  setPayHistory,

  setTab,

  role,

  orders,

  fulfillment,

  setFulfillment,

  waitlist,

  setWaitlist,

  sellerWaitlist,

  user,

  setUser,

  refreshData,
  combinedDelivery,
}: SharedState & { combinedDelivery: BuyerDeliveryRequestsState }) {
  const [showPayAll, setShowPayAll] = useState(false);
  const [pendingExtensionRequestCount, setPendingExtensionRequestCount] = useState(() =>
    isSupabaseConfigured ? 0 : countPendingExtensionRequests(createDemoSellerExtensionRequests()),
  );

  const [isPhone, setIsPhone] = useState(false);

  const [buyerProfile, setBuyerProfile] = useState<{
    name: string;
    contactUrl?: string;
    socialLinks?: Record<string, string>;
    orderCounts: { completed: number; cancelled: number; incomplete: number };
  } | null>(null);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [portalExpandedBoard, setPortalExpandedBoard] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false,
  );

  const [showSalesReport, setShowSalesReport] = useState(false);

  const [showWaitlist, setShowWaitlist] = useState(false);
  const [combinedDetailsId, setCombinedDetailsId] = useState<string | null>(null);
  const [buyerOrderDetailsId, setBuyerOrderDetailsId] = useState<string | null>(null);
  const [activeWaitlistId, setActiveWaitlistId] = useState<string | null>(null);

  const board = useFulfillmentBoard(setFulfillment);

  const extensionRequestsRevision = useMemo(
    () =>
      claims
        .filter((claim) => claim.extensionRequested || claim.extensionStatus !== "none")
        .map((claim) => `${claim.id}:${claim.extensionStatus ?? "unknown"}`)
        .sort()
        .join("|"),
    [claims],
  );

  useEffect(() => {
    if (role !== "Seller") return;
    let active = true;

    const refreshExtensionRequestCount = async () => {
      if (!isSupabaseConfigured) {
        setPendingExtensionRequestCount(
          countPendingExtensionRequests(createDemoSellerExtensionRequests()),
        );
        return;
      }

      try {
        const { extensions } = await kargoApi.loadSellerExtensionRequests();
        if (active) {
          setPendingExtensionRequestCount(countPendingExtensionRequests(extensions));
        }
      } catch (error) {
        console.error("Unable to refresh seller extension request count.", error);
      }
    };

    void refreshExtensionRequestCount();
    window.addEventListener("focus", refreshExtensionRequestCount);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshExtensionRequestCount);
    };
  }, [extensionRequestsRevision, role, user.id]);

  useEffect(() => {
    const phoneQuery = window.matchMedia("(max-width: 620px)");
    const updatePhoneState = () => setIsPhone(phoneQuery.matches);

    updatePhoneState();
    phoneQuery.addEventListener("change", updatePhoneState);

    return () => phoneQuery.removeEventListener("change", updatePhoneState);
  }, []);

  const openBuyerProfile = (
    name: string,
    contactUrl?: string,
    socialLinks?: Record<string, string>,
  ) => {
    const buyerOrders = claims.filter((claim) => claim.buyer === name);
    setBuyerProfile({
      name,
      contactUrl,
      socialLinks,
      orderCounts: {
        completed: buyerOrders.filter(
          (claim) => claim.orderStatus === "completed" || claim.fulfillmentStage === "delivered",
        ).length,
        cancelled: buyerOrders.filter(
          (claim) =>
            claim.orderStatus === "cancelled" ||
            (!claim.orderStatus && claim.status === "Cancelled"),
        ).length,
        incomplete: buyerOrders.filter(
          (claim) =>
            ["expired"].includes(claim.orderStatus ?? "") ||
            (!claim.orderStatus && claim.status === "Expired"),
        ).length,
      },
    });
  };

  const waitlistSorted = useMemo(
    () => sortWaitlistUpcoming(waitlist),

    [waitlist],
  );

  const closestWaitlist = waitlistSorted[0] ?? null;

  const openWaitlist = () => {
    setActiveWaitlistId(closestWaitlist?.id ?? null);

    setShowWaitlist(true);
  };

  // Close the expanded board with Escape.

  useEffect(() => {
    if (!boardExpanded) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBoardExpanded(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [boardExpanded]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const updatePortalTarget = () => setPortalExpandedBoard(query.matches);

    updatePortalTarget();
    query.addEventListener("change", updatePortalTarget);

    return () => query.removeEventListener("change", updatePortalTarget);
  }, []);

  useEffect(() => {
    if (!boardExpanded || !portalExpandedBoard) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.scrollTo(scrollX, scrollY);
    };
  }, [boardExpanded, portalExpandedBoard]);

  const mountExpandedBoard = (layer: ReactNode, preserveSellerScope = false) => {
    if (!portalExpandedBoard) return layer;

    return createPortal(
      preserveSellerScope ? (
        <div className="seller-dashboard" style={{ display: "contents" }}>
          {layer}
        </div>
      ) : (
        layer
      ),
      document.body,
    );
  };

  const dashboardCombinedRequests = combinedDelivery.available
    ? combinedDelivery.requests.filter(
        (request) => request.payment && request.status === "shipping_fee_set",
      )
    : [];
  const reconciledDashboardClaims = claims.map((claim) =>
    reconcileRejectedClaim(claim, payHistory),
  );
  const activeClaimRows = combinedDelivery.ready
    ? buildClaimsListRows(reconciledDashboardClaims, "All", dashboardCombinedRequests).filter(
        (row) =>
          isOpenPaymentStatus(row.status) &&
          (!("type" in row) || combinedRequestHasOpenPayment(row.request)),
      )
    : [];
  const activeClaims: ClaimRow[] = activeClaimRows.flatMap((row) => {
    if (!("type" in row)) return [row];
    const memberClaims = reconciledDashboardClaims.filter((claim) =>
      row.request.members.some((member) => member.order_id === String(claim.id)),
    );
    const representative = memberClaims[0];
    return representative
      ? [
          {
            ...representative,
            status: row.status,
            amount: row.request.payment?.total ?? representative.amount,
            combinedDeliveryGroupId: row.request.id,
            combinedItemCount: row.request.members.length,
          },
        ]
      : [];
  });
  const pendingPaymentRows = activeClaimRows.filter((row) =>
    "type" in row
      ? combinedRequestHasOpenPayment(row.request) &&
        row.request.payment?.status !== "pending_review"
      : claimBelongsToPendingPayments(row),
  );
  const buyerPendingPaymentOrders: FulfillmentOrder[] = pendingPaymentRows.flatMap((row) => {
    if ("type" in row) {
      const representative = reconciledDashboardClaims.find((claim) =>
        row.request.members.some((member) => member.order_id === String(claim.id)),
      );
      if (!representative) return [];
      return [
        {
          id: `combined-${row.request.id}`,
          dbId: String(representative.id),
          col: "Pending Payment",
          perspective: "buyer",
          buyer: user.name,
          seller: representative.seller,
          product: `Combined Delivery · ${row.request.members.length} ${
            row.request.members.length === 1 ? "item" : "items"
          }`,
          qty: row.request.members.reduce(
            (total, member) => total + (member.order?.quantity ?? 1),
            0,
          ),
          amount: row.request.payment?.total ?? representative.amount,
        },
      ];
    }
    return [
      {
        id: String(row.id),
        dbId: String(row.id),
        col: "Pending Payment",
        perspective: "buyer",
        buyer: row.buyer || user.name,
        seller: row.seller,
        product: row.product,
        qty: row.qty,
        amount: row.amount,
        fulfillmentStage: row.fulfillmentStage,
      },
    ];
  });
  const dashboardFulfillment =
    role === "Seller"
      ? fulfillment
      : [
          ...fulfillment.filter(
            (order) => order.perspective !== "buyer" || order.col !== "Pending Payment",
          ),
          ...buyerPendingPaymentOrders,
        ];

  // Recent Claims preview: a fixed number of the most recent claims, shown in

  // full with NO internal scroll. Anything beyond this is reached via "View

  // All", matching the Seller Dashboard's Recent Orders preview pattern.

  const RECENT_CLAIMS_PREVIEW = 7;
  const PHONE_CLAIMS_PREVIEW = 3;

  const urgentPhonePreview = (rows: typeof claims) => {
    const urgent = rows
      .filter((claim) => claim.status === "Pending" && claim.hours > 0)
      .slice()
      .sort((a, b) => a.hours - b.hours);
    const remaining = rows.filter((claim) => !(claim.status === "Pending" && claim.hours > 0));

    return [...urgent, ...remaining].slice(0, PHONE_CLAIMS_PREVIEW);
  };

  // Combined Delivery collapses into one row per combined group; actionable
  // Pending / Insufficient rows lead so an outstanding balance is never hidden.
  const recentClaims = claimPreview(claims, payHistory).slice(0, RECENT_CLAIMS_PREVIEW);

  const visibleRecentClaims = recentClaims;

  const productImagesById = useMemo(() => {
    const images = new Map<string, string>();
    for (const product of batches.flatMap((batch) => batch.products)) {
      if (product.dbId && product.imageUrl) images.set(product.dbId, product.imageUrl);
    }
    return images;
  }, [batches]);

  const claimImageUrl = (claim: ClaimRow): string | undefined => {
    if (claim.groupOrderId) return undefined;

    // Combined deliveries retain a representative member's product identity,
    // so their thumbnails follow the same lookup as individual orders.

    const imageUrl = claim.productId ? productImagesById.get(claim.productId) : undefined;
    if (imageUrl) return imageUrl;

    return batches
      .find((batch) => batch.title === claim.batch && batch.seller === claim.seller)
      ?.products.find((product) => product.name === claim.product)?.imageUrl;
  };

  const combinedDetailsModal = combinedDetailsId ? (
    <CombinedDeliveryDetailsModal
      items={combinedClaimMembers(combinedDetailsId, claims, payHistory)}
      imageForClaim={claimImageUrl}
      onClose={() => setCombinedDetailsId(null)}
    />
  ) : null;

  const combinedDetailsButton = (claim: ClaimRow) => {
    const groupId = claim.combinedDeliveryGroupId;
    return groupId ? (
      <button
        type="button"
        className="mt-1 block text-xs font-semibold text-[#246B8F] underline underline-offset-2"
        aria-label={`View details for combined delivery containing ${claim.product}`}
        onClick={(event) => {
          event.stopPropagation();
          setCombinedDetailsId(groupId);
        }}
      >
        View details
      </button>
    ) : null;
  };

  const payableToPay = toPay.filter(
    (item) =>
      !item.deadlinePausedAt &&
      item.shippingState !== "waiting_for_seller" &&
      item.shippingState !== "correction_requested" &&
      !deadlineHasPassed(item),
  );

  const pendingTotal = getToPayTotal(reconciledDashboardClaims.filter(claimIsPayable));

  // "Completed Orders" must mean genuinely delivered/completed orders so the
  // stat agrees with the Fulfillment Board's Delivered column. The old source
  // (completedPayments) counted anything "Paid and Reserved" — which collapses
  // payment_confirmed/preparing/completed together — so an order still sitting
  // in Payment Confirmed or Preparing on the board was wrongly counted here.
  // Mirror the board exactly, the same way the seller stat (ordersFulfilled)
  // does: the buyer's Delivered column.
  const completedOrders = fulfillment.filter(
    (o) => o.perspective === "buyer" && o.col === "Delivered",
  );

  // ─── Seller stat sources (derived from live data, not hardcoded) ───────────

  // Scope to the signed-in seller's own batches.

  const myLiveBatches = batches.filter((b) => b.live && b.seller === user.name);

  const mySellerOrders = claims.filter((claim) => claim.seller === user.name);

  const collapsedSellerOrders = claimPreview(mySellerOrders, payHistory);

  const visibleSellerOrders = isPhone
    ? urgentPhonePreview(collapsedSellerOrders)
    : collapsedSellerOrders.slice(0, RECENT_CLAIMS_PREVIEW);

  // Only submitted proofs await seller verification. `payment_pending` means

  // the buyer has not paid yet, so it must not inflate this seller metric.

  const paymentsToVerify = mySellerOrders.filter(
    (claim) => claim.status === "Awaiting Verification",
  );

  // Match the seller's Orders Received > Pending filter, which is based on

  // claims and their payment history rather than the recent fulfillment board.

  const pendingReceivedOrders = mySellerOrders.filter((claim) => {
    if (claim.status === "Paid and Reserved") return false;

    if (claim.status === "Insufficient Payment") return true;

    return claim.status === "Pending";
  });

  const shippingFeesToSet = mySellerOrders.filter(
    (claim) =>
      claim.status === "Pending" &&
      claim.shippingApplies &&
      (claim.shippingState === "waiting_for_seller" ||
        claim.shippingState === "correction_requested"),
  );

  // Extension requests awaiting this seller's approval: claims on their orders

  // that requested an extension and are still pending a decision.

  // Orders fulfilled = orders moved to the board's "Delivered" column.

  const ordersFulfilled = fulfillment.filter((o) => o.col === "Delivered");

  const waitlistSub = closestWaitlist
    ? closestWaitlist.product && closestWaitlist.product !== "Product"
      ? `${closestWaitlist.product}${closestWaitlist.batch ? ` — ${closestWaitlist.batch}` : ""}`
      : closestWaitlist.batch || "Waitlisted item"
    : "No waitlisted items";

  const buyerStats = [
    {
      label: "Active Claims",

      value: combinedDelivery.ready ? String(activeClaims.length) : "—",

      icon: PackagePlus,

      sub: combinedDelivery.ready
        ? activeClaims.length === 0
          ? "No active claims"
          : `${activeClaims.length} awaiting payment or reservation`
        : "Checking active claims",

      sc: GREEN,

      bg: "linear-gradient(135deg, #E8F9F3 0%, #DDF7EC 55%, #CFF2E2 100%)",
    },

    {
      label: "Pending Payment",

      value: combinedDelivery.ready ? `₱${pendingTotal.toLocaleString()}` : "—",

      icon: CreditCard,

      sub: combinedDelivery.ready
        ? `${activeClaims.filter((claim) => claimIsPayable(claim)).length} items due soon`
        : "— items due soon",

      sc: AMBER,

      bg: "linear-gradient(135deg, #FFF8E8 0%, #FFF3D8 55%, #FFECC4 100%)",
    },

    {
      label: "Waitlist Position",

      value: closestWaitlist ? `#${closestWaitlist.position}` : "—",

      icon: CalendarX2,

      sub: waitlistSub,

      sc: "#EF4444",

      bg: "linear-gradient(135deg, #FDECEC 0%, #FBE3E6 55%, #F7D5DA 100%)",
    },

    {
      label: "Completed Orders",

      value: String(completedOrders.length),

      icon: ReceiptText,

      sub: "Delivered orders",

      sc: "#6B7280",

      bg: "linear-gradient(135deg, #FFFFFF 0%, #F5F7FB 55%, #E9EEF7 100%)",
    },
  ];

  const sellerStats = [
    {
      label: "Active Batches",

      value: String(myLiveBatches.length),

      icon: Plane,

      sub: "Open + Scheduled",

      sc: "#64E894",

      bg: "linear-gradient(135deg, #ECFFF4 0%, #DCF8E9 55%, #CFF1DF 100%)",
    },

    {
      label: "Awaiting Verification",

      value: String(paymentsToVerify.length),

      icon: Clock3,

      sub: "Payment proofs to review",

      sc: "#F4D85D",

      bg: "linear-gradient(135deg, #FFFBE3 0%, #FFF5D3 55%, #FFEDBD 100%)",
    },

    {
      label: "Extension Requests",

      value: String(pendingExtensionRequestCount),

      icon: ClipboardList,

      sub: "Awaiting your approval",

      sc: "#E62B48",

      bg: "linear-gradient(135deg, #FFF0F2 0%, #FCE2E6 55%, #F8D4DA 100%)",
    },

    {
      label: "Orders Fulfilled",

      value: String(ordersFulfilled.length),

      icon: CheckCircle2,

      sub: "Completed this quarter",

      sc: "#6B7280",

      bg: "linear-gradient(135deg, #FFFFFF 0%, #F5F7FB 55%, #E9EEF7 100%)",
    },
  ];

  const stats = role === "Seller" ? sellerStats : buyerStats;

  // Upcoming Deadlines is driven by the buyer's real pending, still-payable

  // claims — the SAME "Waiting for payment" rows shown in Recent Claims — so

  // the panel never renders empty when there are outstanding payments. Sorted

  // soonest-first and capped to a short preview.

  const upcoming = useMemo(
    () =>
      activeClaims

        .filter((c) => claimIsPayable(c))

        .sort((a, b) => a.hours - b.hours)

        .slice(0, 4),

    [activeClaims],
  );

  const handleBatchPayment = async (
    item: (typeof toPay)[number],

    method: string,

    referenceNumber: string,

    receipt: File | undefined,

    details: PaymentSubmissionDetails,
  ) => {
    const claim = claims.find(
      (candidate) => String(candidate.id) === String(item.orderId ?? item.id),
    );

    if (!claim || !claimIsPayable(claim) || deadlineHasPassed(item)) {
      alert("This claim has expired and can no longer be paid.");

      return false;
    }

    if (isSupabaseConfigured) {
      try {
        await kargoApi.submitPayment({
          orderId: item.orderId ?? String(item.id),

          method,

          amount: details.amountPaid,

          referenceNumber,

          receipt,

          payerAccountName: details.payerAccountName,

          payerPhone: details.payerPhone,

          buyerContactUrl: details.buyerContactUrl,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to submit payment.";

        if (message === "Order is not payable") {
          await refreshData();

          alert(
            "This order already has a submitted payment or is no longer payable. Your payment data has been refreshed.",
          );

          return false;
        }

        alert(message);

        return false;
      }

      await refreshData();

      return true;
    }

    setPayHistory((history) => [
      {
        id: history.length + 1,

        product: item.product,

        batch: "",

        method,

        amount: details.amountPaid,

        date: TODAY,

        status: (isSupabaseConfigured ? "Pending" : "Paid and Reserved") as ClaimStatus,
      },

      ...history,
    ]);

    if (!isSupabaseConfigured)
      setClaims((prev) =>
        prev.map((c) =>
          c.id === item.id && c.status === "Pending"
            ? { ...c, status: "Paid and Reserved" as ClaimStatus }
            : c,
        ),
      );

    if (!isSupabaseConfigured)
      setToPay((items) => items.filter((candidate) => candidate.id !== item.id));

    return true;
  };

  if (String(role) === "Seller") {
    return (
      <div className="seller-dashboard">
        <section className="seller-stats" aria-label="Seller summary">
          {sellerStats.map((stat, index) => (
            <article
              key={stat.label}
              className={`seller-stat seller-stat--${index + 1} fi`}
              role="button"
              tabIndex={0}
              aria-label={`Open ${stat.label}`}
              onClick={() => {
                if (stat.label === "Active Batches") setTab("Batches");

                if (stat.label === "Awaiting Verification") {
                  navIntent.orderFilter = "Pending";

                  setTab("My Claims");
                }

                if (stat.label === "Extension Requests") {
                  navIntent.openExtensionRequests = true;

                  setTab("Batches");
                }

                if (stat.label === "Orders Fulfilled") setTab("Payments");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();

                  event.currentTarget.click();
                }
              }}
              style={{
                animationDelay: `${index * 60}ms`,

                background: stat.bg,

                cursor: "pointer",
              }}
            >
              <stat.icon size={20} aria-hidden="true" style={{ color: stat.sc }} />
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
              <small style={{ color: stat.sc }}>{stat.sub}</small>
            </article>
          ))}
        </section>

        <div className="seller-orders-layout">
          <section className="seller-recent-orders">
            <div className="seller-section-heading">
              <h2>Recent Orders</h2>
              <button type="button" onClick={() => setTab("My Claims")}>
                View All
              </button>
            </div>
            <div className="seller-recent-orders__wrap">
              <table className="seller-recent-orders__table">
                <colgroup>
                  <col className="seller-recent-orders__col-product" />
                  <col className="seller-recent-orders__col-batch" />
                  <col className="seller-recent-orders__col-buyer" />
                  <col className="seller-recent-orders__col-amount" />
                  <col className="seller-recent-orders__col-status" />
                  <col className="seller-recent-orders__col-deadline" />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      "Products",

                      "Batch",

                      "Buyer",

                      "Amount",

                      "Status",

                      "Deadline",
                    ].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleSellerOrders.map((claim, index) => {
                    const buyerName = claim.buyer || claim.seller;

                    return (
                      <tr key={claim.id} onClick={() => setTab("My Claims")}>
                        <td>
                          <div className="seller-product-cell">
                            <ProductThumb name={claim.product} imageUrl={claimImageUrl(claim)} />
                            <span
                              className="seller-recent-orders__product-name"
                              title={
                                claim.combinedItemCount
                                  ? `${claim.product} · Combined Delivery · ${claim.combinedItemCount} items`
                                  : claim.product
                              }
                            >
                              {claim.product}
                              {claim.combinedItemCount ? (
                                <small
                                  style={{
                                    display: "block",
                                    color: "#6B7280",
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}
                                >
                                  Combined Delivery · {claim.combinedItemCount} items
                                </small>
                              ) : null}
                              {combinedDetailsButton(claim)}
                            </span>
                          </div>
                        </td>
                        <td title={claim.batch}>{claim.batch}</td>
                        <td>
                          <div className="seller-buyer-cell">
                            <Avatar name={buyerName} size={21} />
                            <span title={buyerName}>{buyerName}</span>
                          </div>
                        </td>
                        <td className="seller-order-amount">₱{claim.amount.toLocaleString()}</td>
                        <td className="seller-recent-orders__status-cell">
                          <div className="seller-recent-orders__status-group">
                            <StatusBadge
                              status={displayClaimStatus(claim.status)}
                              alert={
                                Boolean(claimShortfall(claim)) &&
                                (claim.status === "Pending" ||
                                  claim.status === "Insufficient Payment")
                              }
                            />
                            <InsufficientPaymentNotice
                              shortfall={claimShortfall(claim)}
                              status={claim.status}
                              compact
                              table
                            />
                          </div>
                        </td>
                        <td
                          title={
                            claim.deadlinePausedAt
                              ? "Paused — waiting for seller"
                              : claim.status === "Pending" && claim.hours > 0
                                ? `${claim.hours} hours remaining`
                                : "—"
                          }
                          className={`seller-dashboard-deadline${
                            claim.hours > 0 && claim.hours < 6
                              ? " is-urgent"
                              : index === 1
                                ? " is-warning"
                                : ""
                          }`}
                        >
                          {claim.status === "Pending" && claim.hours > 0 ? (
                            <Countdown
                              hours={claim.hours}
                              id={claim.id}
                              expiresAt={claim.expiresAt}
                              paused={Boolean(claim.deadlinePausedAt)}
                            />
                          ) : (
                            <span className="seller-recent-orders-dash">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleSellerOrders.length === 0 && (
                    <tr>
                      <td className="seller-recent-orders__empty" colSpan={6}>
                        No recent orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="seller-dashboard-sidebar">
            <section className="seller-side-card seller-pending-actions">
              <h2>Pending Actions</h2>
              {[
                {
                  icon: Clock3,

                  label: "Payments to Verify",

                  count: pendingReceivedOrders.length,

                  tab: "My Claims" as Tab,
                },

                {
                  icon: ClipboardList,

                  label: "Extension Requests",

                  count: pendingExtensionRequestCount,

                  tab: "Batches" as Tab,
                },

                {
                  icon: Package,

                  label: "Shipping Fees to Set",

                  count: shippingFeesToSet.length,

                  tab: "My Claims" as Tab,
                },
              ].map((action) => (
                <div className="seller-action-row" key={action.label}>
                  <action.icon size={19} aria-hidden="true" />
                  <div>
                    <strong>{action.label}</strong>
                    <small>{action.count} Pending</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (action.label === "Payments to Verify") navIntent.orderFilter = "Pending";

                      if (action.label === "Shipping Fees to Set")
                        navIntent.orderFilter = "Pending";

                      if (action.label === "Extension Requests")
                        navIntent.openExtensionRequests = true;

                      setTab(action.tab);
                    }}
                  >
                    View All
                  </button>
                </div>
              ))}
            </section>

            <PopularBatchesCard
              batches={batches}
              sellerName={user.name}
              onOpenBatch={(batch) => {
                navIntent.batchId = batch.id;
                setTab("Batches");
              }}
            />

            <SellerWaitlistCard groups={sellerWaitlist} />
          </aside>
        </div>

        <section className="seller-fulfillment-section">
          <div className="seller-section-heading seller-board-heading">
            <h2>Fulfillment Board</h2>
            <div>
              <button type="button" onClick={() => setShowSalesReport(true)}>
                <FileText size={14} aria-hidden="true" />
                Sales Report
              </button>
              <button type="button" onClick={() => setBoardExpanded(true)}>
                <Maximize2 size={14} aria-hidden="true" />
                Expand
              </button>
            </div>
          </div>
          <div className="seller-board-preview">
            <FulfillmentBoard
              fulfillment={fulfillment}
              role="seller"
              board={board}
              onExpand={() => setBoardExpanded(true)}
              onOpenProfile={(order) =>
                openBuyerProfile(order.buyer, order.buyerFb, order.buyerSocialLinks)
              }
            />
          </div>
          <FulfillmentLiveRegion text={board.announcement} />
        </section>

        {boardExpanded &&
          mountExpandedBoard(
            <>
              <div className="seller-board-dialog-backdrop hidden" aria-hidden="true" />
              <div
                className="seller-board-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Fulfillment Board — expanded view"
              >
                <header>
                  <div>
                    <button type="button" onClick={() => setBoardExpanded(false)}>
                      <X size={16} aria-hidden="true" />
                    </button>
                    <h2>Fulfillment Board</h2>
                  </div>
                  <span>Track all orders across fulfillment stages</span>
                </header>
                <div className="seller-board-dialog__body">
                  <div className="seller-board-dialog__columns">
                    <FulfillmentBoard
                      fulfillment={fulfillment}
                      role="seller"
                      board={board}
                      expanded
                      onOpenProfile={(order) =>
                        openBuyerProfile(order.buyer, order.buyerFb, order.buyerSocialLinks)
                      }
                    />
                  </div>
                </div>
                <FulfillmentLiveRegion text={board.announcement} />
              </div>
            </>,
            true,
          )}

        {combinedDetailsModal}
        {buyerProfile && (
          <BuyerProfileModal
            buyer={buyerProfile.name}
            contactUrl={buyerProfile.contactUrl}
            socialLinks={buyerProfile.socialLinks}
            orderCounts={buyerProfile.orderCounts}
            onClose={() => setBuyerProfile(null)}
          />
        )}
        {showSalesReport && (
          <SalesReportModal
            batches={batches}
            fulfillment={fulfillment}
            shopName={user?.name || "My Shop"}
            onClose={() => setShowSalesReport(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bdash">
      <div className="bdash-stats">
        {stats.map((s, i) => {
          const openCard = () => {
            if (s.label === "Waitlist Position") openWaitlist();
            else if (s.label === "Completed Orders") setTab("Payments");
            else {
              navIntent.openBatchCheckout = s.label === "Pending Payment";

              setTab("My Claims");
            }
          };

          return (
            <div
              key={s.label}
              className={`bdash-stat bdash-stat--${i + 1} fi bdash-stat--interactive`}
              style={{ background: s.bg, animationDelay: `${i * 60}ms` }}
              role="button"
              tabIndex={0}
              aria-label={`Open ${
                s.label === "Completed Orders"
                  ? "Payment History"
                  : s.label === "Pending Payment"
                    ? "Batch Checkout"
                    : s.label === "Active Claims"
                      ? "My Claims To Pay"
                      : "full waitlist"
              }`}
              onClick={openCard}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();

                  openCard();
                }
              }}
            >
              <div className="bdash-stat__icon" style={{ color: s.sc }}>
                <s.icon size={22} aria-hidden="true" />
              </div>
              <div className="bdash-stat__value">{s.value}</div>
              <div className="bdash-stat__label">{s.label}</div>
              <div className="bdash-stat__sub" style={{ color: s.sc }}>
                {s.sub}
              </div>
            </div>
          );
        })}
      </div>
      {role === "Seller" && (
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 340px" }}>
          <Card>
            <SH
              title="Recent Orders"
              action={<SecondaryBtn onClick={() => setTab("My Claims")}>View All</SecondaryBtn>}
            />
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Product", "Buyer", "Amount", "Status", "Deadline"].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "#9CA3AF",

                        fontWeight: 600,

                        fontSize: 11,

                        paddingBottom: 8,

                        textAlign: "left",

                        paddingRight: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claims.slice(0, 5).map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: "1px solid #F9FAFB" }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setTab("My Claims")}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <ProductThumb name={c.product} imageUrl={claimImageUrl(c)} />
                        <span style={{ color: "#111827", fontWeight: 500 }}>{c.product}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={c.seller} size={20} />
                        <span style={{ color: "#374151", fontSize: 12 }}>{c.seller}</span>
                      </div>
                    </td>
                    <td
                      className="py-2.5 pr-3"
                      style={{
                        color: "#111827",

                        fontWeight: 700,

                        fontFamily: "'Josefin Sans',sans-serif",
                      }}
                    >
                      ₱{c.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={displayClaimStatus(c.status)} />
                      <InsufficientPaymentNotice shortfall={claimShortfall(c)} status={c.status} compact />
                    </td>
                    <td className="py-2.5">
                      {c.status === "Pending" && c.hours > 0 ? (
                        <Countdown
                          hours={c.hours}
                          id={c.id}
                          expiresAt={c.expiresAt}
                          paused={Boolean(c.deadlinePausedAt)}
                        />
                      ) : (
                        <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card style={{ background: "#FFFBF5", border: "1px solid #FCE4C8" }}>
            <SH title="Pending Actions" />
            <div className="space-y-3">
              {[
                {
                  icon: ClipboardList,

                  label: "Payments to Verify",

                  count: paymentsToVerify.length,

                  tab: "Payments" as Tab,
                },

                {
                  icon: Clock3,

                  label: "Extension Requests",

                  count: pendingExtensionRequestCount,

                  tab: "Batches" as Tab,
                },

                {
                  icon: Package,

                  label: "Shipping Fees to Set",

                  count: shippingFeesToSet.length,

                  tab: "My Claims" as Tab,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "#fff",

                    borderRadius: 8,

                    border: "1px solid #E5E7EB",

                    padding: "10px 14px",

                    display: "flex",

                    alignItems: "center",

                    gap: 10,
                  }}
                >
                  <item.icon
                    size={18}
                    aria-hidden="true"
                    style={{ color: "#9CA3AF", flexShrink: 0 }}
                  />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 13,

                        fontWeight: 600,

                        color: "#111827",
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                      {item.count} pending
                    </div>
                  </div>
                  <SecondaryBtn
                    onClick={() => {
                      if (item.label === "Shipping Fees to Set") navIntent.orderFilter = "Pending";

                      setTab(item.tab);
                    }}
                  >
                    View All
                  </SecondaryBtn>
                </div>
              ))}
              <div
                style={{
                  background: "#D4F5EA",

                  borderRadius: 8,

                  padding: "10px 14px",

                  fontSize: 12,

                  color: "#065F46",

                  fontWeight: 600,

                  textAlign: "center",
                }}
              >
                <CheckCircle2
                  size={13}
                  aria-hidden="true"
                  style={{
                    display: "inline",

                    verticalAlign: -2,

                    marginRight: 4,
                  }}
                />
                No "Pay All Pending" needed — sellers verify, not pay.
              </div>
            </div>
          </Card>
        </div>
      )}
      {role !== "Seller" && (
        <div className="bdash-main">
          <div className="bdash-card">
            <div className="bdash-section-head">
              <h2>Recent Claims</h2>
              <button type="button" className="bdash-viewall" onClick={() => setTab("My Claims")}>
                View All
              </button>
            </div>
            <div className="bdash-table-wrap">
              <table className="bdash-table">
                <thead>
                  <tr>
                    {[
                      "Products",

                      "Batch",

                      "Seller",

                      "Amount",

                      "Status",

                      "Deadline",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRecentClaims.map((c) => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => setTab("My Claims")}>
                      <td>
                        <div className="bdash-cell-product">
                          <ProductThumb name={c.product} imageUrl={claimImageUrl(c)} />
                          <span>
                            {c.product}
                            {c.combinedItemCount ? (
                              <small
                                style={{
                                  display: "block",
                                  color: "#6B7280",
                                  fontSize: 10,
                                  fontWeight: 600,
                                }}
                              >
                                Combined Delivery · {c.combinedItemCount} items
                              </small>
                            ) : null}
                            {combinedDetailsButton(c)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="bdash-cell-batch">{c.batch}</span>
                      </td>
                      <td>
                        <div className="bdash-cell-seller">
                          <Avatar name={c.seller} size={20} />
                          <span>{c.seller}</span>
                        </div>
                      </td>
                      <td>
                        <span className="bdash-cell-amount">₱{c.amount.toLocaleString()}</span>
                      </td>
                      <td>
                        <div className="bdash-status-group">
                          <StatusBadge status={displayClaimStatus(c.status)} />
                          <InsufficientPaymentNotice shortfall={claimShortfall(c)} status={c.status} compact />
                        </div>
                      </td>
                      <td>
                        {c.status === "Pending" && c.hours > 0 ? (
                          <Countdown hours={c.hours} id={c.id} expiresAt={c.expiresAt} />
                        ) : (
                          <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recentClaims.length === 0 && <div className="bdash-empty">No recent claims.</div>}
          </div>

          <aside className="bdash-side">
            <h2>Upcoming Deadlines</h2>
            {upcoming.map((d, i) => (
              <div
                key={i}
                className={`bdash-deadline${d.hours < 6 ? " bdash-deadline--urgent" : ""}`}
              >
                <div>
                  <div className="bdash-deadline__name">{d.product}</div>
                  <div className="bdash-deadline__seller">{d.seller}</div>
                </div>
                <div>
                  <div className="bdash-deadline__amount">₱{d.amount.toLocaleString()}</div>
                  <div className="bdash-deadline__time">
                    <Countdown hours={d.hours} id={d.id} expiresAt={d.expiresAt} />
                  </div>
                </div>
              </div>
            ))}
            {upcoming.length > 0 ? (
              <button type="button" className="bdash-payall" onClick={() => setShowPayAll(true)}>
                Pay All Pending
              </button>
            ) : (
              <div className="bdash-cleared">
                <CheckCircle2
                  size={13}
                  aria-hidden="true"
                  style={{
                    display: "inline",

                    verticalAlign: -2,

                    marginRight: 4,
                  }}
                />
                No upcoming deadlines!
              </div>
            )}
          </aside>
        </div>
      )}
      <section className="buyer-fulfillment-section">
        <div className="seller-section-heading seller-board-heading">
          <h2>Fulfillment Board</h2>
          <div className="seller-board-heading__actions">
            <button
              type="button"
              className="bdash-track-order"
              onClick={() => {
                // Jump straight to a shipment in progress. "In delivery" is the
                // shipped/in_transit stage; open its tracking view if one
                // exists, otherwise fall back to the full Orders tab.
                const inDelivery = orders.find(
                  (order) =>
                    order.fulfillmentStage === "shipped" || order.fulfillmentStage === "in_transit",
                );
                if (inDelivery) setBuyerOrderDetailsId(inDelivery.dbId || inDelivery.id);
                else setTab("Orders");
              }}
            >
              <Truck size={14} aria-hidden="true" />
              Track order
            </button>
            <button type="button" onClick={() => setBoardExpanded(true)}>
              <Maximize2 size={14} aria-hidden="true" />
              Expand
            </button>
          </div>
        </div>
        {combinedDelivery.error && !combinedDelivery.loading && (
          <div
            role="alert"
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <span>{combinedDelivery.error}</span>
            <button
              type="button"
              className="min-h-11 px-2 font-semibold underline"
              onClick={() => void combinedDelivery.reload()}
            >
              Retry
            </button>
          </div>
        )}
        <FulfillmentBoard
          fulfillment={dashboardFulfillment}
          role="buyer"
          board={board}
          loading={!combinedDelivery.ready}
          onExpand={() => setBoardExpanded(true)}
          onViewOrder={(order) => setBuyerOrderDetailsId(order.dbId || order.id)}
        />
        <FulfillmentLiveRegion text={board.announcement} />
      </section>
      {boardExpanded &&
        mountExpandedBoard(
          <>
            <div className="seller-board-dialog-backdrop hidden" aria-hidden="true" />
            <div
              className="seller-board-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Fulfillment Board — expanded view"
            >
              <header>
                <div>
                  <button type="button" onClick={() => setBoardExpanded(false)}>
                    <X size={16} aria-hidden="true" />
                  </button>
                  <h2>Fulfillment Board</h2>
                </div>
                <span>Track all orders across fulfillment stages</span>
              </header>
              <div className="seller-board-dialog__body">
                <div className="seller-board-dialog__columns">
                  <FulfillmentBoard
                    fulfillment={dashboardFulfillment}
                    role="buyer"
                    board={board}
                    expanded
                    loading={!combinedDelivery.ready}
                    onViewOrder={(order) => setBuyerOrderDetailsId(order.dbId || order.id)}
                  />
                </div>
              </div>
            </div>
          </>,
        )}
      {buyerOrderDetailsId &&
        (() => {
          const order = orders.find(
            (candidate) =>
              candidate.dbId === buyerOrderDetailsId || candidate.id === buyerOrderDetailsId,
          );
          return order ? (
            <OrderDetailsModal
              order={order}
              payHistory={payHistory}
              onClose={() => setBuyerOrderDetailsId(null)}
            />
          ) : null;
        })()}
      {combinedDetailsModal}
      {showPayAll && (
        <BatchCheckoutModal
          items={payableToPay}
          contactPrefill={user.fb || ""}
          onSubmit={handleBatchPayment}
          onClose={() => setShowPayAll(false)}
        />
      )}
      {buyerProfile && (
        <BuyerProfileModal
          buyer={buyerProfile.name}
          contactUrl={buyerProfile.contactUrl}
          socialLinks={buyerProfile.socialLinks}
          orderCounts={buyerProfile.orderCounts}
          onClose={() => setBuyerProfile(null)}
        />
      )}
      {showSalesReport && (
        <SalesReportModal
          batches={batches}
          fulfillment={fulfillment}
          shopName={user?.name || "My Shop"}
          onClose={() => setShowSalesReport(false)}
        />
      )}
      {showWaitlist && (
        <WaitlistModal
          entries={waitlist}
          activeId={activeWaitlistId}
          onSelect={setActiveWaitlistId}
          onClose={() => setShowWaitlist(false)}
          batchExists={(batchId) => batches.some((b) => b.id === batchId)}
          onViewBatch={(batchId) => {
            // Guard against a batch deleted between render and click: only
            // navigate when it still exists, so we never land on a blank page.
            if (!batches.some((b) => b.id === batchId)) return;

            navIntent.batchId = batchId;

            setShowWaitlist(false);

            setTab("Batches");
          }}
        />
      )}
    </div>
  );
}
