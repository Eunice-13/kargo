// Compose the two parts of a transactional email: the designed HTML document and
// a plain-text alternative. Both are always produced so every provider can send
// a correct multipart message and text-only clients still get the whole story.

import { TEXT_RULE, withQuery } from "./format.ts"
import type { Branding, EmailView } from "./layout.ts"
import { renderDocument, resolveCtaUrl } from "./layout.ts"
import { buildView, type RenderInput } from "./templates.ts"

export type RenderedEmail = {
  subject: string
  preheader: string
  html: string
  text: string
}

function textPart(view: EmailView, branding: Branding, recipientName: string | null): string {
  const lines: string[] = []
  const push = (...items: Array<string | null | undefined>) => {
    for (const item of items) if (item) lines.push(item)
  }

  push(view.headline, "", view.lead, "")

  if (view.orderNumber) push(`Order ${view.orderNumber}`, "")
  else if (view.strip) push(`${view.strip.label}: ${view.strip.value}`, "")

  if (view.focus) {
    push(`${view.focus.label.toUpperCase()}: ${view.focus.value}`)
    if (view.focus.note) push(`  ${view.focus.note}`)
    lines.push("")
  }

  if (view.rows?.length) {
    for (const row of view.rows) {
      push(`${row.label}: ${row.value}`)
      if (row.note) push(`  ${row.note}`)
    }
    lines.push("")
  }

  if (view.rail) {
    const done = view.rail.complete === true ? view.rail.steps.length : view.rail.active
    const stops = view.rail.steps
      .map((step, index) => (index < done ? `[x] ${step}` : `[ ] ${step}`))
      .join("  ")
    push(`Progress: ${stops}`, "")
  }

  if (view.note) {
    push(view.note.label ? `${view.note.label}: ${view.note.text}` : view.note.text, "")
  }

  const url = view.cta ? resolveCtaUrl(view.cta, branding.appUrl) : null
  if (view.cta && url) push(`${view.cta.label}: ${url}`, "")
  else if (view.cta) push(`Open KARGO and go to ${view.cta.tab ?? "your orders"} to ${view.cta.label.toLowerCase()}.`, "")
  if (view.cta?.note) push(view.cta.note, "")

  push(view.closing, "")

  lines.push(TEXT_RULE)
  lines.push(`${branding.productName} · Pasabuy order fulfillment`)
  if (recipientName) lines.push(`Sent to ${recipientName}.`)
  lines.push("You are receiving this because email updates are on for this category in your KARGO account.")
  const settings = withQuery(branding.appUrl, { tab: "Settings" })
  if (settings) lines.push(`Manage email settings: ${settings}`)
  if (branding.appUrl) lines.push(`Open KARGO: ${branding.appUrl}`)

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

export function renderEmail(input: RenderInput, branding: Branding): RenderedEmail {
  const view = buildView(input)
  return {
    subject: input.subject,
    preheader: view.preheader,
    html: renderDocument(view, branding, input.subject, input.recipientName),
    text: textPart(view, branding, input.recipientName),
  }
}
