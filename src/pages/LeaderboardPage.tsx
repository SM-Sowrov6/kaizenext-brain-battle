import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Gift, Maximize2, Minimize2, PartyPopper, Sparkles, Ticket, Trophy, Users, WifiOff } from 'lucide-react'
import { api, errorMessage } from '@/services'
import { useConfig } from '@/hooks/useConfig'
import { useInterval, useTitle } from '@/hooks/misc'
import { formatScore, initials, timeAgo } from '@/lib/format'
import { storage } from '@/lib/storage'
import { cn } from '@/lib/cn'
import { KaizenextLogo, Wordmark } from '@/components/ui/Brand'
import { LiveDot } from '@/components/ui/Card'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { QrCode, publicSiteUrl } from '@/components/QrCode'
import { AmbientBackground } from '@/layouts/PublicLayout'
import type { BoardResponse, DrawWinner, EventDay, PoolEntry, Prize } from '@/types'

const POLL_MS = 5000

/** Scales the whole UI up on big booth monitors (rem-based design → crisp at any size). */
function useBoothScale() {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const w = window.innerWidth
      root.style.fontSize = w > 1600 ? `${Math.min(32, (w / 1600) * 16)}px` : ''
    }
    apply()
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      root.style.fontSize = ''
    }
  }, [])
}

const parseDay = (v: string | null): EventDay | null => (v === '1' ? 1 : v === '2' ? 2 : null)

/**
 * Public booth board. Winners are chosen by lucky draw, so this screen shows
 * the pool of everyone tied on the day's top score — never ranks or times.
 */
