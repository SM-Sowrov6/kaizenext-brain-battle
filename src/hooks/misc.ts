import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { errorMessage } from '@/services'

/** setInterval that always sees the latest callback; optionally pauses while the tab is hidden. */
export function useInterval(fn: () => void, ms: number | null, { pauseHidden = false } = {}) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (ms == null) return
    const id = setInterval(() => {
      if (pauseHidden && document.visibilityState === 'hidden') return
      ref.current()
    }, ms)
    return () => clearInterval(id)
  }, [ms, pauseHidden])
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
  )
}

/** Load data with loading / error state and a manual reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const seq = useRef(0)

  const reload = useCallback(async (silent = false) => {
    const id = ++seq.current
    if (!silent) setLoading(true)
    try {
      const d = await fnRef.current()
      if (id === seq.current) {
        setData(d)
        setError(null)
      }
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e))
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, setData, error, loading, reload }
}

/** Sets the document title for the current page. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Kaizenext Brain Battle` : 'Kaizenext Brain Battle · DIU Job Utsob 2026'
  }, [title])
}
