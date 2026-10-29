import { batchFormationDeadline } from "./groupFormation";
import { requireSupabase } from "@/lib/supabase";
import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";

const GROUP_SELECT =
  "id,leader_id,batch_id,status,formation_deadline,payment_deadline,created_at,checked_out_at,final_subtotal,shipping_fee,payment_order_id,batches(title,ends_on,seller_id),group_order_members(user_id,status),group_order_commitments(user_id,quantity,unit_selling_price),orders!orders_group_order_id_fkey(id,status,fulfillment_stage,payments(amount,status))";

// "led": only groups the signed-in buyer leads (the original behavior).
// "participating": groups the buyer leads OR is an active member of. Row-level
// security (can_view_group_order) already limits what a buyer can read to their
// own groups, so no extra server filter is needed for members.
async function loadGroupOrders(scope: "led" | "participating"): Promise<LeaderGroupOrder[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in to view your group orders.");
  const me = auth.user.id;
  let query = client.from("group_orders").select(GROUP_SELECT);
  if (scope === "led") query = query.eq("leader_id", me);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? [])
    .map((row) => {
      const batch = row.batches as unknown as {
        title: string;
        ends_on: string;
        seller_id: string;
      } | null;
      return { ...row, batches: batch };
    })
    .filter(
      (row) =>
        row.leader_id === me ||
        (scope === "participating" &&
          (row.group_order_members ?? []).some((m) => m.user_id === me && m.status === "active")),
    );
  const ids = [
    ...new Set(
      rows
        .flatMap((row) => [
          row.batches?.seller_id,
          row.leader_id,
          ...(row.group_order_members ?? [])
            .filter((m) => m.status === "active")
            .map((m) => m.user_id),
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles, error: profileError } = await client
      .from("public_profiles")
      .select("id,display_name")
      .in("id", ids);
    if (profileError) throw profileError;
    for (const profile of profiles ?? []) names.set(profile.id, profile.display_name);
  }
  return rows.map((row) => {
    const isLeader = row.leader_id === me;
    const own = (row.group_order_commitments ?? []).filter((c) => c.user_id === me);
    const ownItemCount = own.reduce((sum, c) => sum + Number(c.quantity), 0);
    const ownSubtotal = own.reduce(
      (sum, c) => sum + Number(c.quantity) * Number(c.unit_selling_price),
      0,
    );
    const subtotal = (row.group_order_commitments ?? []).reduce(
      (sum, c) => sum + Number(c.quantity) * Number(c.unit_selling_price),
      0,
    );
    const amount = !row.checked_out_at
      ? subtotal
      : Number(row.final_subtotal ?? 0) + Number(row.shipping_fee ?? 0);
    const paid = (row.orders ?? [])
      .flatMap((o) => o.payments ?? [])
      .filter((p) => p.status === "verified")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const representative = row.orders?.find((o) => o.id === row.payment_order_id);
    return {
      id: row.id,
      leaderId: row.leader_id,
      batchId: row.batch_id,
      batchTitle: row.batches?.title ?? null,
      sellerName: names.get(row.batches?.seller_id ?? "") ?? "Seller unavailable",
      status: row.status,
      formationDeadline: row.batches?.ends_on
        ? batchFormationDeadline(row.batches.ends_on)
        : row.formation_deadline,
      paymentDeadline: row.payment_deadline,
      createdAt: row.created_at,
      viewerRole: isLeader ? ("leader" as const) : ("member" as const),
      leaderName: names.get(row.leader_id) ?? "Group leader",
      members: (row.group_order_members ?? [])
        .filter((m) => m.status === "active")
        .map((m) => ({ id: m.user_id, name: names.get(m.user_id) ?? "Group member" })),
      ownItemCount,
      ownSubtotal,
      // A member's card shows what they committed. The group total and payment
      // belong to the leader, who is the buyer on the resulting order.
      amount: isLeader ? amount : ownSubtotal,
      amountIsSubtotal: isLeader ? !row.checked_out_at || row.status === "waiting_for_seller" : true,
      amountRemaining: isLeader ? Math.max(0, amount - paid) : 0,
      shippingPending: isLeader && row.status === "waiting_for_seller",
      // Members cannot read the leader's order, so only the leader can see
      // shipping progress.
      fulfillmentStage: isLeader
        ? (representative?.fulfillment_stage ??
          (representative?.status === "completed" ? "delivered" : undefined))
        : undefined,
    };
  });
}

export const loadLedGroupOrders = () => loadGroupOrders("led");
export const loadMyGroupOrders = () => loadGroupOrders("participating");
