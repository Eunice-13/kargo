import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
export const groupStatusLabels: Record<LeaderGroupOrder["status"], string> = {
  forming: "Forming",
  waiting_for_seller: "Waiting for seller",
  payment_pending: "Awaiting payment",
  payment_submitted: "Payment under review",
  payment_confirmed: "Payment confirmed",
  cancelled: "Cancelled",
  expired: "Expired",
};
export function groupCanManage(group: LeaderGroupOrder, now = Date.now()) {
  return group.status === "forming" && Date.parse(group.formationDeadline) > now;
}
export function groupIsActive(group: LeaderGroupOrder, now = Date.now()) {
  return (
    groupCanManage(group, now) ||
    ["waiting_for_seller", "payment_pending", "payment_submitted"].includes(group.status)
  );
}
// Groups that still need attention from the buyer: everything in progress, and
// for the leader a confirmed group until it is delivered. Members cannot see
// shipping, so a confirmed group moves to their past list.
export function groupIsOngoing(group: LeaderGroupOrder, now = Date.now()) {
  return (
    groupIsActive(group, now) ||
    (group.viewerRole !== "member" &&
      group.status === "payment_confirmed" &&
      group.fulfillmentStage !== "delivered")
  );
}
export function sortLeaderGroups(groups: LeaderGroupOrder[], now = Date.now()) {
  return [...groups].sort(
    (a, b) =>
      Number(groupIsActive(b, now)) - Number(groupIsActive(a, now)) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
}
