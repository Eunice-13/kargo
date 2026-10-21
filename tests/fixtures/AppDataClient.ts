import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient;
export const isSupabaseConfigured = true;
export const supabase = null;
export function requireSupabase() {
  return client;
}
export function configureAppDataFixture(
  role: "Buyer" | "Seller",
  paymentFailure?: { code: string; message: string },
  networkFailure = false,
) {
  const requests: URL[] = [];
  client = createClient("https://kargo.test", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        requests.push(url);
        const table = url.pathname.split("/").pop();
        let body: unknown = [];
        let status = 200;
        if (table === "user_profiles")
          body = {
            id: "user",
            display_name: "Test account",
            can_sell: role === "Seller",
            social_links: {},
            created_at: "2026-01-01T00:00:00Z",
          };
        if (table === "batch_catalog")
          body = [
            {
              batch_id: "existing-batch",
              batch_title: "Existing Pasabuy",
              batch_status: "live",
              seller_id: "user",
              seller_name: "Shop",
              starts_on: "2026-10-01",
              ends_on: "2026-10-30",
              category: "Food",
              reservation_hours: 48,
              product_id: "existing-product",
              product_name: "Existing product",
              base_price: 100,
              markup: 10,
              selling_price: 110,
              quantity_total: 20,
            },
          ];
        if (table === "public_profiles")
          body = [{ id: "user", display_name: "Shop", social_links: {} }];
        if (table === "orders" && networkFailure) throw new TypeError("Network unavailable");
        if (
          table === "orders" &&
          paymentFailure &&
          (url.searchParams.get("select") ?? "").includes("combined_delivery")
        ) {
          body = paymentFailure;
          status = 400;
        }
        if (paymentFailure && table?.startsWith("combined_delivery")) {
          body = {
            code: table.includes("request") ? "PGRST202" : "PGRST205",
            message: `Unavailable ${table}`,
          };
          status = 400;
        }
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  client.auth.getUser = async () => ({
    data: { user: { id: "user", email: "test@kargo.test" } as any },
    error: null,
  });
  return requests;
}
