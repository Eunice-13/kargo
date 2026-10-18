import { COLOR, DARK, FONT, METRICS, TONES, type Tone } from "./brand.ts"
import { escapeHtml, safeUrl, withQuery } from "./format.ts"

export type DetailRow = {
  label: string
  value: string
  note?: string
}

export type Rail = {
  steps: string[]
  /** Index of the stage the order is on right now. */
  active: number
  /** Terminal stage: every step is filled and none reads as "in progress". */
  complete?: boolean
}

export type EmailView = {
  /** Preview text that lands beside the subject in the inbox list. */
  preheader: string
  headline: string
  lead: string
  chip?: { label: string; tone: Tone }
  orderNumber?: string
  /** Head of the waybill when there is no order number yet (waitlist offers). */
  strip?: { label: string; value: string }
  focus?: { label: string; value: string; note?: string; tone?: Tone }
  rows?: DetailRow[]
  rail?: Rail
  note?: { label?: string; text: string; tone?: Tone }
  cta?: { label: string; tab?: string; url?: string | null; note?: string }
  closing?: string
}

export type Branding = {
  appUrl: string | null
  logoUrl: string | null
  /** Drives "Sent by KARGO" and the preheader fallback; kept for future tenants. */
  productName: string
}

const chipHtml = (chip: { label: string; tone: Tone }) => {
  const { bg, ink } = TONES[chip.tone]
  return `<span style="display:inline-block;background:${bg};color:${ink};border-radius:999px;padding:5px 11px;font-family:${FONT.body};font-size:11.5px;font-weight:600;line-height:1.4;white-space:nowrap">${escapeHtml(chip.label)}</span>`
}

/* ── Banner ──────────────────────────────────────────────────────────────────
   The full-bleed indigo masthead. The ship mark is decorative when it loads and
   the wordmark is live text, so the brand still reads with images blocked. The
   three waterline rules echo the logo's wake without a single raster. */

function banner(logoUrl: string | null): string {
  const mark = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="40" height="46" alt="" border="0" style="display:block;margin:0 auto 12px;width:40px;height:46px;border:0;outline:none;text-decoration:none">`
    : ""

  const waterline = [46, 94, 142]
    .map(
      (width, index) =>
        `<div style="width:${width}px;height:2px;margin:0 auto ${index === 2 ? 0 : 6}px;background:rgba(255,255,255,${[0.26, 0.16, 0.09][index]})"></div>`,
    )
    .join("")

  return `<tr>
  <td class="k-banner" style="background:${COLOR.indigo};padding:30px ${METRICS.gutter}px 0;text-align:center">
    ${mark}
    <div style="font-family:${FONT.display};font-size:21px;font-weight:800;line-height:1;letter-spacing:0.34em;padding-left:0.34em;color:#FFFFFF">KARGO</div>
    <div style="margin-top:9px;font-family:${FONT.body};font-size:10.5px;font-weight:500;line-height:1.4;letter-spacing:0.19em;text-transform:uppercase;color:rgba(255,255,255,0.74)">Pasabuy order updates</div>
    <div style="padding:20px 0 14px">${waterline}</div>
  </td>
</tr>`
}

/* ── Waybill strip ───────────────────────────────────────────────────────────
   The order number and current state, set like the head of a shipping manifest.
   Collapses to two stacked lines on narrow screens. */

function strip(view: EmailView): string {
  const head = view.orderNumber
    ? { label: "Order", value: view.orderNumber }
    : view.strip ?? null
  if (!head && !view.chip) return ""

  const order = head
    ? `<div class="k-strip-label" style="font-family:${FONT.body};font-size:11px;font-weight:600;line-height:1.4;letter-spacing:0.15em;text-transform:uppercase;color:${COLOR.mutedText}">${escapeHtml(head.label)}</div>
       <div class="k-strip-order" style="margin-top:3px;font-family:${FONT.display};font-size:13px;font-weight:700;line-height:1.4;letter-spacing:0.02em;color:${COLOR.ink};font-variant-numeric:tabular-nums">${escapeHtml(head.value)}</div>`
    : ""

  const chip = view.chip ? chipHtml(view.chip) : ""

  return `<tr>
  <td class="k-strip" style="background:${COLOR.cream};padding:13px ${METRICS.gutter}px;border-bottom:1px solid ${COLOR.hairline}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
      <tr>
        <td valign="middle" align="left">${order}</td>
        <td valign="middle" align="right" class="k-strip-right">${chip}</td>
      </tr>
    </table>
  </td>
</tr>`
}

/* ── Stage rail ──────────────────────────────────────────────────────────────
   Claimed → Paid → Shipped → Delivered. Stages before the current one are
   indigo, the current stage is coral (the app's active underline), later stages
   are hairline grey. Weight, not only colour, marks the current stage. */

function rail(rail: Rail): string {
  const cells = rail.steps
    .map((step, index) => {
      const done = rail.complete === true || index < rail.active
      const current = rail.complete !== true && index === rail.active
      const bar = done ? COLOR.indigo : current ? COLOR.coral : COLOR.hairline
      const labelColor = done || current ? COLOR.ink : COLOR.mutedText
      const weight = current ? 700 : done ? 600 : 500
      const spacer = index === 0 ? "0" : "5px"
      return `<td width="25%" valign="top" style="padding:0 ${spacer} 0 0">
        <div class="k-rail-bar${done || current ? "" : " k-rail-future"}" style="height:4px;border-radius:2px;background:${bar}"></div>
        <div class="k-rail-label ${done || current ? "k-rail-on" : "k-rail-off"}" style="margin-top:8px;font-family:${FONT.body};font-size:11px;font-weight:${weight};line-height:1.35;letter-spacing:0.04em;color:${labelColor}">${escapeHtml(step)}</div>
      </td>`
    })
    .join("")

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:26px 0 2px">
  <tr>${cells}</tr>
</table>`
}

