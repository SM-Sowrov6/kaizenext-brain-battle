import { useMemo, useState } from 'react'
import { AlertTriangle, Download, ExternalLink, Flag, RotateCcw, Trophy } from 'lucide-react'
import { adminApi, errorMessage } from '@/services'
import { useAsync, useInterval, useTitle } from '@/hooks/misc'
import { formatDateTime, formatDuration, formatScore } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/layouts/AdminLayout'
import { Button, LinkButton } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import type { AdminParticipant, DayScope } from '@/types'
import { ParticipantDrawer, exportParticipantsCsv } from './AdminParticipants'

export default function AdminLeaderboard() {
  useTitle('Leaderboard management')
  const toast = useToast()
  const list = useAsync(() => adminApi.listParticipants())
  const [scope, setScope] = useState<DayScope>('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [selected, setSelected] = useState<AdminParticipant | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)

  useInterval(() => void list.reload(true), 15000, { pauseHidden: true })

  // Same ordering as the server: score ↓, time ↑, submitted ↑ (disqualified listed last, unranked)
  const ranked = useMemo(() => {
    const done = (list.data ?? []).filter((p) => p.attempt?.status === 'submitted' && (scope === 'all' || p.attempt.eventDay === scope))
    done.sort((x, y) => {
      const a = x.attempt!, b = y.attempt!
      if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1
      return (b.score! - a.score!) || (a.durationMs! - b.durationMs!) || a.submittedAt!.localeCompare(b.submittedAt!)
    })
    let r = 0
    return done.map((p) => ({ p, rank: p.attempt!.disqualified ? null : ++r })).filter((x) => !flaggedOnly || x.p.attempt!.flagged)
  }, [list.data, scope, flaggedOnly])

  const flaggedCount = (list.data ?? []).filter((p) => p.attempt?.flagged && !p.attempt.disqualified).length

  async function reset() {
    setResetting(true)
    try {
      const n = await adminApi.resetData(confirmText)
      toast(`Reset complete — ${n} participant record(s) removed`)
      setResetOpen(false)
      setConfirmText('')
      void list.reload()
    } catch (e) { toast(errorMessage(e), 'error') } finally { setResetting(false) }
  }

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Full rankings with integrity review. Disqualified attempts are removed from public boards."
        actions={
          <>
            <LinkButton to="/leaderboard" external variant="secondary" size="sm" icon={<ExternalLink className="size-4" />}>Booth display</LinkButton>
            <Button variant="secondary" size="sm" icon={<Download className="size-4" />} disabled={!ranked.length}
              onClick={() => exportParticipantsCsv(ranked.map((x) => x.p), `brain-battle-results-${scope === 'all' ? 'overall' : `day${scope}`}.csv`)}>
              Export results
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {(['all', 1, 2] as DayScope[]).map((s) => (
            <button key={String(s)} onClick={() => setScope(s)} className={cn('rounded-lg px-3.5 py-1.5 text-xs font-semibold transition', scope === s ? 'bg-surface-3 text-fg' : 'text-faint hover:text-muted')}>
              {s === 'all' ? 'Overall' : `Day ${s}`}
            </button>
          ))}
        </div>
        <button onClick={() => setFlaggedOnly((v) => !v)} className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition', flaggedOnly ? 'border-warning/50 bg-warning/10 text-warning' : 'border-line text-muted hover:text-fg')}>
          <Flag className="size-3.5" /> Suspicious only {flaggedCount > 0 && <span className="rounded-full bg-warning px-1.5 text-[10px] text-black">{flaggedCount}</span>}
        </button>
      </div>

      <Card className="overflow-hidden">
        {list.loading && !list.data ? (
          <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={() => list.reload()} />
        ) : ranked.length === 0 ? (
          <EmptyState icon={<Trophy />} title={flaggedOnly ? 'No suspicious attempts' : 'No completed attempts yet'} description={flaggedOnly ? 'Nothing needs review right now.' : 'Rankings appear here once participants submit.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="w-16 px-5 py-3 font-medium">Rank</th>
                  <th className="px-3 py-3 font-medium">Participant</th>
                  <th className="px-3 py-3 text-right font-medium">Score</th>
                  <th className="px-3 py-3 text-right font-medium">Time</th>
                  <th className="px-3 py-3 font-medium">Submitted</th>
                  <th className="px-5 py-3 font-medium">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ranked.map(({ p, rank }) => (
                  <tr key={p.id} onClick={() => setSelected(p)} className={cn('cursor-pointer transition hover:bg-surface-2/60', p.attempt!.disqualified && 'opacity-50')}>
                    <td className="px-5 py-3 font-headline text-lg text-fg">{rank ?? '—'}</td>
                    <td className="px-3 py-3"><p className="font-medium text-fg">{p.fullName}</p><p className="text-xs text-faint">{p.email} · {p.department}</p></td>
                    <td className="px-3 py-3 text-right font-semibold text-fg tabular">{formatScore(p.attempt!.score)}/{formatScore(p.attempt!.maxScore)}</td>
                    <td className="px-3 py-3 text-right text-muted tabular">{formatDuration(p.attempt!.durationMs)}</td>
                    <td className="px-3 py-3 text-xs text-muted">{formatDateTime(p.attempt!.submittedAt)} · D{p.attempt!.eventDay}</td>
                    <td className="px-5 py-3">
                      {p.attempt!.disqualified ? <Badge tone="danger">Disqualified</Badge> : p.attempt!.flagged ? <Badge tone="warning" icon={<Flag className="size-3" />}>Review</Badge> : <span className="text-xs text-faint">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-8 border-danger/25 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-fg"><AlertTriangle className="size-4.5 text-danger" /> Reset test / demo data</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">Deletes all participants, attempts and answers. Questions and settings are kept. Use this after rehearsals — never during the live event.</p>
          </div>
          <Button variant="danger" icon={<RotateCcw className="size-4" />} onClick={() => setResetOpen(true)}>Reset data</Button>
        </div>
      </Card>

      <ParticipantDrawer p={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); void list.reload(true) }} />

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} size="sm" locked={resetting} title="Reset all participant data?"
        footer={<><Button variant="secondary" onClick={() => setResetOpen(false)}>Cancel</Button><Button variant="danger" disabled={confirmText !== 'RESET'} loading={resetting} onClick={reset}>Permanently reset</Button></>}>
        <p className="text-sm text-muted">This permanently deletes <strong className="text-fg">{list.data?.length ?? 0}</strong> participant(s) and all results. Export a CSV first if you need a record.</p>
        <Field label='Type "RESET" to confirm' htmlFor="reset-confirm" className="mt-5">
          <Input id="reset-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" placeholder="RESET" />
        </Field>
      </Dialog>
    </>
  )
}
