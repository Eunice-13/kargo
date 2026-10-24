import { useCallback, useEffect, useRef, useState } from "react"

import { AdminAccessError } from "@/services"

type State<T> = {
  data: T | null
  loading: boolean
  error: string | null
  accessDenied: boolean
}

// Loads an admin resource, re-fetching when `deps` change. Ignores stale
// responses so fast filter changes never flash older data. `refreshKey` lets the
// admin shell invalidate on realtime events.
export function useAdminResource<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  refreshKey = 0,
): State<T> & { refresh: () => void } {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: true,
    error: null,
    accessDenied: false,
  })
  const [manual, setManual] = useState(0)
  const runId = useRef(0)

  const refresh = useCallback(() => setManual((n) => n + 1), [])

  useEffect(() => {
    const id = ++runId.current
    setState((prev) => ({ ...prev, loading: true, error: null }))

    loader()
      .then((data) => {
        if (id !== runId.current) return
        setState({ data, loading: false, error: null, accessDenied: false })
      })
      .catch((err: unknown) => {
        if (id !== runId.current) return
        const accessDenied = err instanceof AdminAccessError
        setState({
          data: null,
          loading: false,
          accessDenied,
          error:
            err instanceof Error
              ? err.message
              : "Something went wrong loading this view.",
        })
      })

    return () => {
      // Invalidate any in-flight response for this effect run.
      runId.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey, manual])

  return { ...state, refresh }
}