/* ── Focus value ─────────────────────────────────────────────────────────────
   The one number or identifier the reader came for: balance, new total, tracking
   number, deadline. Tinted from its semantic tone rather than always cream. */

function focusBlock(focus: NonNullable<EmailView["focus"]>): string {
  const tone = TONES[focus.tone ?? "neutral"]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:24px 0 4px">
  <tr>
    <td style="background:${tone.bg};border-radius:${METRICS.radiusSmall}px;padding:18px 20px">
      <div class="k-focus-label" style="font-family:${FONT.body};font-size:11px;font-weight:600;line-height:1.4;letter-spacing:0.12em;text-transform:uppercase;color:${tone.ink}">${escapeHtml(focus.label)}</div>
      <div class="k-focus-value" style="margin-top:6px;font-family:${FONT.display};font-size:29px;font-weight:800;line-height:1.15;letter-spacing:-0.015em;color:${tone.ink};font-variant-numeric:tabular-nums;word-break:break-word">${escapeHtml(focus.value)}</div>
      ${focus.note ? `<div style="margin-top:6px;font-family:${FONT.body};font-size:12.5px;line-height:1.5;color:${tone.ink}">${escapeHtml(focus.note)}</div>` : ""}
    </td>
  </tr>
</table>`
}

/* ── Manifest rows ───────────────────────────────────────────────────────────
   Label left, value right, hairline between rows. Tabular numerals so amounts
   and dates line up the way they do in the app's tables. */

function rows(list: DetailRow[]): string {
  const body = list
    .map((row, index) => {
      const last = index === list.length - 1
      return `<tr>
        <td class="k-row-label" valign="top" style="padding:11px 16px 11px 0;border-bottom:${last ? "0" : `1px solid ${COLOR.hairlineSoft}`};font-family:${FONT.body};font-size:13px;line-height:1.5;color:${COLOR.mutedText}">${escapeHtml(row.label)}</td>
        <td class="k-row-value" valign="top" align="right" style="padding:11px 0;border-bottom:${last ? "0" : `1px solid ${COLOR.hairlineSoft}`};font-family:${FONT.display};font-size:13.5px;font-weight:600;line-height:1.5;color:${COLOR.ink};font-variant-numeric:tabular-nums;word-break:break-word">
          ${escapeHtml(row.value)}
          ${row.note ? `<div class="k-row-note" style="margin-top:2px;font-family:${FONT.body};font-size:12px;font-weight:400;line-height:1.45;color:${COLOR.mutedText}">${escapeHtml(row.note)}</div>` : ""}
        </td>
      </tr>`
    })
    .join("")

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:20px 0 0">
    <tr><td colspan="2" style="padding:0"><div class="k-rule" style="height:1px;background:${COLOR.hairline}"></div></td></tr>
    ${body}
  </table>`
}

