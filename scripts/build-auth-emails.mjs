// Build the six Supabase Auth (Brevo) email templates on the same shell as the
// Nylas transactional emails in supabase/functions/process-pending-emails/email.
//
// Supabase stores auth templates as self-contained HTML strings, so they cannot
// import layout.ts. This script is the single place they are composed: it emits
// one file per template plus a JSON bundle, and can push them to the live
// project so the two halves of the brand never drift.
//
//   node scripts/build-auth-emails.mjs            # write files + back up live
//   node scripts/build-auth-emails.mjs --dry      # sizes only
//   node scripts/build-auth-emails.mjs --push     # write, then PATCH live config
//
// Tokens mirror supabase/functions/process-pending-emails/email/brand.ts.

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "supabase", "email-templates")
const prevDir = join(outDir, "previous")

const args = new Set(process.argv.slice(2).map((a) => a.replace(/^--/, "")))
const dry = args.has("dry")
const push = args.has("push")

// ---------------------------------------------------------------- tokens ----

const C = {
  indigo: "#191BA9",
  cream: "#F7F3F3",
  surface: "#FFFFFF",
  ink: "#17212B",
  soft: "#41515F",
  mutedText: "#5B6B79",
  hairline: "#E7EBEF",
  hairlineSoft: "#EEF1F4",
}

const TONES = {
  neutral: { bg: "#F3F4F6", ink: "#41515F" },
  info: { bg: "#DEF3FA", ink: "#0B4C63" },
  success: { bg: "#D4F5EA", ink: "#0B6B4E" },
  warning: { bg: "#FEF3C7", ink: "#8A4B06" },
  danger: { bg: "#FEE2E2", ink: "#8F1D1D" },
  brand: { bg: "#EDEDFB", ink: "#191BA9" },
}

const DARK = {
  canvas: "#0F1319",
  surface: "#171C26",
  ink: "#EEF2F6",
  soft: "#C3CDD8",
  muted: "#93A1B0",
  hairline: "#2A3240",
  hairlineSoft: "#232B38",
  cream: "#1B212C",
}

const FONT = {
  display: "'Manrope','DM Sans','Segoe UI',Helvetica,Arial,sans-serif",
  body: "'DM Sans','Segoe UI',Helvetica,Arial,sans-serif",
}

const M = { width: 600, radius: 16, radiusSmall: 10, gutter: 32, gutterMobile: 20 }

// The ship mark is white on transparent, so it only reads on the indigo
// masthead. Served from the deployed app because the brand-assets bucket is
// not populated yet; both are the same file.
const LOGO = "https://kargo-eunice-13s-projects.vercel.app/kargo-logo-head.png"

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// ------------------------------------------------------------- fragments ----

const chipHtml = (chip) => {
  const { bg, ink } = TONES[chip.tone ?? "neutral"]
  return `<span style="display:inline-block;background:${bg};color:${ink};border-radius:999px;padding:5px 11px;font-family:${FONT.body};font-size:11.5px;font-weight:600;line-height:1.4;white-space:nowrap">${esc(chip.label)}</span>`
}

const banner = (strapline) => {
  const waterline = [46, 94, 142]
    .map(
      (width, i) =>
        `<div style="width:${width}px;height:2px;margin:0 auto ${i === 2 ? 0 : 6}px;background:rgba(255,255,255,${[0.26, 0.16, 0.09][i]})"></div>`,
    )
    .join("")

  return `<tr>
  <td class="k-banner" style="background:${C.indigo};padding:30px ${M.gutter}px 0;text-align:center">
    <img src="${LOGO}" width="40" height="46" alt="" border="0" style="display:block;margin:0 auto 12px;width:40px;height:46px;border:0;outline:none;text-decoration:none">
    <div style="font-family:${FONT.display};font-size:21px;font-weight:800;line-height:1;letter-spacing:0.34em;padding-left:0.34em;color:#FFFFFF">KARGO</div>
    <div style="margin-top:9px;font-family:${FONT.body};font-size:10.5px;font-weight:500;line-height:1.4;letter-spacing:0.19em;text-transform:uppercase;color:rgba(255,255,255,0.74)">${esc(strapline)}</div>
    <div style="padding:20px 0 14px">${waterline}</div>
  </td>
</tr>`
}

