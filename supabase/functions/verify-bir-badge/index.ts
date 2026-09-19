import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import jsQR from "npm:jsqr@1.4.0"
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts"

const OFFICIAL_BIR_HOST = "verify.bir.gov.ph"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}

type RequestBody = { objectPath?: string }

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

    const { objectPath } = (await request.json()) as RequestBody
    const userId = userData.user.id
    if (!objectPath || objectPath.split("/", 1)[0] !== userId) {
      return json({ error: "Invalid object path" }, 400)
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("bir_document_path,bir_status,account_status")
      .eq("id", userId)
      .single()
    if (profileError || !profile) return json({ error: "Profile not found" }, 404)
    if (profile.account_status !== "active") return json({ error: "Account is suspended" }, 403)
    if (profile.bir_status !== "pending" || profile.bir_document_path !== objectPath) {
      return json({ error: "Submission is no longer current" }, 409)
    }

    const { data: badge, error: downloadError } = await admin.storage
      .from("bir-certificates")
      .download(objectPath)

    let status: "verified" | "flagged" = "flagged"
    let reason: "unreadable" | "bad_domain" | null = "unreadable"

    if (!downloadError && badge) {
      try {
        const decodedImage = await Image.decode(new Uint8Array(await badge.arrayBuffer()))
        const pixels = new Uint8ClampedArray(decodedImage.bitmap)
        const qr = jsQR(pixels, decodedImage.width, decodedImage.height)
        if (qr?.data) {
          try {
            const target = new URL(qr.data.trim())
            if (target.protocol === "https:" && target.hostname.toLowerCase() === OFFICIAL_BIR_HOST) {
              status = "verified"
              reason = null
            } else {
              reason = "bad_domain"
            }
          } catch {
            reason = "bad_domain"
          }
        }
      } catch {
        reason = "unreadable"
      }
    }

    const { data: changed, error: updateError } = await admin.rpc("complete_bir_verification", {
      p_user_id: userId,
      p_expected_object_path: objectPath,
      p_status: status,
      p_flag_reason: reason,
    })
    if (updateError) return json({ error: updateError.message }, 500)
    if (!changed) return json({ error: "Submission was replaced before verification completed" }, 409)

    return json({ status, reason })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Verification failed" }, 500)
  }
})

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
