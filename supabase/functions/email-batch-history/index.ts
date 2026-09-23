import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Emails a seller a history-log summary when one of their batches closes
// (status becomes "locked"/"completed"). Mirrors the verify-bir-badge function:
// CORS, service-role client, JWT auth, server-side ownership check, then a side
// effect (here: compose the log + send the email). Actual delivery uses Resend
// when RESEND_API_KEY is configured; otherwise the composed log is returned so
// the flow is exercisable without an email provider wired.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}

type RequestBody = { batchId?: string }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authorization = request.headers.get("Authorization")
    if (!authorization) return json({ error: "Missing authorization" }, 401)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = getServerKey()
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Function environment is not configured" }, 500)
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const jwt = authorization.replace(/^Bearer\s+/i, "")
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401)
    const userId = userData.user.id

    const { batchId } = (await request.json()) as RequestBody
    if (!batchId) return json({ error: "Missing batchId" }, 400)

    // Ownership + state check: the caller must own the batch, and it must be
    // in a closed state (never email a history log for a still-live batch).
    const { data: batch, error: batchError } = await admin
      .from("batches")
      .select("id,title,status,seller_id,created_at")
      .eq("id", batchId)
      .single()
    if (batchError || !batch) return json({ error: "Batch not found" }, 404)
    if (batch.seller_id !== userId) return json({ error: "Not your batch" }, 403)
    if (batch.status !== "locked" && batch.status !== "completed") {
      return json({ error: "Batch is not closed" }, 409)
    }

    // ─── Compose the history-log entry ───────────────────────────────────────
    const { data: products } = await admin
      .from("batch_products")
      .select("id,name,quantity_total,selling_price")
      .eq("batch_id", batchId)

    const productIds = (products ?? []).map((p) => p.id)
    let orders: { batch_product_id: string; quantity: number; status: string; amount_due: number | null }[] = []
    if (productIds.length) {
      const { data: orderRows } = await admin
        .from("orders")
        .select("batch_product_id,quantity,status,amount_due")
        .in("batch_product_id", productIds)
      orders = orderRows ?? []
    }

    const lines = (products ?? []).map((p) => {
      const productOrders = orders.filter((o) => o.batch_product_id === p.id)
      const claimed = productOrders.reduce((sum, o) => sum + (o.quantity ?? 0), 0)
      const paid = productOrders
        .filter((o) => o.status === "paid_and_reserved" || o.status === "completed")
        .reduce((sum, o) => sum + (o.quantity ?? 0), 0)
      const revenue = productOrders
        .filter((o) => o.status === "paid_and_reserved" || o.status === "completed")
        .reduce((sum, o) => sum + Number(o.amount_due ?? 0), 0)
      return {
        product: p.name,
        stocked: p.quantity_total,
        claimed,
        paid,
        revenue,
      }
    })

    const historyLog = {
      batchId: batch.id,
      batchTitle: batch.title,
      closedStatus: batch.status,
      generatedAt: new Date().toISOString(),
      totals: {
        products: lines.length,
        claimed: lines.reduce((s, l) => s + l.claimed, 0),
        paid: lines.reduce((s, l) => s + l.paid, 0),
        revenue: lines.reduce((s, l) => s + l.revenue, 0),
      },
      lines,
    }

    // ─── Send to the seller's registered email ───────────────────────────────
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    const sellerEmail = authUser?.user?.email
    if (!sellerEmail) return json({ error: "Seller email not found" }, 404)

    const delivery = await sendEmail(sellerEmail, batch.title, historyLog)

    return json({ emailed: delivery.sent, to: sellerEmail, log: historyLog })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to email batch history" }, 500)
  }
})

async function sendEmail(
  to: string,
  batchTitle: string,
  log: unknown,
): Promise<{ sent: boolean }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  const from = Deno.env.get("BATCH_HISTORY_FROM_EMAIL")
  // Follow the existing pattern: real delivery only when the provider is
  // configured. Without it, we no-op gracefully and let the caller surface the
  // composed log (the trigger + content are the in-scope deliverables).
  if (!apiKey || !from) return { sent: false }

  const body = renderEmail(batchTitle, log)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `KARGO batch closed: ${batchTitle}`,
      html: body,
    }),
  })
  return { sent: res.ok }
}

function renderEmail(batchTitle: string, log: unknown): string {
  const data = log as {
    totals: { products: number; claimed: number; paid: number; revenue: number }
    lines: { product: string; stocked: number; claimed: number; paid: number; revenue: number }[]
  }
  const rows = data.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.product)}</td><td>${l.stocked}</td><td>${l.claimed}</td><td>${l.paid}</td><td>₱${l.revenue.toLocaleString()}</td></tr>`,
    )
    .join("")
  return `
    <h2>Batch closed: ${escapeHtml(batchTitle)}</h2>
    <p>Here's the final history log for this batch.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Product</th><th>Stocked</th><th>Claimed</th><th>Paid</th><th>Revenue</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Totals — products: ${data.totals.products}, claimed: ${data.totals.claimed}, paid: ${data.totals.paid}, revenue: ₱${data.totals.revenue.toLocaleString()}</p>
  `
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function getServerKey() {
  const namedKeys = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (namedKeys) {
    try {
      const parsed = JSON.parse(namedKeys) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // Fall through to local and legacy environment variable names.
    }
  }

  return (
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  )
}
