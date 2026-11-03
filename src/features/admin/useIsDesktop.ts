import { useSyncExternalStore } from "react";

// Desktop-sized admin detail modals use a two-column layout; phones keep the stacked one.
const DESKTOP_QUERY = "(min-width: 768px)";

export default function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
