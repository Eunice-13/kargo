const endpoint = "http://127.0.0.1:9338"
const targets = await (await fetch(`${endpoint}/json`)).json()
const target = targets.find((item) => item.type === "page")
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener("open", resolve))

let nextId = 0
const pending = new Map()
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  const resolve = pending.get(message.id)
  if (resolve) {
    pending.delete(message.id)
    resolve(message)
  }
})
const call = (method, params = {}) =>
  Promise.race([
    new Promise((resolve) => {
      const id = ++nextId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 5000),
    ),
  ])
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

for (const width of [320, 390]) {
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1100,
    screenWidth: width,
    screenHeight: 1100,
    deviceScaleFactor: 1,
    mobile: width <= 620,
    scale: 1,
  })
  await call("Emulation.setUserAgentOverride", {
    userAgent:
      width <= 620
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  })

  for (const page of ["Settings", "Payments"]) {
    await call("Page.navigate", { url: "http://127.0.0.1:8443/?preview=original" })
    await pause(700)
    if (page === "Settings") {
      await call("Runtime.evaluate", {
        expression: `document.querySelector('.kargo-header-actions > div:last-child > button')?.click()`,
      })
      await pause(80)
      await call("Runtime.evaluate", {
        expression: `[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Settings'))?.click()`,
      })
    } else if (page !== "Login") {
      await call("Runtime.evaluate", {
        expression: `setTimeout(() => [...document.querySelectorAll('.icon-tabbar button')].find((button) => button.textContent.includes(${JSON.stringify(page)}))?.click(), 0); true`,
      })
    }
    await pause(250)
    const response = await call("Runtime.evaluate", {
      returnByValue: true,
      expression: `JSON.stringify((() => {
        const visible = (element) => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        }
        const overflow = [...document.querySelectorAll('body *')]
          .filter(visible)
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            return rect.left < -1 || rect.right > innerWidth + 1
          })
          .slice(0, 8)
          .map((element) => element.className || element.tagName)
        const targets = [...document.querySelectorAll('button,a[href],[role="button"],select,input[type="checkbox"],input[type="radio"]')]
          .filter(visible)
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            return rect.width < 43.5 || rect.height < 43.5
          })
          .slice(0, 8)
          .map((element) => ({ name: (element.textContent || element.getAttribute('aria-label') || element.tagName).trim().slice(0, 35), size: [Math.round(element.getBoundingClientRect().width), Math.round(element.getBoundingClientRect().height)] }))
        const smallText = innerWidth <= 620 ? [...document.querySelectorAll('main p,main span,main small,main label,main a,main button,main input,main select,main textarea,main td,main th,.auth-page p,.auth-page span,.auth-page small,.auth-page label,.auth-page button,.auth-page input')]
          .filter(visible)
          .filter((element) => parseFloat(getComputedStyle(element).fontSize) < 15.5)
          .slice(0, 8)
          .map((element) => ({ text: (element.textContent || '').trim().slice(0, 35), size: getComputedStyle(element).fontSize })) : []
        return {
          page: ${JSON.stringify(page)},
          innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflow,
          undersizedTargets: targets,
          smallText,
          mobileSearch: document.querySelector('.kargo-mobile-search-toggle') ? getComputedStyle(document.querySelector('.kargo-mobile-search-toggle')).display : 'n/a',
        }
      })())`,
    })
    console.log(width, response.result.result.value)
  }
}

ws.close()
