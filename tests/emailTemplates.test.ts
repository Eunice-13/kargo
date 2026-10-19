import test from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../supabase/functions/process-pending-emails/email/render.ts"
import {
  brandingFrom,
  DEFAULT_EMAIL_LOGO_URL,
} from "../supabase/functions/process-pending-emails/email/config.ts"
import {
  buildView,
  TEMPLATE_NAMES,
  type RenderInput,
} from "../supabase/functions/process-pending-emails/email/templates.ts"
import { MARIA, SAMPLE_BRANDING, SAMPLE_EMAILS } from "../supabase/functions/process-pending-emails/email/samples.ts"

const branding = { ...SAMPLE_BRANDING, appUrl: "https://app.kargo.test" }

test("both email pipelines use the same versioned logo asset", async () => {
  assert.equal(brandingFrom(() => undefined).logoUrl, DEFAULT_EMAIL_LOGO_URL)
  assert.equal(
    brandingFrom((name) =>
      name === "KARGO_EMAIL_LOGO_URL" ? "https://stale.example/old-logo.png" : undefined,
    ).logoUrl,
    DEFAULT_EMAIL_LOGO_URL,
  )

  const templates = [
    "confirmation",
    "recovery",
    "magic_link",
    "invite",
    "email_change",
    "reauthentication",
  ]

  for (const name of templates) {
    const { readFile } = await import("node:fs/promises")
    const html = await readFile(
      new URL(`../supabase/email-templates/${name}.html`, import.meta.url),
      "utf8",
    )
    assert.ok(html.includes(`src="${DEFAULT_EMAIL_LOGO_URL}"`), `${name} logo URL`)
  }
})

function fixture(name: string): RenderInput {
  const sample = SAMPLE_EMAILS.find((email) => email.template === name)
  assert.ok(sample, `missing fixture for ${name}`)
  return sample
}

test("every known template has a fixture and renders a branded HTML + text email", () => {
  assert.equal(TEMPLATE_NAMES.length, 15)
  assert.equal(new Set(TEMPLATE_NAMES).size, TEMPLATE_NAMES.length)

  for (const name of TEMPLATE_NAMES) {
    const sample = fixture(name)
    const email = renderEmail(sample, branding)

    assert.ok(email.html.startsWith("<!doctype html>"), `${name} html shell`)
    assert.match(email.html, /charset="utf-8"/)
    assert.ok(email.html.includes("Pasabuy order updates"), `${name} banner subtitle`)
    assert.ok(email.text.length > 200, `${name} text part is substantive`)
    assert.ok(email.preheader.length > 0, `${name} preheader`)
    assert.equal(email.subject, sample.subject)
  }
})

test("fixtures cover every template and no template renders a missing-value placeholder", () => {
  assert.deepEqual(
    SAMPLE_EMAILS.map((email) => email.template).sort(),
    [...TEMPLATE_NAMES].sort(),
  )

  for (const name of TEMPLATE_NAMES) {
    const email = renderEmail(fixture(name), branding)
    assert.doesNotMatch(email.html, />(undefined|null|NaN|\[object Object\])</, `${name} html`)
    assert.doesNotMatch(email.text, /(undefined|null|NaN|\[object Object\])/, `${name} text`)
  }
})

test("details are HTML-escaped in the document and left readable in the text part", () => {
  const hostile: RenderInput = {
    template: "payment_submitted",
    subject: "KARGO <b>received</b> your payment",
    body: "Your proof is waiting for review.",
    recipientName: "Maria <script>alert(1)</script>",
    context: {},
    details: {
      orderNumber: "ORD-<1>",
      productName: "<img src=x onerror=alert(1)>",
      quantity: 1,
      totalAmount: 100,
      paymentMethod: "GCash",
    },
  }

  const email = renderEmail(hostile, branding)

  assert.ok(!email.html.includes("<img src=x"))
  assert.ok(!email.html.includes("<script>"))
  assert.ok(email.html.includes("&lt;img src=x onerror=alert(1)&gt;"))
  assert.ok(email.html.includes("&lt;b&gt;received&lt;/b&gt;"))
  assert.ok(email.text.includes("<img src=x onerror=alert(1)>"))
})

