export class GroupMembershipConflict extends Error {
  canLeave: boolean;
  constructor(canLeave: boolean) {
    super(
      "You can only join one group order per batch. You're already a member of another group in this batch.",
    );
    this.name = "GroupMembershipConflict";
    this.canLeave = canLeave;
  }
}
export function membershipError(error: { message?: string; details?: string; code?: string }) {
  if (
    /GROUP_MEMBERSHIP_CONFLICT|You already belong to (?:another )?(?:an? )?active group for this batch/i.test(
      error.message ?? "",
    ) ||
    (error.code === "23505" && /group_members_one_active_batch/.test(error.message ?? ""))
  ) {
    let canLeave = false;
    try {
      canLeave = JSON.parse(error.details ?? "{}").can_leave === true;
    } catch {
      /* Unknown state: do not recommend leaving. */
    }
    return new GroupMembershipConflict(canLeave);
  }
  return error;
}
type Membership = { group_order_id: string; group_orders: { status: string; created_at: string } };
const active = new Set(["forming", "waiting_for_seller", "payment_pending", "payment_submitted"]);
export function resolveGroupMembership(rows: Membership[]) {
  const current = rows.filter((r) => active.has(r.group_orders.status));
  if (current.length > 1)
    throw new Error(
      "Conflicting group memberships were found. Please contact support before changing this group.",
    );
  return (
    current[0] ??
    [...rows]
      .filter((r) => r.group_orders.status === "payment_confirmed")
      .sort(
        (a, b) =>
          Date.parse(b.group_orders.created_at) - Date.parse(a.group_orders.created_at) ||
          a.group_order_id.localeCompare(b.group_order_id),
      )[0]
  );
}
