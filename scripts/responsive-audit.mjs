const endpoint = "http://127.0.0.1:9338";
const appUrl = "http://127.0.0.1:8443";
const quick = process.argv.includes("--quick");
const buyerOnly = process.argv.includes("--buyer");
const desktopOnly = process.argv.includes("--desktop");
const widths = quick ? [320, 390] : [320, 360, 390, 414];

const targets = await (await fetch(`${endpoint}/json`)).json();
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No debuggable browser page found on port 9338");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));

let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const resolve = pending.get(message.id);
  if (!resolve) return;
  pending.delete(message.id);
  resolve(message);
});

const call = (method, params = {}) =>
  Promise.race([
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (message) => {
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message);
      });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 30_000),
    ),
  ]);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const response = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return response.result.result.value;
};

const setViewport = async (width, mobile = true) => {
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height: mobile ? 1100 : 900,
    screenWidth: width,
    screenHeight: mobile ? 1100 : 900,
    deviceScaleFactor: 1,
    mobile,
    scale: 1,
  });
};

const navigate = async (url) => {
  await call("Page.navigate", { url });
  await pause(1200);
};

const clickButton = async (label, selector = "button") => {
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((item) => item.textContent.trim().includes(${JSON.stringify(label)}))
    button?.click()
    return Boolean(button)
  })()`);
  await pause(350);
  return clicked;
};

const audit = async (surface, width) => {
  const result = JSON.parse(
    await evaluate(`JSON.stringify((() => {
      const visible = (element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
      }
      const hScrollers = [...document.querySelectorAll("body *")]
        .filter(visible)
        .filter((element) => element.scrollWidth > element.clientWidth + 4)
        .filter((element) => !element.classList.contains("buyer-batch-grid"))
        .filter((element) => !element.matches(".buyer-carousel-controls button, .buyer-batch-card__favorite, .seller-shop-batch__reaction"))
        .map((element) => ({
          name: typeof element.className === "string" && element.className.trim() ? element.className : element.tagName,
          size: [element.clientWidth, element.scrollWidth],
        }))
        .slice(0, 12)
      const home = document.querySelector(".buyer-home")?.getBoundingClientRect()
      const batchPage = document.querySelector(".buyer-batch-page")
      const categoryGrid = document.querySelector(".buyer-category-grid")
      const footer = document.querySelector(".kargo-footer")?.getBoundingClientRect()
      const filter = document.querySelector(".buyer-home-filter")
      const filterRect = filter?.getBoundingClientRect()
      const favoriteIcon = document.querySelector(".buyer-batch-card__favorite svg")?.getBoundingClientRect()
      const style = (selector, property) => {
        const element = document.querySelector(selector)
        return element ? getComputedStyle(element)[property] : null
      }
      return {
        surface: ${JSON.stringify(surface)},
        width: ${width},
        docScrollWidth: document.documentElement.scrollWidth,
        hScrollers,
        home: home ? { left: Math.round(home.left), width: Math.round(home.width) } : null,
        batchColumns: batchPage ? getComputedStyle(batchPage).gridTemplateColumns.split(" ").length : null,
        batchPerPage: batchPage ? batchPage.children.length : null,
        batchDetailsVisible: batchPage ? [
          ".buyer-batch-card__category",
          ".buyer-batch-card__favorite span",
          ".buyer-batch-card__seller",
          ".buyer-batch-card__date",
          ".buyer-batch-card__progress-label",
        ].every((selector) => {
          const element = document.querySelector(selector)
          return element ? visible(element) : false
        }) : null,
        favoriteIconWidth: favoriteIcon ? Math.round(favoriteIcon.width) : null,
        filterHeight: filterRect ? Math.round(filterRect.height) : null,
        filterColumns: filter ? getComputedStyle(filter).gridTemplateColumns.split(" ").length : null,
        categoryScrolls: categoryGrid ? categoryGrid.scrollWidth > categoryGrid.clientWidth + 4 : null,
        footerHeight: footer ? Math.round(footer.height) : null,
        type: {
          cardTitle: style(".buyer-batch-card__body h3", "fontSize"),
          cardMeta: style(".buyer-batch-card__seller", "fontSize"),
          progress: style(".buyer-batch-card__progress-label", "fontSize"),
          category: style(".buyer-batch-card__category", "fontSize"),
          sectionHeading: style(".buyer-home-section__heading h2", "fontSize"),
          metric: style(".seller-stat strong, .bdash-stat__value", "fontSize"),
        },
      }
    })())`),
  );

  const failures = [];
  if (result.docScrollWidth !== width) failures.push(`document width ${result.docScrollWidth}`);
  if (result.hScrollers.length)
    failures.push(`unexpected scrollers: ${JSON.stringify(result.hScrollers)}`);
  if (result.home && (result.home.left !== 0 || result.home.width !== width)) {
    failures.push(`buyer home rect ${JSON.stringify(result.home)}`);
  }
  if (result.batchColumns !== null && result.batchColumns !== 3)
    failures.push(`${result.batchColumns} batch columns`);
  if (result.batchPerPage !== null && result.batchPerPage !== 6)
    failures.push(`${result.batchPerPage} batches per page`);
  if (result.batchDetailsVisible === false) failures.push("hidden batch details");
  if (result.favoriteIconWidth !== null && result.favoriteIconWidth > 16)
    failures.push(`favorite icon ${result.favoriteIconWidth}px`);
  if (result.filterHeight !== null && result.filterHeight > 52)
    failures.push(`filter ${result.filterHeight}px tall`);
  if (result.filterColumns !== null && result.filterColumns !== 2)
    failures.push(`${result.filterColumns} filter columns`);
  if (result.categoryScrolls) failures.push("category grid scrolls");
  if (result.footerHeight !== null && result.footerHeight > 340)
    failures.push(`footer ${result.footerHeight}px`);

  console.log(JSON.stringify({ ...result, failures }));
  return failures;
};

if (desktopOnly) {
  const selectors = [
    ".kargo-header",
    ".kargo-tabbar",
    ".kargo-tab-label",
    ".kargo-footer",
    ".kargo-footer__grid",
    ".kargo-footer h2",
    ".kargo-footer a",
    ".buyer-home",
    ".buyer-home__content",
    ".buyer-home-filter select",
    ".buyer-category-grid button",
    ".buyer-category-grid span",
    ".buyer-batch-page",
    ".buyer-batch-card",
    ".buyer-batch-card__image-wrap",
    ".buyer-batch-card__category",
    ".buyer-batch-card__favorite",
    ".buyer-batch-card__body h3",
    ".buyer-batch-card__seller",
    ".buyer-batch-card__date",
    ".buyer-batch-card__progress-label",
    ".buyer-carousel-controls button",
    ".buyer-home-section__heading h2",
    ".seller-stats",
    ".seller-stat",
    ".seller-stat strong",
    ".seller-dashboard-sidebar",
    ".seller-side-card",
    ".seller-board-preview",
    ".bdash-stats",
    ".bdash-stat",
    ".bdash-stat__value",
  ];
  for (const width of [1280, 1440]) {
    await setViewport(width, false);
    for (const [surface, url] of [
      ["Buyer Home", appUrl],
      ["Seller Dashboard", `${appUrl}/?preview=original`],
    ]) {
      await navigate(url);
      const measurements = JSON.parse(
        await evaluate(`JSON.stringify(Object.fromEntries(${JSON.stringify(selectors)}.map((selector) => {
          const element = document.querySelector(selector)
          if (!element) return [selector, null]
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return [selector, { width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10, fontSize: style.fontSize, display: style.display }]
        })))`),
      );
      console.log(JSON.stringify({ surface, width, measurements }));
    }
  }
  ws.close();
  process.exit(0);
}

const failures = [];
const sellerSurfaces = quick
  ? ["Dashboard"]
  : ["Dashboard", "Batches", "My Claims", "Payments", "Settings"];
if (!buyerOnly) {
  for (const width of widths) {
    await setViewport(width);
    for (const surface of sellerSurfaces) {
      await navigate(`${appUrl}/?preview=original`);
      if (surface === "Settings") {
        await evaluate(
          `document.querySelector('.kargo-header-actions > div:last-child > button')?.click()`,
        );
        await pause(100);
        await clickButton("Settings");
      } else if (surface !== "Dashboard") {
        await clickButton(surface, ".icon-tabbar button");
      }
      failures.push(...(await audit(`Seller ${surface}`, width)));
    }
  }
}

if (quick) {
  ws.close();
  if (failures.length) throw new Error(`Responsive audit failed with ${failures.length} issue(s)`);
  process.exit(0);
}

await setViewport(390);
await navigate(appUrl);
const hasLogin = await evaluate(
  `Boolean(document.querySelector('.auth-page input[type="email"]'))`,
);
if (hasLogin) {
  await evaluate(`(() => {
    const setValue = (input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value)
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
    setValue(document.querySelector('input[type="email"]'), "grace@kargo.demo")
    setValue(document.querySelector('input[type="password"]'), "KargoDemo123!")
    return true
  })()`);
  await clickButton("Login");
  await pause(2200);
}

const buyerSurfaces = ["Home", "Cart", "Dashboard", "History"];
for (const width of widths) {
  await setViewport(width);
  await navigate(appUrl);
  for (const surface of buyerSurfaces) {
    if (surface !== "Home") await clickButton(surface, ".icon-tabbar button");
    else await clickButton("Home", ".icon-tabbar button");
    failures.push(...(await audit(`Buyer ${surface}`, width)));
  }
  await clickButton("Home", ".icon-tabbar button");
  await evaluate(
    `document.querySelector('.kargo-mobile-search-toggle[aria-label="Open search"]')?.click()`,
  );
  await pause(100);
  const mobileSearch = JSON.parse(
    await evaluate(`JSON.stringify((() => {
      const visibleSearchBoxes = [...document.querySelectorAll('.kargo-search-wrap')]
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return getComputedStyle(element).display !== 'none' && rect.width > 0 && rect.height > 0
        })
      return {
        visibleCount: visibleSearchBoxes.length,
        insideHeader: visibleSearchBoxes.every((element) => Boolean(element.closest('.kargo-header'))),
        secondaryPanel: Boolean(document.querySelector('.kargo-mobile-search-panel')),
        inputFocused: document.activeElement?.matches('.kargo-search input') ?? false,
      }
    })())`),
  );
  const mobileSearchFailures = [];
  if (mobileSearch.visibleCount !== 1)
    mobileSearchFailures.push(`${mobileSearch.visibleCount} visible search boxes`);
  if (!mobileSearch.insideHeader) mobileSearchFailures.push("search outside header");
  if (mobileSearch.secondaryPanel) mobileSearchFailures.push("secondary search panel");
  if (!mobileSearch.inputFocused) mobileSearchFailures.push("search input not focused");
  failures.push(...mobileSearchFailures);
  console.log(JSON.stringify({ surface: "Mobile search", width, ...mobileSearch, failures: mobileSearchFailures }));
  await evaluate(
    `document.querySelector('.kargo-mobile-search-toggle[aria-label="Close search"]')?.click()`,
  );
  const openedBatch = await evaluate(`(() => {
    const card = document.querySelector('.buyer-batch-card')
    card?.click()
    return Boolean(card)
  })()`);
  if (openedBatch) {
    await pause(350);
    failures.push(...(await audit("Buyer batch detail", width)));
  }
}

ws.close();
if (failures.length) throw new Error(`Responsive audit failed with ${failures.length} issue(s)`);
