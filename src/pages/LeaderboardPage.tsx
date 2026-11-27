import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Clock3, Crown, Maximize2, Minimize2, Timer, Trophy, Users, CheckCircle2, WifiOff } from 'lucide-react'
import { api, errorMessage } from '@/services'
import { useConfig } from '@/hooks/useConfig'
import { useInterval, useTitle } from '@/hooks/misc'
import { formatDuration, formatScore, initials, timeAgo } from '@/lib/format'
import { storage } from '@/lib/storage'
import { cn } from '@/lib/cn'
import { Wordmark } from '@/components/ui/Brand'
import { LiveDot } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { QrCode, publicSiteUrl } from '@/components/QrCode'
import { AmbientBackground } from '@/layouts/PublicLayout'
import type { DayScope, LeaderboardEntry, LeaderboardResponse } from '@/types'

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

const parseScope = (v: string | null): DayScope | null => (v === '1' ? 1 : v === '2' ? 2 : v === 'all' ? 'all' : null)

export default function LeaderboardPage() {
  useTitle('Live leaderboard')
  useBoothScale()
  const [params, setParams] = useSearchParams()
  const { config } = useConfig()
  const rotate = params.get('rotate') === '1'
  const [scope, setScopeState] = useState<DayScope | null>(parseScope(params.get('day')))
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [, forceTick] = useState(0)
  const myAttempt = storage.get<string | null>('kbb.myAttempt', null)
  const loadingRef = useRef(false)

  // Default to the event's active day once config arrives.
  const effectiveScope: DayScope = scope ?? config?.event.activeDay ?? 'all'

  const setScope = (s: DayScope) => {
    setScopeState(s)
    const next = new URLSearchParams(params)
    next.set('day', String(s))
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const res = await api.leaderboard(effectiveScope, 10)
      setData(res)
      setError(null)
      setStale(false)
    } catch (e) {
      setError(errorMessage(e))
      setStale(true)
    } finally {
      loadingRef.current = false
    }
  }, [effectiveScope])

  useEffect(() => {
    setData((d) => (d && d.scope !== effectiveScope ? null : d))
    void load()
  }, [load, effectiveScope])

  useInterval(() => void load(), POLL_MS, { pauseHidden: true })
  useInterval(() => forceTick((x) => x + 1), 1000)
  // Kiosk mode: rotate Day → Overall every 20s with ?rotate=1
  useInterval(() => {
    const active = config?.event.activeDay ?? 1
    setScopeState((s) => ((s ?? active) === 'all' ? active : 'all'))
  }, rotate ? 20000 : null)

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  const entries = data?.entries ?? []
  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)
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
            <p className="font-headline text-lg leading-none text-fg">Live Leaderboard</p>
            <p className="mt-1 text-xs text-faint">{config?.event.name ?? 'DIU Job Utsob 2026'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      <main className="mx-auto grid max-w-[1500px] gap-6 px-4 pt-6 pb-10 sm:px-8 lg:grid-cols-[1fr_20rem] lg:gap-8 lg:pt-8">
        <section className="min-w-0">
          {/* Day selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Leaderboard scope" className="flex rounded-2xl border border-line bg-surface/70 p-1 backdrop-blur">
              {([1, 2, 'all'] as DayScope[]).map((s) => {
                const active = effectiveScope === s
                return (
                  <button
                    key={String(s)}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setScope(s)}
                    className={cn('relative rounded-xl px-4 py-2 text-sm font-semibold transition-colors sm:px-5', active ? 'text-fg' : 'text-faint hover:text-muted')}
                  >
                    {active && <motion.span layoutId="lb-tab" className="absolute inset-0 rounded-xl border border-line-strong bg-surface-3" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <span className="relative">{s === 'all' ? 'Overall' : `Day ${s}`}</span>
                    {s === config?.event.activeDay && <span className="relative ml-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-success" title="Today" />}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-faint">Ranked by score, then fastest time</p>
          </div>

          {!data && !error && <BoardSkeleton />}
          {!data && error && <div className="card-surface mt-6 rounded-3xl"><ErrorState title="Leaderboard unavailable" message={error} onRetry={load} /></div>}

          {data && entries.length === 0 && (
            <div className="card-surface mt-6 rounded-3xl">
              <EmptyState
                icon={<Trophy />}
                title="The board is wide open"
                description="No one has finished yet. Scan the QR code and claim the top spot!"
              />
            </div>
          )}

          {data && entries.length > 0 && (
            <LayoutGroup>
              <Podium entries={podium} myAttempt={myAttempt} />
              {rest.length > 0 && (
                <ol className="mt-6 space-y-2.5">
                  <AnimatePresence initial={false}>
                    {rest.map((e) => (
                      <Row key={e.attemptId} e={e} me={e.attemptId === myAttempt} />
                    ))}
                  </AnimatePresence>
                </ol>
              )}
            </LayoutGroup>
          )}
        </section>

        {/* Sidebar */}
        <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
            <SideStat icon={<Users />} label="Participants" value={data?.stats.participants} />
            <SideStat icon={<CheckCircle2 />} label="Completed" value={data?.stats.completed} />
          </div>
          <div className="card-surface flex flex-col items-center rounded-3xl p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Scan to play</p>
            <QrCode value={siteUrl} size={180} className="mt-4" />
            <p className="font-headline mt-4 text-lg text-fg">Think Fast. Play Smart.</p>
            <p className="mt-1 break-all text-xs text-faint">{siteUrl.replace(/^https?:\/\//, '')}</p>
          </div>
          <div className="card-surface rounded-3xl p-5 text-sm sm:col-span-2 lg:col-span-1">
            <p className="font-semibold text-fg">Tie-breakers</p>
            <ol className="mt-3 space-y-2 text-muted">
              <li className="flex gap-2"><span className="font-mono text-accent">1</span> Highest score</li>
              <li className="flex gap-2"><span className="font-mono text-accent">2</span> Fastest completion time</li>
              <li className="flex gap-2"><span className="font-mono text-accent">3</span> Earliest submission</li>
            </ol>
          </div>
        </aside>
      </main>
    </div>
  )
}

function Avatar({ name, rank, size = 'md' }: { name: string; rank: number; size?: 'md' | 'lg' | 'xl' }) {
  const ring = rank === 1 ? 'from-amber-300 via-yellow-200 to-amber-500' : rank === 2 ? 'from-slate-200 via-white to-slate-400' : rank === 3 ? 'from-orange-300 via-amber-200 to-orange-600' : ''
  const dims = size === 'xl' ? 'size-24 text-2xl' : size === 'lg' ? 'size-18 text-xl' : 'size-11 text-sm'
  return (
    <span className={cn('relative grid shrink-0 place-items-center rounded-full p-[3px]', rank <= 3 ? `bg-gradient-to-br ${ring}` : 'bg-line-strong', dims)}>
      <span className="grid size-full place-items-center rounded-full bg-surface-2 font-headline text-fg">{initials(name)}</span>
    </span>
  )
}

function Podium({ entries, myAttempt }: { entries: LeaderboardEntry[]; myAttempt: string | null }) {
  // visual order: 2nd, 1st, 3rd
  const order = [entries[1], entries[0], entries[2]]
  const heights = ['h-28 sm:h-36', 'h-36 sm:h-48', 'h-20 sm:h-28']
  return (
    <div className="mt-8 grid grid-cols-3 items-end gap-2 sm:gap-5">
      {order.map((e, i) => {
        if (!e) return <div key={`empty-${i}`} />
        const first = e.rank === 1
        return (
          <motion.div
            key={e.attemptId}
            layout
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: i * 0.08 }}
            className="flex min-w-0 flex-col items-center"
          >
            <div className="relative flex flex-col items-center px-1 text-center">
              {first && (
                <motion.span initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="mb-1 text-amber-300 drop-shadow-[0_4px_16px_rgb(252_211_77/0.6)]">
                  <Crown className="size-7 sm:size-9" fill="currentColor" />
                </motion.span>
              )}
              <div className="hidden sm:block"><Avatar name={e.name} rank={e.rank} size={first ? 'xl' : 'lg'} /></div>
              <div className="sm:hidden"><Avatar name={e.name} rank={e.rank} size={first ? 'lg' : 'md'} /></div>
              <p className={cn('mt-3 w-full truncate font-semibold text-fg', first ? 'text-base sm:text-xl' : 'text-sm sm:text-lg')}>
                {e.name}
                {e.attemptId === myAttempt && <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 align-middle text-[10px] font-bold text-on-accent">YOU</span>}
              </p>
              <p className="w-full truncate text-[11px] text-faint sm:text-xs">{e.department}</p>
              <p className={cn('font-headline mt-2 tabular text-gradient', first ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-4xl')}>{formatScore(e.score)}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted sm:text-xs"><Timer className="size-3" /> {formatDuration(e.durationMs)}</p>
            </div>
            <div
              className={cn(
                'relative mt-4 w-full overflow-hidden rounded-t-2xl border border-b-0 sm:rounded-t-3xl',
                heights[i],
                first ? 'border-accent/40' : 'border-line-strong',
              )}
              style={{
                background: first
                  ? 'linear-gradient(180deg, color-mix(in oklab, var(--t-accent) 28%, var(--t-surface)), var(--t-surface) 85%)'
                  : 'linear-gradient(180deg, var(--t-surface-2), var(--t-surface) 85%)',
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <span className={cn('font-headline absolute inset-x-0 top-3 text-center sm:top-4', first ? 'text-5xl text-fg sm:text-7xl' : 'text-4xl text-muted sm:text-6xl')}>{e.rank}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function Row({ e, me }: { e: LeaderboardEntry; me: boolean }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className={cn(
        'card-surface flex items-center gap-3 rounded-2xl px-3 py-3 sm:gap-4 sm:px-5 sm:py-3.5',
        me && 'border-accent/60 shadow-[0_0_0_1px_var(--t-accent)]',
      )}
    >
      <span className="font-headline w-8 shrink-0 text-center text-xl text-faint tabular sm:w-10 sm:text-2xl">{e.rank}</span>
      <Avatar name={e.name} rank={e.rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-fg">
          {e.name}
          {me && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 align-middle text-[10px] font-bold text-on-accent">YOU</span>}
        </p>
        <p className="truncate text-xs text-faint">{e.department} · {e.university}</p>
      </div>
      <div className="hidden items-center gap-1.5 text-sm text-muted sm:flex">
        <Clock3 className="size-3.5" /> <span className="tabular">{formatDuration(e.durationMs)}</span>
      </div>
      <div className="w-16 text-right sm:w-20">
        <p className="font-headline text-2xl text-fg tabular">{formatScore(e.score)}</p>
        <p className="text-[10px] text-faint sm:hidden">{formatDuration(e.durationMs)}</p>
      </div>
    </motion.li>
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
    <div className="mt-8">
      <div className="grid grid-cols-3 items-end gap-4">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
      <div className="mt-6 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
      </div>
    </div>
  )
}
