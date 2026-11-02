import { createClient } from "@supabase/supabase-js";

export const seller = "71000000-0000-0000-0000-000000000001";
export let state: any;
let client: ReturnType<typeof createClient>;
export function requireSupabase() {
  return client;
}

export function configureBatchImagesFixture() {
  state = {
    events: [],
    objects: new Set(),
    batches: new Map(),
    products: new Map(),
    uploads: 0,
    failUploadAt: 0,
    failRpc: false,
    commitThenFail: false,
    failUpdate: false,
    zeroUpdate: false,
    failCleanup: false,
    failRead: false,
  };
  client = createClient("https://kargo.test", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
        const reply = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        if (url.pathname.startsWith("/storage/v1/object/")) {
          if (method === "DELETE") {
            state.events.push({ kind: "cleanup", paths: body.prefixes });
            if (state.failCleanup) return reply({ message: "cleanup denied" }, 403);
            body.prefixes.forEach((path: string) => state.objects.delete(path));
            return reply([]);
          }
          const path = decodeURIComponent(url.pathname.split("/batch-media/")[1]);
          state.events.push({ kind: "upload", path });
          state.objects.add(path);
          state.uploads++;
          // Simulate storage accepting a file before its response fails.
          if (state.uploads === state.failUploadAt) return reply({ message: "upload failed" }, 400);
          return reply({ Key: `batch-media/${path}` });
        }
        const table = url.pathname.split("/").pop();
        if (table === "create_batch_with_products") {
          state.events.push({ kind: "rpc", body });
          if (state.failRpc) return reply({ code: "23514", message: "product rejected" }, 400);
          state.batches.set(body.p_batch_id, { id: body.p_batch_id, ...body.p_batch });
          body.p_products.forEach((product: any) =>
            state.products.set(product.id, {
              ...product,
              batch_id: body.p_batch_id,
            }),
          );
          if (state.commitThenFail) return reply({ code: "", message: "response lost" }, 503);
          return reply(body.p_batch_id);
        }
        if (table !== "batches" && table !== "batch_products") {
          throw new Error(`Unexpected request ${method} ${url}`);
        }
        const rows = [...(table === "batches" ? state.batches : state.products).values()].filter(
          (row: any) =>
            [...url.searchParams].every(
              ([key, value]) => !value.startsWith("eq.") || row[key] === value.slice(3),
            ),
        );
        if (method === "GET") {
          state.events.push({ kind: "read", table });
          if (state.failRead) return reply({ code: "42501", message: "read denied" }, 403);
          const accept = new Headers(init?.headers).get("accept") ?? "";
          return reply(accept.includes("object+json") ? rows[0] : rows);
        }
        if (method !== "PATCH") throw new Error(`Unexpected write ${method}`);
        state.events.push({ kind: "update", table, body, filters: [...url.searchParams] });
        if (state.failUpdate) return reply({ code: "23514", message: "update rejected" }, 400);
        if (state.zeroUpdate || rows.length !== 1) {
          return reply({ code: "PGRST116", message: "No matching row" }, 406);
        }
        Object.assign(rows[0], body);
        if (state.commitThenFail) return reply({ code: "", message: "response lost" }, 503);
        return reply(rows[0]);
      },
    },
  });
  client.auth.getUser = async () => ({ data: { user: { id: seller } as any }, error: null });
  return state;
}

export function configureProductImageReadFixture(
  role: "Buyer" | "Seller",
  options: {
    fallback?: boolean;
    catalog?: "absent" | "stale";
    imagePath?: string | null;
    combined?: boolean;
    waitlistArray?: boolean;
  } = {},
) {
  const requests: URL[] = [];
  const imagePath =
    options.imagePath === undefined ? "seller/closed/product.png" : options.imagePath;
  const product = {
    name: "Closed batch product",
    image_path: imagePath,
    batch_id: "closed-batch",
    selling_price: 110,
    batches: { title: "Closed batch", seller_id: "seller" },
  };
  const combined = options.combined
    ? [
        {
          order_id: "other-reservation",
          orders: {
            quantity: 1,
            batch_products: { name: "Other product", image_path: "seller/closed/combined.png" },
          },
        },
      ]
    : [];
  const payment = {
    id: "proof",
    status: "rejected",
    amount: 50,
    method_type: "GCash",
    submitted_at: "2026-10-29T00:00:00Z",
    combined,
    combined_delivery_group_id: options.combined ? "combined-group" : null,
  };
  const order = {
    id: "reservation",
    order_number: "KG-123",
    buyer_id: "buyer",
    seller_id: "seller",
    batch_product_id: "product",
    batch_products: product,
    quantity: 2,
    total_amount: 220,
    status: "payment_pending",
    created_at: "2026-10-29T00:00:00Z",
    reservation_expires_at: "2099-12-01T00:00:00Z",
    payments: [payment],
  };
  client = createClient("https://kargo.test", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        requests.push(url);
        const table = url.pathname.split("/").pop();
        const projection = url.searchParams.get("select") ?? "";
        const reply = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        if (
          options.fallback &&
          ["orders", "payments"].includes(table ?? "") &&
          projection.includes("combined_delivery")
        ) {
          return reply(
            {
              code: "PGRST200",
              message: "Missing combined_delivery_payment_reservations relationship",
            },
            400,
          );
        }
        if (table === "user_profiles")
          return reply({
            id: role === "Buyer" ? "buyer" : "seller",
            display_name: role,
            can_sell: role === "Seller",
            social_links: {},
            created_at: "2026-01-01T00:00:00Z",
          });
        if (table === "public_profiles")
          return reply([
            { id: "buyer", display_name: "Buyer" },
            { id: "seller", display_name: "Seller" },
          ]);
        if (table === "orders") return reply([order]);
        if (table === "payments") return reply([{ ...payment, orders: order }]);
        if (table === "batch_catalog" && options.catalog === "stale")
          return reply([
            {
              batch_id: "closed-batch",
              batch_title: "Stale catalog copy",
              batch_status: "closed",
              seller_id: "seller",
              seller_name: "Seller",
              starts_on: "2026-10-01",
              ends_on: "2026-10-02",
              category: "Food",
              reservation_hours: 24,
              batch_cover_path: null,
              product_id: "product",
              product_name: product.name,
              product_image_path: "catalog/stale.png",
              base_price: 100,
              markup: 10,
              selling_price: 110,
              quantity_total: 5,
            },
          ]);
        if (table === "waitlist_entries" && role === "Buyer") {
          if (projection.startsWith("id,"))
            return reply([
              {
                id: "waiting",
                batch_product_id: "product",
                joined_at: "2026-10-29T00:00:00Z",
                status: "waiting",
                desired_quantity: 1,
                batch_products: options.waitlistArray ? [product] : product,
              },
            ]);
          return reply([{ batch_product_id: "product", joined_at: "2026-10-29T00:00:00Z" }]);
        }
        return reply([]);
      },
    },
  });
  client.auth.getUser = async () => ({
    data: { user: { id: role === "Buyer" ? "buyer" : "seller", email: "image@kargo.test" } as any },
    error: null,
  });
  return { requests, imagePath };
}
