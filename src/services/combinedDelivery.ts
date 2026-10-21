import { combinedDeliveryMutationError } from "./combinedDeliveryErrors";
import { requireSupabase } from "@/lib/supabase";
import type {
  SellerDeliveryRequest,
  CombinedDeliveryCandidate,
  CombinedDeliveryEligibility,
  CombinedDeliveryGroup,
  CombinedDeliveryRequest,
  CombinedDeliveryRequestCandidate,
  CombinedDeliveryRequestInput,
} from "@/types/combinedDelivery";

/** Combined delivery reads and participant-authorized workflow operations. */
export async function loadCombinedDeliveryCandidates(): Promise<CombinedDeliveryCandidate[]> {
  const { data, error } = await requireSupabase().rpc("combined_delivery_candidates");
  if (error) throw error;
  return data ?? [];
}

export async function previewCombinedDelivery(
  orderIds: string[],
): Promise<CombinedDeliveryEligibility> {
  const { data, error } = await requireSupabase().rpc("combined_delivery_eligibility", {
    p_order_ids: orderIds,
  });
  if (error) throw error;
  return data;
}

export async function loadCombinedDeliveryGroups(): Promise<CombinedDeliveryGroup[]> {
  const { data, error } = await requireSupabase()
    .from("combined_delivery_groups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadCombinedDeliveryRequestCandidates(): Promise<
  CombinedDeliveryRequestCandidate[]
> {
  const { data, error } = await requireSupabase().rpc("combined_delivery_request_candidates");
  if (error) throw error;
  return data ?? [];
}

export async function loadBuyerCombinedDeliveryRequests(): Promise<CombinedDeliveryRequest[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in to view delivery requests.");
  const { data, error } = await client
    .from("combined_delivery_groups")
    .select(
      "*, payment:combined_delivery_payment_accounts(*), members:combined_delivery_members(order_id,item_subtotal,released_at,order:orders(quantity,batch_products(name))), destination:delivery_destinations(pin_lat,pin_lng,address_text)",
    )
    .eq("buyer_id", auth.user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function requestCombinedDelivery(
  input: CombinedDeliveryRequestInput,
): Promise<CombinedDeliveryGroup> {
  const { data, error } = await requireSupabase().rpc("request_combined_delivery", {
    p_order_ids: input.orderIds,
    p_lat: input.destination.lat,
    p_lng: input.destination.lng,
    p_address: input.destination.address,
    p_confirm_destination: input.confirmDestination,
  });
  if (error) throw combinedDeliveryMutationError(error);
  return data;
}

export async function cancelCombinedDeliveryRequest(groupId: string): Promise<void> {
  const { error } = await requireSupabase().rpc("cancel_combined_delivery_request", {
    p_group_id: groupId,
  });
  if (error) throw combinedDeliveryMutationError(error);
}

export async function loadSellerDeliveryRequests(): Promise<SellerDeliveryRequest[]> {
  const { data, error } = await requireSupabase().rpc("seller_combined_delivery_requests");
  if (error) throw error;
  return data ?? [];
}
export async function reviewDeliveryRequest(
  groupId: string,
  action: "approve" | "reject" | "set_shipping_fee",
  reason?: string,
  fee?: number,
): Promise<CombinedDeliveryGroup> {
  const { data, error } = await requireSupabase().rpc("review_combined_delivery", {
    p_group_id: groupId,
    p_action: action,
    p_reason: reason ?? null,
    p_shipping_fee: fee ?? null,
  });
  if (error) throw combinedDeliveryMutationError(error);
  return data;
}

/** Only participant-owned requests proven ineligible server-side can recover. */
export async function recoverCombinedDeliveryRequest(
  groupId: string,
): Promise<CombinedDeliveryGroup> {
  const { data, error } = await requireSupabase().rpc("invalidate_combined_delivery_request", {
    p_group_id: groupId,
  });
  if (error) throw combinedDeliveryMutationError(error);
  return data;
}
