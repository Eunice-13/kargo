import { withSupabase } from "npm:@supabase/server"
import jsQR from "npm:jsqr@1.4.0"
import { Image } from "npm:imagescript@1.3.0"

const OFFICIAL_BIR_HOST = "verify.bir.gov.ph"
type RequestBody = { objectPath?: string }

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      const { objectPath } = (await request.json()) as RequestBody
      const userId = ctx.userClaims!.id
      if (!objectPath || objectPath.split("/", 1)[0] !== userId) {
        return Response.json({ error: "Invalid object path" }, { status: 400 })
      }

      const { data: profile, error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("bir_document_path,bir_status,account_status")
        .eq("id", userId)
        .single()
      if (profileError || !profile) return Response.json({ error: "Profile not found" }, { status: 404 })
      if (profile.account_status !== "active") return Response.json({ error: "Account is suspended" }, { status: 403 })
      if (profile.bir_status !== "pending" || profile.bir_document_path !== objectPath) {
        return Response.json({ error: "Submission is no longer current" }, { status: 409 })
      }

      const { data: badge, error: downloadError } = await ctx.supabaseAdmin.storage
        .from("bir-certificates")
        .download(objectPath)

      let status: "verified" | "none" = "none"
      let reason: "unreadable" | "bad_domain" | null = "unreadable"
      if (!downloadError && badge) {
        try {
          const decodedImage = await Image.decode(new Uint8Array(await badge.arrayBuffer()))
          const qr = jsQR(new Uint8ClampedArray(decodedImage.bitmap), decodedImage.width, decodedImage.height)
          if (qr?.data) {
            try {
              const target = new URL(qr.data.trim())
              if (target.protocol === "https:" && target.hostname.toLowerCase() === OFFICIAL_BIR_HOST) {
                status = "verified"
                reason = null
              } else reason = "bad_domain"
            } catch {
              reason = "bad_domain"
            }
          }
        } catch {
          reason = "unreadable"
        }
      }

      const { data: changed, error: updateError } = await ctx.supabaseAdmin.rpc("complete_bir_verification", {
        p_user_id: userId,
        p_expected_object_path: objectPath,
        p_status: status,
        p_flag_reason: null,
      })
      if (updateError) return Response.json({ error: updateError.message }, { status: 500 })
      if (!changed) return Response.json({ error: "Submission was replaced before verification completed" }, { status: 409 })
      return Response.json({ status, reason })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Verification failed" }, { status: 500 })
    }
  }),
}
