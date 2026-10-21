import type { SupabaseClient } from "@supabase/supabase-js";

type SchemaError = { code?: string; message?: string; details?: string };
const legacyOrders =
  "*,batch_products(name,batch_id,batches(title)),payments(id,amount,status,method_type,submitted_at,reference_number,receipt_path,payer_account_name,payer_phone,buyer_contact_url,rejection_reason,rejection_deadline)";
const combinedOrders = legacyOrders.replace(
  "rejection_deadline)",
  "rejection_deadline,combined_delivery_group_id,combined:combined_delivery_payment_reservations(order_id,orders(quantity,batch_products(name))))",
);
const legacySubmissions =
  "*,orders!inner(id,total_amount,buyer_id,group_order_id,batch_products(name),group_orders!orders_group_order_id_fkey(id,final_subtotal,shipping_fee,group_order_commitments(quantity)))";
const combinedSubmissions = legacySubmissions.replace(
  "*,orders!inner",
  "*,combined:combined_delivery_payment_reservations(order_id,item_subtotal,orders(quantity,batch_products(name))),orders!inner",
);

/** Only an undeployed Phase 4 read dependency permits the legacy projection. */
export function missingCombinedPaymentSchema(error: SchemaError | null): boolean {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    (["PGRST200", "PGRST205", "42P01"].includes(error.code ?? "") &&
      /\bcombined_delivery_payment_reservations\b/.test(text)) ||
    (["42703", "PGRST204"].includes(error.code ?? "") &&
      /\bcombined_delivery_group_id\b/.test(text))
  );
}

/** Preserve the full Phase 4 read when available; never retry mutations or hide RLS errors. */
export async function loadPaymentCompatibleRows(
  client: Pick<SupabaseClient, "from">,
  view: "orders" | "submissions",
) {
  const orders = view === "orders";
  const read = (projection: string) =>
    client
      .from(orders ? "orders" : "payments")
      .select(projection)
      .order(orders ? "created_at" : "submitted_at", { ascending: false })
      .returns<any[]>();
  const result = await read(orders ? combinedOrders : combinedSubmissions);
  if (!missingCombinedPaymentSchema(result.error)) return result;
  return read(orders ? legacyOrders : legacySubmissions);
}
