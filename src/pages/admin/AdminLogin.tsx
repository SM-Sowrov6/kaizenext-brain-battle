import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { LockKeyhole, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { useTitle } from '@/hooks/misc'
import { errorMessage } from '@/services'
import { env } from '@/lib/env'
import { Wordmark } from '@/components/ui/Brand'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, PageLoader } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { AmbientBackground } from '@/layouts/PublicLayout'

export default function AdminLogin() {
  useTitle('Admin sign in')
  const { user, checking, signIn } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state: { from?: string } | null }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (checking) return <PageLoader />
  if (user) return <Navigate to={location.state?.from ?? '/admin'} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      navigate(location.state?.from ?? '/admin', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBackground intensity={0.7} />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <ThemeSwitcher />
      </header>
      <main className="grid flex-1 place-items-center px-4 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-accent">
              <ShieldCheck className="size-5.5" />
            </div>
            <h1 className="font-headline mt-4 text-2xl text-fg">Admin console</h1>
            <p className="mt-1 text-sm text-muted">Sign in to manage Brain Battle.</p>
          </div>
          <Card className="p-6">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {error && <Alert tone="danger">{error}</Alert>}
              {import.meta.env.DEV && env.demoMode && (
                <Alert tone="warning" title="Demo mode">Use any email with password <code className="font-mono text-fg">demo1234</code>.</Alert>
              )}
              <Field label="Email" htmlFor="a-email">
                <Input id="a-email" type="email" autoComplete="username" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" htmlFor="a-pass">
                <Input id="a-pass" type="password" autoComplete="current-password" icon={<LockKeyhole />} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" block size="lg" loading={busy} icon={<LogIn className="size-4.5" />}>Sign in</Button>
            </form>
          </Card>
          <p className="mt-5 text-center text-xs text-faint">Access is limited to accounts listed in <code className="font-mono">admin_users</code>.</p>
        </motion.div>
      </main>
    </div>
  )
}
