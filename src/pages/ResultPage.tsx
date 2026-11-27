import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { CheckCircle2, CircleDashed, Clock3, Home, PartyPopper, ShieldAlert, Ticket, TimerOff, Trophy, XCircle } from 'lucide-react'
import { api, toAppError } from '@/services'
import { useSession } from '@/hooks/useSession'
import { useConfig } from '@/hooks/useConfig'
import { useTitle } from '@/hooks/misc'
import { formatDuration, formatScore } from '@/lib/format'
import { cn } from '@/lib/cn'
import { storage } from '@/lib/storage'
import { LinkButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState, PageLoader } from '@/components/ui/Feedback'
import { FlowSteps } from '@/components/quiz/FlowSteps'
import type { AttemptResult, Prize } from '@/types'

function tier(pct: number) {
  if (pct >= 0.9) return { title: 'Legendary!', line: 'That was a masterclass. Brilliant work!' }
  if (pct >= 0.7) return { title: 'Brilliant work!', line: 'Sharp mind, quick fingers. Well played!' }
  if (pct >= 0.5) return { title: 'Solid effort!', line: 'A strong showing — you clearly know your stuff.' }
  if (pct > 0) return { title: 'Great try!', line: 'Every battle sharpens the mind. Thanks for taking on the challenge!' }
  return { title: 'Thanks for playing!', line: 'Tough round — but showing up is what counts. Come say hi at the booth!' }
}

