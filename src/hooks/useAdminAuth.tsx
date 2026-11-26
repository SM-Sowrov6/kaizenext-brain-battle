import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { adminApi, type AdminUser } from '@/services'

interface AdminCtx {
  user: AdminUser | null
  checking: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AdminCtx | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let alive = true
    adminApi
      .getUser()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setChecking(false))
    return () => {
      alive = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await adminApi.signIn(email, password))
  }, [])

  const signOut = useCallback(async () => {
    await adminApi.signOut()
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, checking, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return ctx
}
