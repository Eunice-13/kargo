import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
import { groupCanManage } from "./leaderGroupOrderPresentation";
export const groupSteps = ["Joined", "Seller confirms", "Payment", "Shipped", "Delivered"];
export const groupMoney = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
export function groupProgress(group: LeaderGroupOrder, now = Date.now()) {
  if (
    group.status === "cancelled" ||
    group.status === "expired" ||
    (group.status === "forming" && !groupCanManage(group, now))
  )
    return {
      step: 0,
      label: group.status === "cancelled" ? "Cancelled" : "Expired",
      tone: "neutral",
      title: "Group closed",
      description: "View the group for its recorded details.",
      payable: false,
    };
  if (group.status === "forming")
    return {
      step: 1,
      label: "Forming",
      tone: "neutral",
      title: "Build your group",
      description: "Manage members and commitments before the formation deadline.",
      payable: false,
    };
  if (group.status === "waiting_for_seller")
    return {
      step: 2,
      label: "Waiting for seller",
      tone: "waiting",
      title: "Seller confirmation",
      description: "The seller is reviewing the delivery location and shipping fee.",
      payable: false,
    };
  const deadlineOpen = Boolean(group.paymentDeadline && Date.parse(group.paymentDeadline) > now);
  if (group.status === "payment_pending")
    return {
      step: 3,
      label: deadlineOpen ? "Payment due" : "Payment deadline passed",
      tone: "due",
      title: deadlineOpen ? "Pay the group total" : "Payment deadline passed",
      description: deadlineOpen
        ? "Continue to My Claims to submit the group payment."
        : "Refresh to check the latest payment status.",
      payable: deadlineOpen && Number(group.amountRemaining) > 0,
    };
  if (group.status === "payment_submitted")
    return {
      step: 3,
      label: "Payment under review",
      tone: "waiting",
      title: "Payment verification",
      description: "The seller is reviewing your submitted payment proof.",
      payable: false,
    };
  if (group.fulfillmentStage === "delivered")
    return {
      step: 5,
      label: "Delivered",
      tone: "success",
      title: "Delivery complete",
      description: "Your group order has been marked delivered.",
      payable: false,
    };
  if (["shipped", "in_transit"].includes(group.fulfillmentStage ?? ""))
    return {
      step: 4,
      label: "Shipped",
      tone: "neutral",
      title: "Delivery in progress",
      description: "View your order in My Claims for tracking details.",
      payable: false,
    };
  return {
    step: 3,
    label: "Payment confirmed",
    tone: "success",
    title: "Preparing your order",
    description: "Payment is confirmed. Shipping has not been marked yet.",
    payable: false,
  };
}
export function groupTimeLeft(deadline: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  if (!Number.isFinite(seconds)) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

export function toggleGroupDetails(current: Set<string>, id: string, mobile: boolean) {
  if (current.has(id)) {
    const next = new Set(current);
    next.delete(id);
    return next;
  }
  return mobile ? new Set([id]) : new Set([...current, id]);
}