export default function ResultPage() {
  useTitle('Your result')
  const { state } = useLocation() as { state: { result?: AttemptResult } | null }
  const navigate = useNavigate()
  const { session } = useSession()
  const [result, setResult] = useState<AttemptResult | null>(state?.result ?? null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!session) return
    setError(null)
    try {
      setResult(await api.result(session.token))
    } catch (err) {
      const e = toAppError(err)
      if (e.code === 'NO_ATTEMPT') return navigate('/instructions', { replace: true })
      if (e.code === 'ATTEMPT_IN_PROGRESS') return navigate('/quiz', { replace: true })
      if (e.code === 'INVALID_SESSION') return navigate('/register', { replace: true })
      setError(e.isNetwork ? 'Connection problem — please check your internet.' : e.message)
    }
  }

  useEffect(() => {
    // Always refresh in the background: rank may change as others finish.
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  if (!session) return <Navigate to="/register" replace />
  if (error && !result) return <div className="mx-auto max-w-xl px-4 py-16"><Card><ErrorState message={error} onRetry={load} /></Card></div>
  if (!result) return <PageLoader label="Calculating your score…" />

  return <ResultView r={result} />
}

function ResultView({ r }: { r: AttemptResult }) {
  const pct = r.maxScore > 0 ? Math.max(0, r.score) / r.maxScore : 0
  const t = r.disqualified
    ? { title: 'Quiz ended', line: 'Your quiz was stopped by the anti-cheat system.' }
    : tier(pct)
  const { config } = useConfig()
  const celebrate = !r.disqualified && Boolean(r.draw?.inPool || r.draw?.wonPosition != null)

  const count = useMotionValue(0)
  const shown = useTransform(count, (v) => formatScore(Math.round(v * 100) / 100))
  const ring = useMotionValue(0)
  const C = 2 * Math.PI * 70
  const dash = useTransform(ring, (v) => C * (1 - v))

  useEffect(() => {
    storage.set('kbb.myAttempt', r.attemptId)
  }, [r.attemptId])

  useEffect(() => {
    const a = animate(count, r.score, { duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 })
    const b = animate(ring, pct, { duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 })
    return () => { a.stop(); b.stop() }
  }, [count, ring, r.score, pct])

  const total = r.totalQuestions || 1
  const segments = [
    { key: 'correct', value: r.correct, cls: 'bg-success' },
    { key: 'incorrect', value: r.incorrect, cls: 'bg-danger' },
    { key: 'unanswered', value: r.unanswered, cls: 'bg-surface-3' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:pt-10">
      <FlowSteps current={4} />
      {celebrate && <Burst />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-10">
        <Card className="relative overflow-hidden px-6 pt-10 pb-8 text-center sm:px-10">
          <div className="absolute left-1/2 top-0 h-56 w-[80%] -translate-x-1/2 rounded-full bg-gradient-accent opacity-15 blur-3xl" />
          <p className="relative text-sm text-muted">{r.fullName}</p>

          <div className="relative mx-auto mt-6 size-52 sm:size-60">
            <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
              <defs>
                <linearGradient id="resultRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--t-accent)' }} />
                  <stop offset="1" style={{ stopColor: 'var(--t-accent-2)' }} />
                </linearGradient>
              </defs>
              <circle cx="80" cy="80" r="70" fill="none" strokeWidth="10" style={{ stroke: 'var(--t-surface-3)' }} />
              <motion.circle cx="80" cy="80" r="70" fill="none" strokeWidth="10" strokeLinecap="round" stroke="url(#resultRing)" strokeDasharray={C} style={{ strokeDashoffset: dash }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span className="font-headline text-6xl text-fg tabular sm:text-7xl">{shown}</motion.span>
              <span className="mt-1 text-sm text-faint">out of {formatScore(r.maxScore)}</span>
            </div>
          </div>

          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="font-headline relative mt-7 text-3xl text-fg sm:text-4xl">
            {t.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }} className="relative mx-auto mt-2 max-w-md text-muted">
            {t.line}
          </motion.p>

          {r.submitReason !== 'manual' && r.submitReason !== 'violation' && (
            <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-faint">
              <TimerOff className="size-3.5" /> Auto-submitted when the timer ran out
            </p>
          )}

          {/* Lucky-draw status (no public ranks) */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 22 }} className="relative mt-8">
            <DrawStatus r={r} prizes={config?.event.prizes ?? []} />
          </motion.div>
        </Card>

        {/* Breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<CheckCircle2 />} tone="text-success" label="Correct" value={r.correct} />
          <Stat icon={<XCircle />} tone="text-danger" label="Incorrect" value={r.incorrect} />
          <Stat icon={<CircleDashed />} tone="text-muted" label="Unanswered" value={r.unanswered} />
          <Stat icon={<Clock3 />} tone="text-accent" label="Time taken" value={formatDuration(r.durationMs)} />
        </div>

        <Card className="mt-4 p-5">
          <div className="flex items-center justify-between text-xs text-faint">
            <span>Accuracy</span>
            <span className="tabular">{Math.round((r.correct / total) * 100)}%</span>
          </div>
          <div className="mt-3 flex h-3 gap-1 overflow-hidden rounded-full">
            {segments.map((s, i) =>
              s.value > 0 ? (
                <motion.span
                  key={s.key}
                  initial={{ flexGrow: 0 }}
                  animate={{ flexGrow: s.value }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className={cn('h-full min-w-1.5 rounded-full', s.cls)}
                  style={{ flexBasis: 0 }}
                />
              ) : null,
            )}
          </div>
        </Card>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <LinkButton to="/leaderboard" size="lg" block icon={<Ticket className="size-5" />}>See the lucky draw</LinkButton>
          <LinkButton to="/" size="lg" variant="secondary" block icon={<Home className="size-5" />}>Back to home</LinkButton>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-faint">
          The highest scores win; ties are decided by lucky draw. Winners are contacted on their registered email or phone.
        </p>
      </motion.div>
    </div>
  )
}

function DrawStatus({ r, prizes }: { r: AttemptResult; prizes: Prize[] }) {
  if (r.disqualified) {
    return (
      <StatusBox tone="danger" icon={<ShieldAlert />} title="Disqualified">
        Your quiz was ended because you left the quiz screen or used copy/paste after a warning.
        Disqualified attempts can't win prizes. If this was a mistake, talk to the Kaizenext team.
      </StatusBox>
    )
  }
  const { inPool, topScore, poolSize, wonPosition } = r.draw ?? { inPool: false, topScore: null, poolSize: 0, wonPosition: null }
  if (wonPosition != null) {
    const prize = prizes[wonPosition - 1]
    return (
      <StatusBox tone="win" icon={<PartyPopper />} title={`You won ${prize?.place ? `the ${prize.place}` : 'a prize'}!`}>
        Congratulations{prize?.title ? <>, you won the <span className="font-semibold text-fg">{prize.title}</span></> : null}! We'll contact you on your registered email or phone to deliver it.
      </StatusBox>
    )
  }
  if (inPool) {
    const others = poolSize - 1
    return (
      <StatusBox tone="win" icon={<Ticket />} title="You have the top score!">
        You're on the campaign's top score{others > 0 ? <>, along with {others} other{others === 1 ? '' : 's'}</> : null}. The highest scores win; if players tie, winners are picked by lucky draw when results are announced.
        <span className="mt-1.5 block text-xs text-faint">The campaign is still running, so someone may still beat this score.</span>
      </StatusBox>
    )
  }
  return (
    <StatusBox tone="neutral" icon={<Trophy />} title="How winners are chosen">
      {topScore != null ? (
        <>The current top score is <span className="font-semibold text-fg">{formatScore(topScore)}/{formatScore(r.maxScore)}</span>. The highest scores win the prizes. Thanks for playing!</>
      ) : (
        <>The highest scores win the prizes. Thanks for playing!</>
      )}
    </StatusBox>
  )
}

function StatusBox({ tone, icon, title, children }: { tone: 'win' | 'neutral' | 'danger'; icon: ReactNode; title: string; children: ReactNode }) {
  const win = tone === 'win'
  const danger = tone === 'danger'
  return (
    <div className={cn('flex items-start gap-4 rounded-2xl border p-4 text-left sm:p-5', win ? 'border-accent/40 bg-accent/8' : danger ? 'border-danger/40 bg-danger/8' : 'border-line bg-bg-soft/60')}>
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl [&>svg]:size-5.5', win ? 'bg-gradient-accent text-on-accent' : danger ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-accent')}>{icon}</span>
      <div className="min-w-0">
        <p className="font-headline text-lg text-fg sm:text-xl">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  )
}

function Stat({ icon, tone, label, value }: { icon: ReactNode; tone: string; label: string; value: ReactNode }) {
  return (
    <Card className="p-4">
      <span className={cn('[&>svg]:size-4.5', tone)}>{icon}</span>
      <p className="font-headline mt-2.5 text-2xl text-fg tabular">{value}</p>
      <p className="text-xs text-faint">{label}</p>
    </Card>
  )
}

/** Lightweight celebration burst (no canvas, no dependency). */
function Burst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 700,
        y: -(180 + Math.random() * 320),
        r: Math.random() * 540 - 270,
        size: 6 + Math.random() * 6,
        color: ['var(--t-accent)', 'var(--t-accent-2)', 'var(--t-success)', 'var(--t-warning)'][i % 4],
        delay: Math.random() * 0.25,
      })),
    [],
  )
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[38%] z-40 flex justify-center">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-[2px]"
          style={{ width: p.size, height: p.size * 0.45, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 520], opacity: [1, 1, 0], rotate: p.r }}
          transition={{ duration: 2.4, delay: 0.9 + p.delay, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.4, 1] }}
        />
      ))}
    </div>
  )
}
