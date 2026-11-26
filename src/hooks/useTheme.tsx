import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemeName } from '@/types'
import { KEYS, storage } from '@/lib/storage'

export const THEMES: { id: ThemeName; name: string; description: string; swatch: [string, string, string] }[] = [
  { id: 'midnight', name: 'Midnight', description: 'Brain Battle signature', swatch: ['#05070f', '#4f8cff', '#8b5cf6'] },
  { id: 'kaizenext', name: 'Kaizenext', description: 'Forest & signal orange', swatch: ['#0e1a16', '#e8593a', '#f5a35c'] },
  { id: 'uttirno', name: 'Uttirno', description: 'Navy & scholar gold', swatch: ['#0a1626', '#e8c468', '#c9962a'] },
]

const META_COLORS: Record<ThemeName, string> = { midnight: '#05070f', kaizenext: '#0a1411', uttirno: '#08121f' }

const isTheme = (v: unknown): v is ThemeName => v === 'midnight' || v === 'kaizenext' || v === 'uttirno'

interface ThemeCtx {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  /** Apply the event's default theme unless the visitor picked one. */
  applyDefault: (t: ThemeName) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('theme')
    if (isTheme(fromUrl)) {
      storage.set(KEYS.theme, fromUrl)
      return fromUrl
    }
    const saved = storage.get<unknown>(KEYS.theme, null)
    return isTheme(saved) ? saved : 'midnight'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme])
  }, [theme])

  const setTheme = useCallback((t: ThemeName) => {
    storage.set(KEYS.theme, t)
    setThemeState(t)
  }, [])

  const applyDefault = useCallback((t: ThemeName) => {
    if (!isTheme(storage.get<unknown>(KEYS.theme, null)) && isTheme(t)) setThemeState(t)
  }, [])

  const value = useMemo(() => ({ theme, setTheme, applyDefault }), [theme, setTheme, applyDefault])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
