import { requireSupabase } from "@/lib/supabase";
export type BuyerAddress = {
  id: string;
  buyer_id: string;
  label: string;
  address_text: string;
  pin_lat: number;
  pin_lng: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};
export type AddressInput = Pick<
  BuyerAddress,
  "label" | "address_text" | "pin_lat" | "pin_lng" | "is_default"
>;
export async function loadBuyerAddresses(): Promise<BuyerAddress[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in to manage your addresses.");
  const { data, error } = await client
    .from("buyer_addresses")
    .select("*")
    .eq("buyer_id", auth.user.id)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (error) {
    if (["PGRST205", "42P01"].includes(error.code) && /\bbuyer_addresses\b/.test(error.message))
      throw new Error(
        "Saved addresses are not enabled on this database yet. You can still enter a one-time delivery address.",
      );
    throw error;
  }
  return data ?? [];
}
export async function saveBuyerAddress(id: string | null, input: AddressInput) {
  const { error } = await requireSupabase().rpc("save_buyer_address", {
    p_id: id,
    p_label: input.label,
    p_address_text: input.address_text,
    p_pin_lat: input.pin_lat,
    p_pin_lng: input.pin_lng,
    p_is_default: input.is_default,
  });
  if (error) throw error;
}
export async function changeBuyerAddress(action: "delete" | "default", id: string) {
  const { error } = await requireSupabase().rpc(
    action === "delete" ? "delete_buyer_address" : "set_default_buyer_address",
    { p_id: id },
  );
  if (error) throw error;
}