test("every link is an absolute https URL, including the fallback tracking link", () => {
  for (const name of TEMPLATE_NAMES) {
    const email = renderEmail(fixture(name), branding)
    const hrefs = [...email.html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])

    assert.ok(hrefs.length >= 2, `${name} has a settings link and a CTA`)
    for (const href of hrefs) assert.match(href, /^https:\/\//, `${name} link ${href}`)
  }
})

test("the CTA lands on the tab named by the template", () => {
  const verified = renderEmail(fixture("payment_verified"), branding)
  assert.ok(verified.html.includes("https://app.kargo.test/?tab=Orders"))

  const shipped = renderEmail(fixture("order_shipped"), branding)
  assert.ok(shipped.html.includes("https://www.jtexpress.ph/track?billcode=JT9821045567"))

  const partial = renderEmail(fixture("waitlist_partial_offer"), branding)
  assert.ok(partial.html.includes("https://app.kargo.test/?tab=My+Claims"))
  assert.ok(partial.text.includes("https://app.kargo.test/?tab=My+Claims"))
})

test("without an app URL the CTA explains the next step instead of linking nowhere", () => {
  const email = renderEmail(fixture("payment_verified"), { ...branding, appUrl: null })

  assert.ok(!email.html.includes('href="null"'))
  assert.ok(!email.html.includes('href=""'))
  assert.ok(email.html.includes("Open KARGO and go to"))
  assert.ok(email.text.includes("Open KARGO and go to"))
})

test("the delivered rail is complete in the text part", () => {
  const email = renderEmail(fixture("order_delivered"), branding)
  assert.equal((email.text.match(/\[x\]/g) ?? []).length, 4)
  assert.ok(!email.text.includes("[ ]"))
})

test("the shipped rail marks Shipped as current, not Delivered", () => {
  const email = renderEmail(fixture("order_shipped"), branding)
  assert.equal((email.text.match(/\[x\]/g) ?? []).length, 2)
})

test("the partial waitlist offer names the exact units and the waitlist head", () => {
  const email = renderEmail(fixture("waitlist_partial_offer"), branding)

  assert.ok(email.text.includes("Waitlist offer: 2 of 5 units"))
  assert.ok(email.text.includes("Only 2 of the 5 Seoul Beauty Bundle units you asked for"))
  assert.ok(!email.text.includes("is available now"))
})

test("the preheader is hidden in the document so inbox previews never leak layout text", () => {
  const email = renderEmail(fixture("payment_insufficient"), branding)
  const hidden = email.html.slice(email.html.indexOf('display:none'), email.html.indexOf("</div>"))

  assert.ok(hidden.includes(email.preheader.replaceAll("&", "&amp;").replaceAll("<", "&lt;")))
  assert.ok(!email.html.includes("View in browser"))
})

test("the footer keeps its separators and never ships double-encoded mojibake", () => {
  for (const name of TEMPLATE_NAMES) {
    const email = renderEmail(fixture(name), branding)
    assert.ok(email.html.includes("&middot;"), `${name} separator entity`)
    assert.ok(!email.html.includes("Â"), `${name} mojibake`)
    assert.ok(!email.html.includes("â€"), `${name} mojibake`)
  }
})

test("an unknown template falls back to the branded shell with the queued copy", () => {
  const view = buildView({
    template: "legacy_custom",
    subject: "An update on your KARGO order",
    body: "The seller changed the pickup schedule. Check My Claims for the new time.",
    recipientName: MARIA,
    context: {},
    details: {},
  })

  assert.equal(view.headline, "An update on your KARGO order")
  assert.match(view.lead, /pickup schedule/)
  assert.ok(view.chip)
  assert.ok(view.cta)

  const email = renderEmail(
    {
      template: "legacy_custom",
      subject: "An update on your KARGO order",
      body: "The seller changed the pickup schedule. Check My Claims for the new time.",
      recipientName: MARIA,
      context: {},
      details: {},
    },
    branding,
  )
  assert.ok(email.html.includes("Legacy custom"))
  assert.ok(email.text.includes("Pickup schedule") || email.text.includes("pickup schedule"))
})

test("a partial row still renders instead of throwing", () => {
  const email = renderEmail(
    {
      template: "order_shipped",
      subject: "Your order shipped",
      body: "Shipped.",
      recipientName: null,
      context: {},
      details: {},
    },
    branding,
  )

  assert.ok(email.html.length > 4000)
  assert.ok(email.text.includes("Your order is on its way"))
  assert.ok(!email.html.includes("Rider"))
})
