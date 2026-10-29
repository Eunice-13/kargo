/** Per-card/session cache. No module-global financial records or failed-result cache. */
export class StalePaymentPreview extends Error {}
export function createPaymentPreviewCache<T>(
  load: () => Promise<T>,
  now = Date.now,
  maxAge = 30_000,
) {
  let version = 0,
    disposed = false;
  let cached: { data: T; at: number } | undefined;
  let pending: Promise<T> | undefined;
  return {
    peek() {
      return cached && now() - cached.at < maxAge ? cached.data : undefined;
    },
    read(): Promise<T> {
      if (disposed) return Promise.reject(new StalePaymentPreview());
      if (cached && now() - cached.at < maxAge) return Promise.resolve(cached.data);
      if (pending) return pending;
      const ticket = version;
      const task = Promise.resolve()
        .then(load)
        .then((data) => {
          if (disposed || ticket !== version) throw new StalePaymentPreview();
          cached = { data, at: now() };
          return data;
        })
        .finally(() => {
          if (pending === task) pending = undefined;
        });
      pending = task;
      return task;
    },
    invalidate() {
      version++;
      cached = undefined;
      pending = undefined;
    },
    dispose() {
      disposed = true;
      version++;
      cached = undefined;
      pending = undefined;
    },
  };
}

/** Pointer intent only; focus/open can read the same deduplicated cache directly. */
export function delayedPaymentPrefetch(load: () => void, delay = 200) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    start() {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        load();
      }, delay);
    },
    cancel,
  };
}
