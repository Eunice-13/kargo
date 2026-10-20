import { useLayoutEffect } from "react";

// The browser's own scroll restoration fights this policy on reloads and
// history traversals: it re-applies the last offset after we have reset it.
// KARGO's "routes" are React state, so the app is the only thing that should
// decide where a page starts.
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

// Scroll position belongs to the page you are on, not to the app shell. KARGO
// has no router: a "route" is any distinct page the shell can render, keyed by
// a string. `useScrollToTopOnRouteChange` is the single place that decides what
// happens on navigation, so individual pages never need their own scroll code.
//
// Keys compose from the outside in: the shell reports the tab, and a tab that
// renders its own sub-pages (Batches -> batch page, seller shop, seller
// directory) reports those too.

/** Reset every container that can hold the app's scroll offset. */
export function scrollToTop() {
  if (typeof window === "undefined") return;

  // "auto" keeps the jump instant instead of animating it.
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  // The mobile shell makes #root the scroller in some layouts, and legacy
  // browsers scroll <body> instead of <html>, so reset every candidate.
  const containers = [
    document.scrollingElement as HTMLElement | null,
    document.documentElement,
    document.body,
    document.getElementById("root"),
  ];

  for (const container of containers) {
    if (container) container.scrollTop = 0;
  }
}

/**
 * Jump to the top whenever `routeKey` changes. The first render counts as well:
 * a freshly opened page must not inherit the offset it was opened from.
 */
export function useScrollToTopOnRouteChange(routeKey: string) {
  // Layout effect so the reset lands before the new page paints, which avoids a
  // one-frame flash of the old scroll offset.
  useLayoutEffect(() => {
    scrollToTop();
  }, [routeKey]);
}
