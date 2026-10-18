// Screenshot the Supabase Auth templates in supabase/email-templates.
//
//   node scripts/shot-auth-emails.mjs                      # all six, 700px
//   node scripts/shot-auth-emails.mjs --templates=recovery --dark=true
//
// Output: scripts/out/auth-shots/<template>-<width>[-dark].png
// Mirrors scripts/screenshot-emails.mjs, which Chrome's --screenshot flag
// silently ignores on this build, so this uses CDP directly.

import { spawn } from "node:child_process"
import { mkdir, readdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const emailDir = join(root, "supabase", "email-templates")
const shotDir = join(root, "scripts", "out", "auth-shots")
const port = 9342

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=")
    return [key, value]
  }),
)

const width = Number(args.width ?? 700)
const scale = Number(args.scale ?? 2)
const dark = args.dark === "true"
const wanted = (args.templates ?? "all").split(",").map((n) => n.trim()).filter(Boolean)

const browser = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((path) => path && existsSync(path))

if (!browser) throw new Error("No Chrome or Edge binary found. Set CHROME_PATH.")

const files = wanted.includes("all")
  ? (await readdir(emailDir)).filter((name) => name.endsWith(".html"))
  : wanted.map((name) => `${name}.html`)

await mkdir(shotDir, { recursive: true })

const child = spawn(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--allow-file-access-from-files",
    `--user-data-dir=${join(root, "scripts", "out", ".chrome-auth")}`,
    `--remote-debugging-port=${port}`,
    "about:blank",
  ],
  { stdio: "ignore" },
)

const pause = (ms) => new Promise((done) => setTimeout(done, ms))

async function waitForEndpoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === "page")
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Chrome is still starting.
    }
    await pause(250)
  }
  throw new Error("Chrome debugging endpoint never became available")
}

let socket
let nextId = 0
const pending = new Map()

function call(method, params = {}) {
  return Promise.race([
    new Promise((done) => {
      const id = ++nextId
      pending.set(id, done)
      socket.send(JSON.stringify({ id, method, params }))
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 10_000)),
  ])
}

try {
  socket = new WebSocket(await waitForEndpoint())
  await new Promise((done, reject) => {
    socket.addEventListener("open", done, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    const done = pending.get(message.id)
    if (done) {
      pending.delete(message.id)
      done(message)
    }
  })

  await call("Page.enable")
  await call("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }],
  })
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: scale,
    mobile: width <= 480,
  })

  for (const file of files) {
    const abs = join(emailDir, file)
    await call("Page.navigate", { url: new URL(`file:///${abs.split("\\").join("/")}`).href })
    await pause(1100)
    await call("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true })
    await pause(250)

    const shot = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      fromSurface: true,
    })
    const name = file.replace(/\.html$/, "")
    const target = resolve(shotDir, `${name}-${width}${dark ? "-dark" : ""}.png`)
    await writeFile(target, Buffer.from(shot.result.data, "base64"))
    console.log(`  ${name} -> ${target.replace(root + "\\", "")}`)
  }
} finally {
  socket?.close()
  child.kill()
}
