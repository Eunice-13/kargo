// Keeps the address bar in step with in-app navigation.
//
// The app is a single-page app whose tabs and sub-pages live in React state, so
// without this the URL kept whatever `?batch=` it booted with (a shared link)
// even after the buyer went back to the grid or switched tabs. Deep links are
// still honoured on load; these helpers only tidy the URL afterwards.

function replaceUrl(url: URL) {
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Point the URL at the batch currently on screen, or drop the batch/group
 * params when no batch page is open. No-op when the URL already matches.
 */
export function setBatchUrlParam(batchId: number | null) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  if (batchId === null) {
    if (!url.searchParams.has("batch") && !url.searchParams.has("group")) return;
    url.searchParams.delete("batch");
    url.searchParams.delete("group");
    replaceUrl(url);
    return;
  }

  const next = String(batchId);
  if (url.searchParams.get("batch") === next) return;
  url.searchParams.set("batch", next);
  // A group code only applies to the batch link it arrived with.
  url.searchParams.delete("group");
  replaceUrl(url);
}

/** Drop the batch deep-link params (used when leaving the Batches tab). */
export function clearBatchUrlParam() {
  setBatchUrlParam(null);
}
