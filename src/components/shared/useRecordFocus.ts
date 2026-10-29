import { useEffect, useRef } from "react";
import type { Tab } from "@/types";
import { navIntent, subscribeNavIntent, type RecordFocusTarget } from "@/state/navIntent";

// Pages tag each record they render with `data-record-keys`, a space-separated
// list such as "order:<uuid> group:<uuid>". A notification deep link then finds
// the row by whichever id it knows, scrolls to it, and highlights it.

type RecordKeyParts = {
  orderId?: string | number | null;
  // For a record that stands for several orders (a combined delivery request).
  orderIds?: (string | number)[];
  paymentId?: string | number | null;
  groupOrderId?: string | number | null;
  combinedGroupId?: string | number | null;
};

const HIGHLIGHT_MS = 2600;
// Data can still be loading when the page mounts, so keep looking briefly.
const FIND_ATTEMPTS = 40;
const FIND_INTERVAL_MS = 100;

/** Build the `data-record-keys` attribute value for one rendered record. */
export function recordKeys(parts: RecordKeyParts): string | undefined {
  const keys: string[] = [];
  if (parts.orderId) keys.push(`order:${parts.orderId}`);
  for (const id of parts.orderIds ?? []) keys.push(`order:${id}`);
  if (parts.paymentId) keys.push(`payment:${parts.paymentId}`);
  if (parts.groupOrderId) keys.push(`group:${parts.groupOrderId}`);
  if (parts.combinedGroupId) keys.push(`combined:${parts.combinedGroupId}`);
  return keys.length ? keys.join(" ") : undefined;
}

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0;
}

function findRecordElement(target: RecordFocusTarget): HTMLElement | null {
  // Most specific first: a payment or order row beats the group it belongs to.
  const keys = [
    target.paymentId && `payment:${target.paymentId}`,
    target.orderId && `order:${target.orderId}`,
    target.combinedGroupId && `combined:${target.combinedGroupId}`,
    target.groupOrderId && `group:${target.groupOrderId}`,
  ].filter((key): key is string => Boolean(key));
  for (const key of keys) {
    const candidates = document.querySelectorAll<HTMLElement>(
      `[data-record-keys~="${CSS.escape(key)}"]`,
    );
    for (const element of candidates) {
      if (isVisible(element)) return element;
    }
  }
  return null;
}

const timers = new WeakMap<HTMLElement, number>();

/** Scroll an element into view and mark it with the shared highlight. */
export function revealRecord(element: HTMLElement) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  // Keyboard and screen-reader users land on the record too.
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
  window.clearTimeout(timers.get(element));
  element.classList.remove("record-focus");
  // Force a reflow so re-focusing the same row replays the animation.
  void element.offsetWidth;
  element.classList.add("record-focus");
  timers.set(
    element,
    window.setTimeout(() => element.classList.remove("record-focus"), HIGHLIGHT_MS),
  );
}

/**
 * Consume a pending notification deep link on this page. `prepare` runs once if
 * the record is not on screen yet, so the page can clear filters or expand
 * lists that would otherwise hide it.
 */
export default function useRecordFocus(
  tab: Tab,
  prepare?: (target: RecordFocusTarget) => void,
) {
  const prepareRef = useRef(prepare);
  useEffect(() => {
    prepareRef.current = prepare;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const run = () => {
      const pending = navIntent.recordFocus;
      // Leave intents for other tabs alone so their page can pick them up.
      if (!pending || pending.tab !== tab) return;
      const target = pending.target;
      navIntent.recordFocus = null;
      window.clearTimeout(timer);
      let attempts = 0;
      let prepared = false;
      const look = () => {
        if (cancelled) return;
        const element = findRecordElement(target);
        if (element) {
          revealRecord(element);
          return;
        }
        if (!prepared && attempts >= 2) {
          prepared = true;
          prepareRef.current?.(target);
        }
        if (++attempts < FIND_ATTEMPTS) timer = window.setTimeout(look, FIND_INTERVAL_MS);
      };
      timer = window.setTimeout(look, 50);
    };

    run();
    const unsubscribe = subscribeNavIntent(run);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [tab]);
}