const strip = (label, address, chip) => `<tr>
  <td class="k-strip" style="background:${C.cream};padding:13px ${M.gutter}px;border-bottom:1px solid ${C.hairline}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
      <tr>
        <td valign="middle" align="left">
          <div style="font-family:${FONT.body};font-size:10px;font-weight:600;line-height:1.4;letter-spacing:0.15em;text-transform:uppercase;color:${C.mutedText}">${esc(label)}</div>
          <div class="k-strip-order" style="margin-top:3px;font-family:${FONT.display};font-size:13px;font-weight:700;line-height:1.4;letter-spacing:0.02em;color:${C.ink};word-break:break-all">${esc(address)}</div>
        </td>
        <td valign="middle" align="right" class="k-strip-right">${chipHtml(chip)}</td>
      </tr>
    </table>
  </td>
</tr>`

const focusBlock = (focus) => {
  const tone = TONES[focus.tone ?? "neutral"]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:24px 0 4px">
  <tr>
    <td style="background:${tone.bg};border-radius:${M.radiusSmall}px;padding:18px 20px;text-align:center">
      <div class="k-focus-label" style="font-family:${FONT.body};font-size:10.5px;font-weight:600;line-height:1.4;letter-spacing:0.12em;text-transform:uppercase;color:${tone.ink};opacity:0.82">${esc(focus.label)}</div>
      <div class="k-focus-value" style="margin-top:8px;font-family:${FONT.display};font-size:34px;font-weight:800;line-height:1.1;letter-spacing:0.22em;color:${tone.ink};font-variant-numeric:tabular-nums">${esc(focus.value)}</div>
      ${focus.note ? `<div style="margin-top:7px;font-family:${FONT.body};font-size:12.5px;line-height:1.5;color:${tone.ink};opacity:0.88">${esc(focus.note)}</div>` : ""}
    </td>
  </tr>
</table>`
}

const rowsHtml = (list) => {
  const body = list
    .map((row, i) => {
      const last = i === list.length - 1
      return `<tr>
        <td class="k-row-label" valign="top" style="padding:11px 16px 11px 0;border-bottom:${last ? "0" : `1px solid ${C.hairlineSoft}`};font-family:${FONT.body};font-size:13px;line-height:1.5;color:${C.mutedText}">${esc(row.label)}</td>
        <td class="k-row-value" valign="top" align="right" style="padding:11px 0;border-bottom:${last ? "0" : `1px solid ${C.hairlineSoft}`};font-family:${FONT.display};font-size:13.5px;font-weight:600;line-height:1.5;color:${C.ink};word-break:break-all">
          ${esc(row.value)}
          ${row.note ? `<div style="margin-top:2px;font-family:${FONT.body};font-size:11.5px;font-weight:400;line-height:1.45;color:${C.mutedText}">${esc(row.note)}</div>` : ""}
        </td>
      </tr>`
    })
    .join("")

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:20px 0 0">
    <tr><td colspan="2" style="padding:0"><div class="k-rule" style="height:1px;background:${C.hairline}"></div></td></tr>
    ${body}
  </table>`
}