export default function LeaderboardPage() {
  useTitle('Lucky draw')
  useBoothScale()
  const [params, setParams] = useSearchParams()
  const { config } = useConfig()
  const [day, setDayState] = useState<EventDay | null>(parseDay(params.get('day')))
  const [data, setData] = useState<BoardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [, forceTick] = useState(0)
  const myAttempt = storage.get<string | null>('kbb.myAttempt', null)
  const loadingRef = useRef(false)

  const effectiveDay: EventDay = day ?? config?.event.activeDay ?? 1

  const setDay = (d: EventDay) => {
    setDayState(d)
    const next = new URLSearchParams(params)
    next.set('day', String(d))
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const res = await api.leaderboard(effectiveDay)
      setData({ ...res, pool: res.pool ?? [], winners: res.winners ?? [], poolTotal: res.poolTotal ?? 0, topScore: res.topScore ?? null, maxScore: res.maxScore ?? null, day: res.day ?? effectiveDay })
      setError(null)
      setStale(false)
    } catch (e) {
      setError(errorMessage(e))
      setStale(true)
    } finally {
      loadingRef.current = false
    }
  }, [effectiveDay])

  useEffect(() => {
    setData((d) => (d && d.day !== effectiveDay ? null : d))
    void load()
  }, [load, effectiveDay])

  useInterval(() => void load(), POLL_MS, { pauseHidden: true })
  useInterval(() => forceTick((x) => x + 1), 1000)

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  const prizes = config?.event.prizes ?? []
  const siteUrl = publicSiteUrl()

  return (
    <div className="relative min-h-dvh">
      <AmbientBackground />

      {/* Header */}
      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 pt-5 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-4">
          <Wordmark />
          <span className="hidden h-8 w-px bg-line-strong sm:block" />
          <div className="hidden sm:block">
            <p className="font-headline text-lg leading-none text-fg">Lucky Draw</p>
            <p className="mt-1 text-xs text-faint">{config?.event.name ?? 'DIU Job Utsob 2026'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <KaizenextLogo className="mr-2 hidden h-9 lg:block" />
          <span
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
              stale ? 'border-warning/40 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success',
            )}
          >
            {stale ? <WifiOff className="size-3.5" /> : <LiveDot />}
            {stale ? 'Reconnecting…' : data ? `Live · ${timeAgo(data.updatedAt)}` : 'Connecting…'}
          </span>
          <button
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}
            className="hidden size-10 place-items-center rounded-xl border border-line bg-surface/70 text-muted transition hover:text-fg sm:grid"
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 pt-6 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:pt-8">
        <section className="min-w-0">
          {/* Day selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Event day" className="flex rounded-2xl border border-line bg-surface/70 p-1 backdrop-blur">
              {([1, 2] as EventDay[]).map((d) => {
                const active = effectiveDay === d
                return (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDay(d)}
                    className={cn('relative rounded-xl px-5 py-2 text-sm font-semibold transition-colors', active ? 'text-fg' : 'text-faint hover:text-muted')}
                  >
                    {active && <motion.span layoutId="lb-tab" className="absolute inset-0 rounded-xl border border-line-strong bg-surface-3" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <span className="relative">Day {d}</span>
                    {d === config?.event.activeDay && <span className="relative ml-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-success" title="Today" />}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-faint">Top scorers enter the draw · winners picked at random</p>
          </div>

          {!data && !error && <BoardSkeleton />}
          {!data && error && <div className="card-surface mt-6 rounded-3xl"><ErrorState title="Board unavailable" message={error} onRetry={load} /></div>}

          {data && (
            <>
              <AnimatePresence>{data.winners.length > 0 && <Winners winners={data.winners} prizes={prizes} day={data.day} myAttempt={myAttempt} />}</AnimatePresence>
              <PoolHero data={data} />
              {data.pool.length > 0 && <PoolNames pool={data.pool} total={data.poolTotal} myAttempt={myAttempt} winners={data.winners} />}
            </>
          )}
        </section>

        {/* Sidebar */}
        <aside className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
            <SideStat icon={<Users />} label="Participants" value={data?.stats.participants} />
            <SideStat icon={<CheckCircle2 />} label="Completed" value={data?.stats.completed} />
          </div>
          <div className="card-surface hidden flex-col items-center rounded-3xl p-6 text-center sm:flex">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Scan to play</p>
            <QrCode value={siteUrl} size={180} className="mt-4" />
            <p className="font-headline mt-4 text-lg text-fg">Think Fast. Play Smart.</p>
            <p className="mt-1 break-all text-xs text-faint">{siteUrl.replace(/^https?:\/\//, '')}</p>
          </div>
          <div className="card-surface rounded-3xl p-5 text-sm sm:col-span-2 lg:col-span-1">
            <p className="font-semibold text-fg">How winners are chosen</p>
            <ol className="mt-3 space-y-2.5 text-muted">
              <li className="flex gap-2.5"><span className="font-mono text-accent">1</span> Play the quiz once</li>
              <li className="flex gap-2.5"><span className="font-mono text-accent">2</span> Everyone with the day's top score enters the draw</li>
              <li className="flex gap-2.5"><span className="font-mono text-accent">3</span> Winners are drawn at random at the Kaizenext booth</li>
            </ol>
          </div>
        </aside>
      </main>
    </div>
  )
}

