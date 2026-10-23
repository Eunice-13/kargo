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
export function sortLeaderGroups(groups: LeaderGroupOrder[], now = Date.now()) {
  return [...groups].sort(
    (a, b) =>
      Number(groupIsActive(b, now)) - Number(groupIsActive(a, now)) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
}
