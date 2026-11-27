import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dices, Download, ExternalLink, Gift, Info, PartyPopper, RotateCcw, Ticket, Trophy, Users } from 'lucide-react'
import { adminApi, errorMessage, type AdminPoolEntry } from '@/services'
import { useAsync, useTitle } from '@/hooks/misc'
import { downloadFile, toCsv } from '@/lib/csv'
import { formatDateTime, formatScore } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/layouts/AdminLayout'
import { Button, LinkButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import type { DrawWinner, EventDay, Prize } from '@/types'

/**
 * Admin lucky draw. The winner is chosen by the server (admin_draw_winner);
 * the shuffle animation is only a reveal, it does not influence the pick.
 */
export default function AdminDraw() {
  useTitle('Lucky draw')
  const toast = useToast()
  const settings = useAsync(() => adminApi.getSettings())
  const [day, setDay] = useState<EventDay | null>(null)
  const effectiveDay: EventDay = day ?? settings.data?.activeDay ?? 1
  const pool = useAsync(() => adminApi.getDrawPool(effectiveDay), [effectiveDay])
  const winners = useAsync(() => adminApi.getDrawWinners(effectiveDay), [effectiveDay])
  const [drawing, setDrawing] = useState<{ position: number; prize?: Prize } | null>(null)
  const [reveal, setReveal] = useState<{ winner: DrawWinner; prize?: Prize; names: string[] } | null>(null)
  const [voiding, setVoiding] = useState<DrawWinner | null>(null)
  const [busy, setBusy] = useState(false)

  const prizes = settings.data?.prizes ?? []
  const positions = Math.max(prizes.length, 1)
  const poolRows = pool.data ?? []
  const winnerAt = (pos: number) => winners.data?.find((w) => w.position === pos)
  const contact = (attemptId: string) => poolRows.find((p) => p.attemptId === attemptId)
  const remaining = poolRows.filter((p) => !winners.data?.some((w) => w.attemptId === p.attemptId)).length

  async function draw(position: number) {
    const prize = prizes[position - 1]
    setDrawing({ position, prize })
    setBusy(true)
    try {
      const w = await adminApi.drawWinner(effectiveDay, position)
      setReveal({ winner: w, prize, names: poolRows.map((p) => p.name) })
      void winners.reload(true)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
      setDrawing(null)
    }
  }

  async function confirmVoid() {
    if (!voiding?.id) return
    setBusy(true)
    try {
      await adminApi.voidWinner(voiding.id)
      toast('Winner voided — you can draw this prize again')
      setVoiding(null)
      void winners.reload(true)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportPool() {
    downloadFile(
      `brain-battle-draw-pool-day${effectiveDay}.csv`,
      toCsv(['name', 'email', 'phone', 'university', 'department', 'score', 'max_score', 'submitted_at', 'won'],
        poolRows.map((p) => {
          const w = winners.data?.find((x) => x.attemptId === p.attemptId)
          return [p.name, p.email, p.phone ?? '', p.university, p.department, p.score, p.maxScore, p.submittedAt, w ? (prizes[w.position - 1]?.place || `Prize ${w.position}`) : '']
        })),
    )
  }

  return (
    <>
      <PageHeader
        title="Lucky draw"
        description="Everyone with the day's highest score is in the pool. The server picks winners at random."
        actions={
          <>
            <LinkButton to={`/leaderboard?day=${effectiveDay}`} external variant="secondary" size="sm" icon={<ExternalLink className="size-4" />}>Booth screen</LinkButton>
            <Button variant="secondary" size="sm" icon={<Download className="size-4" />} disabled={!poolRows.length} onClick={exportPool}>Export pool</Button>
          </>
        }
      />

      <div className="mb-5 flex rounded-xl border border-line bg-surface p-1 sm:w-fit">
        {([1, 2] as EventDay[]).map((d) => (
          <button key={d} onClick={() => setDay(d)} className={cn('flex-1 rounded-lg px-5 py-2 text-sm font-semibold transition sm:flex-none', effectiveDay === d ? 'bg-surface-3 text-fg' : 'text-faint hover:text-muted')}>
            Day {d}{settings.data?.activeDay === d ? ' · today' : ''}
          </button>
        ))}
      </div>

      <Alert tone="info" className="mb-6" title="Draw after the quiz closes for the day">
        The pool changes whenever someone beats the top score. Turn off “Quiz live” on the Dashboard first, then draw.
        Winners appear on the booth screen instantly.
      </Alert>

      {/* Prizes */}
      <div className={cn('grid grid-cols-1 gap-4', positions >= 3 ? 'md:grid-cols-3' : positions === 2 ? 'md:grid-cols-2' : '')}>
        {Array.from({ length: positions }).map((_, i) => {
          const pos = i + 1
          const prize = prizes[i]
          const w = winnerAt(pos)
          const c = w && contact(w.attemptId)
          return (
            <Card key={pos} className={cn('flex min-w-0 flex-col p-5', w && 'border-accent/40')}>
              <div className="flex items-center gap-3">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', w ? 'bg-gradient-accent text-on-accent' : 'bg-surface-2 text-accent')}>
                  {pos === 1 ? <Trophy className="size-5" /> : <Gift className="size-5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">{prize?.place || `Prize ${pos}`}</p>
                  <p className="truncate text-sm text-muted">{prize?.title || 'Prize'}</p>
                </div>
              </div>
              {winners.loading && !winners.data ? (
                <Skeleton className="mt-4 h-16" />
              ) : w ? (
                <div className="mt-4 flex-1">
                  <p className="font-headline truncate text-xl text-fg">{w.name}</p>
                  <p className="truncate text-xs text-faint">{w.department} · {w.university}</p>
                  {c && <p className="mt-2 truncate text-sm text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>}
                  <p className="mt-1 text-xs text-faint">Drawn {formatDateTime(w.drawnAt)}</p>
                  <Button variant="ghost" size="sm" className="mt-3 -ml-2" icon={<RotateCcw className="size-4" />} onClick={() => setVoiding(w)}>Void & redraw</Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-1 flex-col justify-end">
                  <p className="mb-3 text-sm text-faint">Not drawn yet</p>
                  <Button block icon={<Dices className="size-4.5" />} loading={busy && drawing?.position === pos} disabled={busy || remaining === 0} onClick={() => void draw(pos)}>
                    Draw winner
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Pool */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="flex items-center gap-2 font-semibold text-fg"><Ticket className="size-4.5 text-accent" /> Day {effectiveDay} pool</h2>
          {poolRows.length > 0 && (
            <p className="text-sm text-muted">
              <span className="font-semibold text-fg">{poolRows.length}</span> player{poolRows.length === 1 ? '' : 's'} on the top score of{' '}
              <span className="font-semibold text-fg">{formatScore(poolRows[0].score)}/{formatScore(poolRows[0].maxScore)}</span>
            </p>
          )}
        </div>
        {pool.loading && !pool.data ? (
          <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : pool.error ? (
          <ErrorState message={pool.error} onRetry={() => pool.reload()} />
        ) : poolRows.length === 0 ? (
          <EmptyState icon={<Users />} title="The pool is empty" description={`No one has completed the quiz on Day ${effectiveDay} yet.`} />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Contact</th>
                  <th className="px-3 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {poolRows.map((p: AdminPoolEntry) => {
                  const w = winners.data?.find((x) => x.attemptId === p.attemptId)
                  return (
                    <tr key={p.attemptId} className={cn(w && 'bg-accent/6')}>
                      <td className="px-5 py-3 font-medium text-fg">
                        {p.name}
                        {w && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">{prizes[w.position - 1]?.place || `Prize ${w.position}`}</span>}
                      </td>
                      <td className="px-3 py-3 text-muted">{p.email}{p.phone ? <span className="block text-xs text-faint">{p.phone}</span> : null}</td>
                      <td className="max-w-56 truncate px-3 py-3 text-muted">{p.department}</td>
                      <td className="px-5 py-3 text-xs text-muted">{formatDateTime(p.submittedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-4 flex items-start gap-2 text-xs text-faint">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Disqualified attempts are excluded from the pool (Admin → Results). Voided winners are kept in the database for the record.
      </p>

      <Dialog
        open={!!voiding}
        onClose={() => setVoiding(null)}
        size="sm"
        locked={busy}
        title="Void this winner?"
        footer={<><Button variant="secondary" onClick={() => setVoiding(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={confirmVoid}>Void winner</Button></>}
      >
        <p className="text-sm text-muted">
          <span className="font-semibold text-fg">{voiding?.name}</span> will be removed as the {prizes[(voiding?.position ?? 1) - 1]?.place || 'prize'} winner,
          and you can draw this prize again. The voided draw stays on record. Use this only if the winner is absent or ineligible.
        </p>
      </Dialog>

      <AnimatePresence>{reveal && <DrawReveal {...reveal} onClose={() => setReveal(null)} />}</AnimatePresence>
    </>
  )
}

/** Full-screen reveal: shuffles pool names, then lands on the server-chosen winner. */
function DrawReveal({ winner, prize, names, onClose }: { winner: DrawWinner; prize?: Prize; names: string[]; onClose: () => void }) {
  const [shown, setShown] = useState(names[0] ?? winner.name)
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const pool = names.length > 1 ? names : [winner.name]
    let step = 0
    const total = 28
    const tick = () => {
      step++
      if (step >= total) {
        setShown(winner.name)
        setDone(true)
        return
      }
      setShown(pool[Math.floor(Math.random() * pool.length)])
      timer.current = setTimeout(tick, 45 + step * step * 0.55) // decelerate
    }
    timer.current = setTimeout(tick, 60)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [names, winner.name])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-bg/95 px-6 backdrop-blur-xl">
      <div className="absolute left-1/2 top-1/3 h-72 w-[80%] -translate-x-1/2 rounded-full bg-gradient-accent opacity-20 blur-3xl" />
      <div className="relative w-full max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">{prize?.place || `Prize ${winner.position}`}{prize?.title ? ` · ${prize.title}` : ''}</p>
        <div className="mt-8 flex min-h-[8rem] items-center justify-center sm:min-h-[10rem]">
          <motion.p
            key={done ? 'winner' : shown}
            initial={done ? { scale: 0.6, opacity: 0 } : { opacity: 0.4, y: 6 }}
            animate={done ? { scale: 1, opacity: 1 } : { opacity: 1, y: 0 }}
            transition={done ? { type: 'spring', stiffness: 200, damping: 14 } : { duration: 0.05 }}
            className={cn('font-headline break-words text-4xl sm:text-7xl', done ? 'text-gradient' : 'text-muted')}
          >
            {shown}
          </motion.p>
        </div>
        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <p className="text-lg text-muted">{winner.department} · {winner.university}</p>
              <p className="mt-6 inline-flex items-center gap-2 text-2xl font-semibold text-fg"><PartyPopper className="size-7 text-accent" /> Congratulations!</p>
              <div className="mt-10">
                <Button size="lg" onClick={onClose}>Done</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
