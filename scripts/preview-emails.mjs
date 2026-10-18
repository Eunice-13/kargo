// Render every transactional email to static HTML + plain text for review.
//
//   node scripts/preview-emails.mjs
//
// Writes scripts/out/emails/{template}.html, text/{template}.txt and an index
// gallery. No secrets, no network, no Supabase: the fixtures are synthetic.

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { renderEmail } from "../supabase/functions/process-pending-emails/email/render.ts"
import { SAMPLE_EMAILS } from "../supabase/functions/process-pending-emails/email/samples.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "scripts", "out", "emails")
const textDir = join(outDir, "text")

const branding = {
  appUrl: "https://kargo.example",
  logoUrl: relative(outDir, join(root, "public", "kargo-logo-head.png")).split("\\").join("/"),
  productName: "KARGO",
}

const escape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

await mkdir(outDir, { recursive: true })
await mkdir(textDir, { recursive: true })

const rendered = []

for (const sample of SAMPLE_EMAILS) {
  const email = renderEmail(sample, branding)
  const name = sample.template
  await writeFile(join(outDir, `${name}.html`), email.html, "utf8")
  await writeFile(join(textDir, `${name}.txt`), email.text, "utf8")
  rendered.push({ name, ...email })
}

const cards = rendered
  .map(
    (email) => `      <section class="card">
        <header>
          <div>
            <code>${escape(email.name)}</code>
            <h2>${escape(email.subject)}</h2>
            <p>${escape(email.preheader)}</p>
          </div>
          <a href="./${escape(email.name)}.html" target="_blank" rel="noreferrer">Open full size</a>
        </header>
        <iframe src="./${escape(email.name)}.html" title="${escape(email.name)} preview" width="640" height="1080" loading="lazy"></iframe>
      </section>`,
  )
  .join("\n")

const gallery = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KARGO email preview</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:#F7F3F3;color:#17212B;font-family:'Segoe UI',Helvetica,Arial,sans-serif}
  .top{background:#191BA9;color:#fff;padding:26px 28px}
  .top strong{display:block;font-size:12px;letter-spacing:.34em;font-weight:800}
  .top p{margin:10px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.78);max-width:62ch}
  main{max-width:760px;margin:0 auto;padding:28px 18px 60px;display:grid;gap:26px}
  .card{background:#fff;border:1px solid #E7EBEF;border-radius:14px;overflow:hidden}
  .card header{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #EEF1F4}
  .card code{font-size:11px;color:#748391;letter-spacing:.02em}
  .card h2{margin:4px 0 0;font-size:14px;line-height:1.4;color:#17212B}
  .card p{margin:6px 0 0;font-size:12px;line-height:1.5;color:#748391}
  .card a{align-self:center;font-size:11.5px;color:#191BA9;text-decoration:underline;white-space:nowrap}
  iframe{display:block;width:100%;max-width:640px;margin:0 auto;border:0;background:#F7F3F3}
</style>
</head>
<body>
  <div class="top">
    <strong>KARGO</strong>
    <p>Transactional email preview. Synthetic data only — nothing here is sent. Each frame is the exact HTML the worker hands to Nylas or Brevo.</p>
  </div>
  <main>
${cards}
  </main>
</body>
</html>
`

await writeFile(join(outDir, "index.html"), gallery, "utf8")

console.log(`Rendered ${rendered.length} emails to ${relative(root, outDir)}`)
for (const email of rendered) {
  console.log(`  ${email.name.padEnd(26)} ${String(email.html.length).padStart(6)} HTML  ${String(email.text.length).padStart(5)} text`)
}
console.log(`\nGallery: ${join("scripts", "out", "emails", "index.html")}`)