/* ── Note ────────────────────────────────────────────────────────────────────
   Reasons, pauses and cautions. A tinted block, never a coloured side border. */

function note(block: NonNullable<EmailView["note"]>): string {
  const tone = TONES[block.tone ?? "neutral"]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:22px 0 0">
  <tr>
    <td style="background:${tone.bg};border-radius:${METRICS.radiusSmall}px;padding:14px 16px">
      ${block.label ? `<div style="font-family:${FONT.body};font-size:11px;font-weight:700;line-height:1.4;letter-spacing:0.11em;text-transform:uppercase;color:${tone.ink}">${escapeHtml(block.label)}</div>` : ""}
      <div style="margin-top:${block.label ? "5px" : "0"};font-family:${FONT.body};font-size:13.5px;line-height:1.6;color:${tone.ink}">${escapeHtml(block.text)}</div>
    </td>
  </tr>
</table>`
}

/* ── Action ──────────────────────────────────────────────────────────────────
   Indigo on white, matching PrimaryBtn. Outlook gets a VML roundrect so the
   button keeps its shape instead of collapsing into a bare text link. */

/** The single place CTA destinations are resolved, shared with the text part. */
export function resolveCtaUrl(cta: { tab?: string; url?: string | null }, appUrl: string | null): string | null {
  return safeUrl(cta.url) ?? withQuery(appUrl, cta.tab ? { tab: cta.tab } : {})
}

function action(cta: NonNullable<EmailView["cta"]>, appUrl: string | null): string {
  const url = resolveCtaUrl(cta, appUrl)

  if (!url) {
    return `<div style="margin:26px 0 0;padding:14px 16px;border:1px solid ${COLOR.hairline};border-radius:${METRICS.radiusSmall}px;font-family:${FONT.body};font-size:13.5px;line-height:1.6;color:${COLOR.soft}">Open KARGO and go to <strong style="color:${COLOR.ink}">${escapeHtml(cta.tab ?? "your orders")}</strong> to ${escapeHtml(cta.label.toLowerCase())}.</div>`
  }

  const label = escapeHtml(cta.label)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:26px 0 0">
  <tr>
    <td align="left" class="k-cta-cell">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(url)}" style="height:46px;v-text-anchor:middle;width:230px" arcsize="18%" strokecolor="${COLOR.indigo}" fillcolor="${COLOR.indigo}"><w:anchorlock/><center style="color:#ffffff;font-family:${FONT.display};font-size:14px;font-weight:700">${label}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${escapeHtml(url)}" class="k-cta" style="display:inline-block;background:${COLOR.indigo};color:#FFFFFF;border-radius:8px;padding:14px 26px;font-family:${FONT.display};font-size:14px;font-weight:700;line-height:1.2;letter-spacing:0.01em;text-decoration:none">${label}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>
${cta.note ? `<div class="k-cta-note" style="margin-top:10px;font-family:${FONT.body};font-size:12px;line-height:1.5;color:${COLOR.mutedText}">${escapeHtml(cta.note)}</div>` : ""}`
}

/* ── Footer ──────────────────────────────────────────────────────────────────
   Quiet, and honest about why the message arrived. No invented postal address
   and no one-click unsubscribe promise the product cannot keep. */