const noteHtml = (block) => {
  const tone = TONES[block.tone ?? "neutral"]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:22px 0 0">
  <tr>
    <td style="background:${tone.bg};border-radius:${M.radiusSmall}px;padding:14px 16px">
      ${block.label ? `<div style="font-family:${FONT.body};font-size:10.5px;font-weight:700;line-height:1.4;letter-spacing:0.11em;text-transform:uppercase;color:${tone.ink}">${esc(block.label)}</div>` : ""}
      <div style="margin-top:${block.label ? "5px" : "0"};font-family:${FONT.body};font-size:13.5px;line-height:1.6;color:${tone.ink}">${esc(block.text)}</div>
    </td>
  </tr>
</table>`
}

const action = (cta) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:26px 0 0">
  <tr>
    <td align="left" class="k-cta-cell">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${cta.url}" style="height:46px;v-text-anchor:middle;width:230px" arcsize="18%" strokecolor="${C.indigo}" fillcolor="${C.indigo}"><w:anchorlock/><center style="color:#ffffff;font-family:${FONT.display};font-size:14px;font-weight:700">${esc(cta.label)}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${cta.url}" class="k-cta" style="display:inline-block;background:${C.indigo};color:#FFFFFF;border-radius:8px;padding:14px 26px;font-family:${FONT.display};font-size:14px;font-weight:700;line-height:1.2;letter-spacing:0.01em;text-decoration:none">${esc(cta.label)}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>
${cta.note ? `<div style="margin-top:10px;font-family:${FONT.body};font-size:12px;line-height:1.5;color:${C.mutedText}">${esc(cta.note)}</div>` : ""}`

const footer = (year) => `<tr>
  <td class="k-footer" style="background:${C.cream};padding:22px ${M.gutter}px 26px;border-top:1px solid ${C.hairline}">
    <div class="k-footer-mark" style="font-family:${FONT.display};font-size:11px;font-weight:800;letter-spacing:0.26em;color:${C.indigo}">KARGO</div>
    <div class="k-footer-text" style="margin-top:9px;font-family:${FONT.body};font-size:11.5px;line-height:1.65;color:${C.mutedText}">
      You are receiving this because someone used this address on KARGO. If this was not you, ignore this email and nothing will change.
      <a href="https://kargo-eunice-13s-projects.vercel.app/" style="color:${C.indigo};text-decoration:underline">Open KARGO</a>
    </div>
  </td>
</tr>
<tr>
  <td style="background:${C.cream};padding:0 ${M.gutter}px 22px;text-align:center">
    <div style="font-family:${FONT.body};font-size:10.5px;line-height:1.5;color:${C.mutedText}">KARGO &middot; Account security &middot; 20${String(year).slice(-2)}</div>
  </td>
</tr>`

// -------------------------------------------------------------- document ----

const document = ({ view, year }) => `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(view.title)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Manrope:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  a{color:${C.indigo}}
  @media (max-width:480px){
    .k-frame{width:100%!important;max-width:100%!important;border-radius:0!important}
    .k-gutter{padding-left:${M.gutterMobile}px!important;padding-right:${M.gutterMobile}px!important}
    .k-banner{padding-left:${M.gutterMobile}px!important;padding-right:${M.gutterMobile}px!important}
    .k-strip{padding-left:${M.gutterMobile}px!important;padding-right:${M.gutterMobile}px!important}
    .k-footer{padding-left:${M.gutterMobile}px!important;padding-right:${M.gutterMobile}px!important}
    .k-strip-right{text-align:left!important;padding-top:10px!important}
    .k-h1{font-size:22px!important}
    .k-focus-value{font-size:28px!important}
    .k-cta-cell{text-align:center!important}
    .k-cta{display:block!important;width:100%!important;padding:15px 18px!important;text-align:center!important;box-sizing:border-box!important}
    .k-shell{padding:0!important}
  }
  @media (prefers-color-scheme:dark){
    .k-canvas{background:${DARK.canvas}!important}
    .k-frame{background:${DARK.surface}!important;border-color:${DARK.hairline}!important}
    .k-body{background:${DARK.surface}!important}
    .k-h1,.k-row-value,.k-strip-order{color:${DARK.ink}!important}
    .k-lead,.k-row-label,.k-footer-text{color:${DARK.soft}!important}
    .k-strip{background:${DARK.cream}!important;border-color:${DARK.hairline}!important}
    .k-footer{background:${DARK.cream}!important;border-color:${DARK.hairline}!important}
    .k-row-label,.k-row-value{border-color:${DARK.hairlineSoft}!important}
    .k-rule{background:${DARK.hairline}!important}
    .k-footer-mark,.k-footer a{color:#B4C0FF!important}
  }
</style>
</head>
<body class="k-canvas" style="margin:0;padding:0;background:${C.cream};font-family:${FONT.body}">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${C.cream}">${esc(view.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="k-canvas" style="border-collapse:collapse;background:${C.cream}">
  <tr>
    <td align="center" class="k-shell" style="padding:26px 12px">
      <table role="presentation" width="${M.width}" cellpadding="0" cellspacing="0" border="0" class="k-frame" style="width:${M.width}px;max-width:${M.width}px;border-collapse:separate;background:${C.surface};border:1px solid ${C.hairline};border-radius:${M.radius}px;overflow:hidden">
        ${banner(view.strapline)}
        ${strip(view.stripLabel ?? "Account", view.address, view.chip)}
        <tr>
          <td class="k-body k-gutter" style="background:${C.surface};padding:30px ${M.gutter}px 34px">
            <div style="font-family:${FONT.body};font-size:10.5px;font-weight:600;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:${C.mutedText}">${esc(view.eyebrow)}</div>
            <h1 class="k-h1" style="margin:8px 0 0;font-family:${FONT.display};font-size:25px;font-weight:800;line-height:1.25;letter-spacing:-0.018em;color:${C.ink}">${esc(view.headline)}</h1>
            <p class="k-lead" style="margin:12px 0 0;font-family:${FONT.body};font-size:15px;line-height:1.65;color:${C.soft}">${esc(view.lead)}</p>
            ${view.focus ? focusBlock(view.focus) : ""}
            ${view.rows ? rowsHtml(view.rows) : ""}
            ${view.cta ? action(view.cta) : ""}
            ${view.note ? noteHtml(view.note) : ""}
            ${view.closing ? `<p class="k-lead" style="margin:24px 0 0;font-family:${FONT.body};font-size:13px;line-height:1.65;color:${C.mutedText}">${esc(view.closing)}</p>` : ""}
          </td>
        </tr>
        ${footer(year)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

// -------------------------------------------------------------- content ----

const APP = "https://kargo-eunice-13s-projects.vercel.app/"

const TEMPLATES = {
  confirmation: {
    subject: "Confirm your email address",
    view: {
      title: "Confirm your email address",
      preheader: "One tap confirms this address and finishes your KARGO account.",
      strapline: "Account verification",
      eyebrow: "New account",
      headline: "Confirm your email address",
      lead: "Tap the button below to verify this address and finish setting up your KARGO account. The link can only be used once.",
      address: "{{ .Email }}",
      chip: { label: "Verify", tone: "brand" },
      cta: { label: "Confirm email address", url: "{{ .ConfirmationURL }}" },
      note: {
        label: "Not you?",
        tone: "neutral",
        text: "If you did not create a KARGO account, ignore this email. The address stays unverified and cannot be used to sign in.",
      },
      closing: "",
    },
  },

  recovery: {
    subject: "Reset your password",
    view: {
      title: "Reset your password",
      preheader: "Choose a new password for your KARGO account.",
      strapline: "Account security",
      eyebrow: "Password reset",
      headline: "Reset your password",
      lead: "We received a request to set a new password for this KARGO account. Choose one now if it was you.",
      address: "{{ .Email }}",
      chip: { label: "Reset", tone: "warning" },
      cta: { label: "Set a new password", url: "{{ .ConfirmationURL }}" },
      note: {
        label: "If this was not you",
        tone: "neutral",
        text: "Ignore this email. Your current password still works and nothing changes until the link above is used.",
      },
      closing: "KARGO will never ask for your password by email or message.",
    },
  },

  magic_link: {
    subject: "Your sign-in link",
    view: {
      title: "Your sign-in link",
      preheader: "Tap to sign in to KARGO. No password needed.",
      strapline: "Account access",
      eyebrow: "Sign-in link",
      headline: "Sign in to KARGO",
      lead: "Use the button below to open your account. No password needed, and the link works once.",
      address: "{{ .Email }}",
      chip: { label: "Sign in", tone: "info" },
      cta: { label: "Sign in to KARGO", url: "{{ .ConfirmationURL }}" },
      note: {
        label: "Keep it private",
        tone: "neutral",
        text: "Anyone with this link can open your account once. Do not forward this email.",
      },
      closing: "If you did not ask for a sign-in link, you can ignore this email.",
    },
  },

  invite: {
    subject: "You have been invited to KARGO",
    view: {
      title: "You have been invited to KARGO",
      preheader: "Accept the invitation to set up your KARGO account.",
      strapline: "Account invitation",
      eyebrow: "Invitation",
      headline: "You have been invited",
      lead: "Accept the invitation to set up your account and join the pasabuy orders you were added to.",
      address: "{{ .Email }}",
      chip: { label: "Invite", tone: "brand" },
      cta: { label: "Accept invitation", url: "{{ .ConfirmationURL }}" },
      note: {
        label: "Not expecting this?",
        tone: "neutral",
        text: "If you do not recognise who invited you, ignore this email. The link can only be used once.",
      },
      closing: "The invitation is tied to this email address.",
    },
  },

  email_change: {
    subject: "Confirm your new email address",
    view: {
      title: "Confirm your new email address",
      preheader: "Confirm the new address before it replaces the one on your account.",
      strapline: "Account security",
      eyebrow: "Email change",
      headline: "Confirm your new email",
      lead: "Confirm this address to replace the email on your KARGO account. Both addresses are shown below so you can check the change is the one you asked for.",
      address: "{{ .Email }}",
      stripLabel: "Current email",
      chip: { label: "New email", tone: "warning" },
      rows: [{ label: "New email", value: "{{ .NewEmail }}", note: "Takes effect after you confirm" }],
      cta: { label: "Confirm new email", url: "{{ .ConfirmationURL }}" },
      note: {
        label: "If this was not you",
        tone: "neutral",
        text: "Ignore this email. Your account keeps the current address and the new one is never added.",
      },
      closing: "The new address cannot be used to sign in until it is confirmed.",
    },
  },

  reauthentication: {
    subject: "Your verification code",
    view: {
      title: "Your verification code",
      preheader: "Use this code to confirm it is you.",
      strapline: "Account security",
      eyebrow: "Verification",
      headline: "Confirm it is you",
      lead: "Enter this code where KARGO asked for it. It replaces the need to retype your password.",
      address: "{{ .Email }}",
      chip: { label: "Code", tone: "brand" },
      focus: { label: "Verification code", value: "{{ .Token }}", tone: "brand" },
      note: {
        label: "Not you?",
        tone: "neutral",
        text: "If you did not request this code, ignore this email. It cannot be used without the screen that asked for it.",
      },
      closing: "KARGO will never ask you to send this code to anyone.",
    },
  },
}

// ------------------------------------------------------------------ build ---

const year = new Date().getFullYear()
const built = Object.fromEntries(
  Object.entries(TEMPLATES).map(([name, t]) => [name, { subject: t.subject, content: document({ view: t.view, year }) }]),
)

const sizes = Object.entries(built).map(([name, t]) => ({
  name,
  bytes: Buffer.byteLength(t.content, "utf8"),
  lines: t.content.split("\n").length,
}))

if (!dry) {
  await mkdir(outDir, { recursive: true })
  for (const [name, t] of Object.entries(built)) {
    await writeFile(join(outDir, `${name}.html`), t.content, "utf8")
  }
}

console.log("template        bytes   lines")
for (const s of sizes) console.log(`${s.name.padEnd(15)} ${String(s.bytes).padStart(5)}   ${String(s.lines).padStart(4)}`)

// ------------------------------------------------------------------- push ---

const token = (await readFile(join(root, ".env.local"), "utf8"))
  .split(/\r?\n/)
  .map((line) => line.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$/))
  .find(Boolean)?.[1]
  ?.trim()

const REF = (await readFile(join(root, "supabase", ".temp", "project-ref"), "utf8")).trim()

if (!push) {
  console.log(dry ? "\nDry run: nothing written." : `\nWrote ${Object.keys(built).length} templates to supabase/email-templates/`)
  if (token) console.log("Run with --push to update the live Supabase auth templates.")
  process.exit(0)
}

if (!token) {
  console.error("\nSUPABASE_ACCESS_TOKEN missing from .env.local; cannot push.")
  process.exit(1)
}

const api = `https://api.supabase.com/v1/projects/${REF}/config/auth`
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

// Back up what is live before replacing it, so the change is reversible.
const live = await fetch(api, { headers }).then((r) => {
  if (!r.ok) throw new Error(`GET auth config failed: ${r.status}`)
  return r.json()
})

await mkdir(prevDir, { recursive: true })
for (const name of Object.keys(built)) {
  const existing = live[`mailer_templates_${name}_content`]
  if (typeof existing === "string") await writeFile(join(prevDir, `${name}.html`), existing, "utf8")
}

const payload = {}
for (const [name, t] of Object.entries(built)) payload[`mailer_templates_${name}_content`] = t.content

const patched = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(payload) })
if (!patched.ok) {
  console.error(`PATCH failed: ${patched.status} ${await patched.text()}`)
  process.exit(1)
}

const after = await fetch(api, { headers }).then((r) => r.json())
console.log("\nLive templates now:")
for (const name of Object.keys(built)) {
  const c = after[`mailer_templates_${name}_content`] ?? ""
  const ok = c.includes("KARGO") && c.includes('class="k-banner"') && c.length === built[name].content.length
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(15)} len=${c.length}`)
}

const subjects = Object.keys(built).map((n) => `${n}: ${after[`mailer_subjects_${n}`] ?? "(none)"}`)
console.log("\nSubjects (unchanged):\n" + subjects.join("\n"))