function PoolHero({ data }: { data: BoardResponse }) {
  const empty = data.poolTotal === 0
  return (
    <div className="card-surface relative mt-6 overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
      <div className="absolute left-1/2 top-0 h-48 w-[70%] -translate-x-1/2 rounded-full bg-gradient-accent opacity-15 blur-3xl" />
      <div className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-accent text-on-accent shadow-[0_12px_40px_-10px_var(--t-accent)]">
        <Ticket className="size-7" />
      </div>
      {empty ? (
        <>
          <h1 className="font-headline relative mt-6 text-3xl text-fg sm:text-5xl">The draw is wide open</h1>
          <p className="relative mx-auto mt-3 max-w-md text-muted">No one has finished on Day {data.day} yet. Scan the QR code and set the score to beat!</p>
        </>
      ) : (
        <>
          <motion.p key={data.poolTotal} initial={{ scale: 0.85, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="font-headline relative mt-6 text-6xl text-gradient tabular sm:text-8xl">
            {data.poolTotal}
          </motion.p>
          <h1 className="font-headline relative mt-2 text-2xl text-fg sm:text-4xl">
            {data.poolTotal === 1 ? 'player is' : 'players are'} in the Day {data.day} lucky draw
          </h1>
          <p className="relative mx-auto mt-3 max-w-lg text-muted">
            Everyone who scored the day's top score of{' '}
            <span className="font-semibold text-fg">{formatScore(data.topScore)}/{formatScore(data.maxScore)}</span> is in.
            Beat it, and the draw starts fresh with you!
          </p>
        </>
      )}
    </div>
  )
}

function PoolNames({ pool, total, myAttempt, winners }: { pool: PoolEntry[]; total: number; myAttempt: string | null; winners: DrawWinner[] }) {
  const won = new Set(winners.map((w) => w.attemptId))
  return (
    <div className="mt-6">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-faint">
        <Sparkles className="size-3.5 text-accent" /> In the draw
      </p>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {pool.map((p) => {
            const me = p.attemptId === myAttempt
            return (
              <motion.li
                key={p.attemptId}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className={cn('card-surface flex min-w-0 items-center gap-3 rounded-2xl px-3.5 py-3', me && 'border-accent/60 shadow-[0_0_0_1px_var(--t-accent)]')}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 font-headline text-sm text-fg ring-1 ring-line-strong">{initials(p.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">
                    {p.name}
                    {me && <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 align-middle text-[10px] font-bold text-on-accent">YOU</span>}
                  </p>
                  <p className="truncate text-xs text-faint">{p.department}</p>
                </div>
                {won.has(p.attemptId) && <Trophy className="size-4 shrink-0 text-warning" aria-label="Winner" />}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      {total > pool.length && <p className="mt-3 text-center text-sm text-faint">+ {total - pool.length} more in the draw</p>}
    </div>
  )
}

function Winners({ winners, prizes, day, myAttempt }: { winners: DrawWinner[]; prizes: Prize[]; day: EventDay; myAttempt: string | null }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        <PartyPopper className="size-4" /> Day {day} winners
      </p>
      <div className={cn('grid grid-cols-1 gap-3', winners.length >= 3 ? 'md:grid-cols-3' : winners.length === 2 ? 'md:grid-cols-2' : '')}>
        {winners.map((w, i) => {
          const prize = prizes[w.position - 1]
          const first = w.position === 1
          return (
            <motion.div
              key={w.attemptId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20, delay: i * 0.08 }}
              className={cn('card-surface relative min-w-0 overflow-hidden rounded-3xl p-5 text-center', first && 'border-accent/50')}
            >
              {first && <div className="absolute inset-x-0 top-0 h-px bg-gradient-accent" />}
              <span className={cn('mx-auto grid size-12 place-items-center rounded-2xl', first ? 'bg-gradient-accent text-on-accent' : 'bg-surface-2 text-accent')}>
                {first ? <Trophy className="size-5.5" /> : <Gift className="size-5.5" />}
              </span>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent">{prize?.place || `Prize ${w.position}`}</p>
              <p className="font-headline mt-1.5 truncate text-xl text-fg sm:text-2xl">{w.name}</p>
              <p className="truncate text-xs text-faint">{w.department}</p>
              {prize?.title && <p className="mt-2 text-sm text-muted">{prize.title}</p>}
              {w.attemptId === myAttempt && <p className="mt-2 text-xs font-bold text-accent">That's you! Visit the Kaizenext booth.</p>}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

function SideStat({ icon, label, value }: { icon: ReactNode; label: string; value?: number }) {
  return (
    <div className="card-surface rounded-3xl p-5">
      <span className="text-accent [&>svg]:size-5">{icon}</span>
      <p className="font-headline mt-3 text-4xl text-fg tabular">
        {value == null ? <Skeleton className="h-9 w-14" /> : (
          <motion.span key={value} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }}>{value}</motion.span>
        )}
      </p>
      <p className="mt-1 text-xs text-faint">{label}</p>
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
      </div>
    </div>
  )
}