function footer(recipientName: string | null, appUrl: string | null, settingsUrl: string | null): string {
  const greeting = recipientName ? `Sent to ${escapeHtml(recipientName)}. ` : ""
  const settings = settingsUrl
    ? `<a href="${escapeHtml(settingsUrl)}" style="color:${COLOR.indigo};text-decoration:underline">Manage email settings</a>`
    : ""
  const home = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="color:${COLOR.indigo};text-decoration:underline">Open KARGO</a>`
    : ""

  return `<tr>
  <td class="k-footer" style="background:${COLOR.cream};padding:22px ${METRICS.gutter}px 26px;border-top:1px solid ${COLOR.hairline}">
    <div class="k-footer-mark" style="font-family:${FONT.display};font-size:11px;font-weight:800;letter-spacing:0.26em;color:${COLOR.indigo}">KARGO</div>
    <div class="k-footer-text" style="margin-top:9px;font-family:${FONT.body};font-size:12px;line-height:1.65;color:${COLOR.mutedText}">
      ${greeting}You are receiving this because email updates are on for this category in your KARGO account.
      ${settings}${settings && home ? " &middot; " : ""}${home}
    </div>
  </td>
</tr>`
}

/* ── Document ────────────────────────────────────────────────────────────────
   Table shell for every client, plus progressive dark mode and a 480px break.
   The preheader is a hidden first block so the inbox preview never leaks layout
   text such as "View in browser". */

export function renderDocument(
  view: EmailView,
  branding: Branding,
  subject: string,
  recipientName: string | null,
): string {
  const settingsUrl = withQuery(branding.appUrl, { tab: "Settings" })
  const year = new Date().getFullYear()
  const lead = escapeHtml(view.lead)
  const headline = escapeHtml(view.headline)

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Manrope:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  a{color:${COLOR.indigo}}
  @media (max-width:480px){
    .k-frame{width:100%!important;max-width:100%!important;border-radius:0!important}
    .k-gutter{padding-left:${METRICS.gutterMobile}px!important;padding-right:${METRICS.gutterMobile}px!important}
    .k-banner{padding-left:${METRICS.gutterMobile}px!important;padding-right:${METRICS.gutterMobile}px!important}
    .k-strip{padding-left:${METRICS.gutterMobile}px!important;padding-right:${METRICS.gutterMobile}px!important}
    .k-footer{padding-left:${METRICS.gutterMobile}px!important;padding-right:${METRICS.gutterMobile}px!important}
    .k-strip-right{text-align:left!important;padding-top:10px!important}
    .k-h1{font-size:22px!important}
    .k-focus-value{font-size:25px!important}
    .k-rail-label{font-size:9.5px!important;letter-spacing:0.02em!important}
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
    .k-rail-on{color:${DARK.ink}!important}
    .k-rail-off{color:${DARK.muted}!important}
    .k-rail-future{background:${DARK.hairline}!important}
    .k-footer-mark,.k-footer a{color:#B4C0FF!important}
    /* Tinted focus panels keep their light fill in dark mode: dark ink on a pale
       wash stays legible and reads as a printed stub inside the dark card. */
  }
</style>
</head>
<body class="k-canvas" style="margin:0;padding:0;background:${COLOR.cream};font-family:${FONT.body}">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${COLOR.cream}">${escapeHtml(view.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="k-canvas" style="border-collapse:collapse;background:${COLOR.cream}">
  <tr>
    <td align="center" class="k-shell" style="padding:26px 12px">
      <table role="presentation" width="${METRICS.width}" cellpadding="0" cellspacing="0" border="0" class="k-frame" style="width:${METRICS.width}px;max-width:${METRICS.width}px;border-collapse:separate;background:${COLOR.surface};border:1px solid ${COLOR.hairline};border-radius:${METRICS.radius}px;overflow:hidden">
        ${banner(branding.logoUrl)}
        ${strip(view)}
        <tr>
          <td class="k-body k-gutter" style="background:${COLOR.surface};padding:30px ${METRICS.gutter}px 34px">
            <h1 class="k-h1" style="margin:0;font-family:${FONT.display};font-size:25px;font-weight:800;line-height:1.25;letter-spacing:-0.018em;color:${COLOR.ink}">${headline}</h1>
            <p class="k-lead" style="margin:12px 0 0;font-family:${FONT.body};font-size:15px;line-height:1.65;color:${COLOR.soft}">${lead}</p>
            ${view.focus ? focusBlock(view.focus) : ""}
            ${view.rows && view.rows.length ? rows(view.rows) : ""}
            ${view.rail ? rail(view.rail) : ""}
            ${view.note ? note(view.note) : ""}
            ${view.cta ? action(view.cta, branding.appUrl) : ""}
            ${view.closing ? `<p class="k-lead" style="margin:24px 0 0;font-family:${FONT.body};font-size:13px;line-height:1.65;color:${COLOR.mutedText}">${escapeHtml(view.closing)}</p>` : ""}
          </td>
        </tr>
        ${footer(recipientName, branding.appUrl, settingsUrl)}
      </table>
      <div class="k-colophon" style="margin:14px auto 0;max-width:${METRICS.width}px;font-family:${FONT.body};font-size:11px;line-height:1.5;color:${COLOR.mutedText};text-align:center">KARGO &middot; Pasabuy order fulfillment &middot; ${year}</div>
    </td>
  </tr>
</table>
</body>
</html>`
}
