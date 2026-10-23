import { batchFormationDeadline } from "./groupFormation";
import { requireSupabase } from "@/lib/supabase";
import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
export async function loadLedGroupOrders(): Promise<LeaderGroupOrder[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in to view your group orders.");
  const { data, error } = await client
    .from("group_orders")
    .select(
      "id,leader_id,batch_id,status,formation_deadline,payment_deadline,created_at,checked_out_at,final_subtotal,shipping_fee,payment_order_id,batches(title,ends_on,seller_id),group_order_members(user_id,status),group_order_commitments(user_id,quantity,unit_selling_price),orders!orders_group_order_id_fkey(id,status,fulfillment_stage,payments(amount,status))",
    )
    .eq("leader_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((row) => {
    const batch = row.batches as unknown as {
      title: string;
      ends_on: string;
      seller_id: string;
    } | null;
    return { ...row, batches: batch };
  });
  const ids = [
    ...new Set(
      rows
        .filter((row) => row.leader_id === auth.user!.id)
        .flatMap((row) => [
          row.batches?.seller_id,
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
  return rows
    .filter((row) => row.leader_id === auth.user!.id)
    .map((row) => {
      const own = (row.group_order_commitments ?? []).filter((c) => c.user_id === auth.user!.id);
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
        members: (row.group_order_members ?? [])
          .filter((m) => m.status === "active")
          .map((m) => ({ id: m.user_id, name: names.get(m.user_id) ?? "Group member" })),
        ownItemCount: own.reduce((sum, c) => sum + Number(c.quantity), 0),
        ownSubtotal: own.reduce(
          (sum, c) => sum + Number(c.quantity) * Number(c.unit_selling_price),
          0,
        ),
        amount,
        amountIsSubtotal: !row.checked_out_at || row.status === "waiting_for_seller",
        amountRemaining: Math.max(0, amount - paid),
        shippingPending: row.status === "waiting_for_seller",
        fulfillmentStage:
          representative?.fulfillment_stage ??
          (representative?.status === "completed" ? "delivered" : undefined),
      };
    });
}
