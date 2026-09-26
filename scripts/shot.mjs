import puppeteer from "puppeteer-core"
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--force-device-scale-factor=1"] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1024, height: 720, deviceScaleFactor: 1 })
  await page.goto("http://localhost:8443/", { waitUntil: "networkidle2", timeout: 60000 })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.type('input[type="email"]', "buyer@kargo.demo")
  await page.type('input[type="password"]', "password123")
  await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => /log ?in/i.test(b.textContent || ""))?.click())
  await page.waitForSelector(".buyer-claims-table", { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1000))
  // Scroll down to trigger sticky.
  await page.evaluate(() => window.scrollTo(0, 260))
  await new Promise((r) => setTimeout(r, 500))
  const info = await page.evaluate(() => {
    const header = document.querySelector(".kargo-header")
    const tabbar = document.querySelector(".kargo-tabbar")
    const cs = (el) => el ? getComputedStyle(el) : null
    const rect = (el) => { const r = el?.getBoundingClientRect(); return r ? { top: Math.round(r.top), height: Math.round(r.height) } : null }
    const hc = cs(header), tc = cs(tabbar)
    // Walk up from header to find any ancestor with non-visible overflow.
    let clip = null
    for (let el = header?.parentElement; el && el !== document.body; el = el.parentElement) {
      const o = getComputedStyle(el).overflow + " " + getComputedStyle(el).overflowY
      if (/(hidden|auto|scroll|clip)/.test(o)) { clip = { tag: el.className || el.tagName, overflow: o }; break }
    }
    return {
      header: { pos: hc?.position, top: hc?.top, z: hc?.zIndex, rect: rect(header) },
      tabbar: { pos: tc?.position, top: tc?.top, z: tc?.zIndex, rect: rect(tabbar) },
      clipAncestor: clip,
      scrollY: window.scrollY,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await page.screenshot({ path: "scripts/out/scroll.png" })
  console.log("Saved")
} finally {
  await browser.close()
}
