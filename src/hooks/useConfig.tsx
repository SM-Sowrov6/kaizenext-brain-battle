import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, errorMessage } from '@/services'
import type { PublicConfig } from '@/types'

interface ConfigCtx {
  config: PublicConfig | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const Ctx = createContext<ConfigCtx | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setError(null)
      const c = await api.getConfig()
      setConfig(c)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    // Refresh when the tab regains focus — admins may have toggled the quiz meanwhile.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return <Ctx.Provider value={{ config, loading, error, reload }}>{children}</Ctx.Provider>
}

export function useConfig() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider')
  return ctx
}
