import { useMemo, useState } from 'react'
import { Check, Download, Flag, Search, Trash2, Users, X } from 'lucide-react'
import { adminApi, errorMessage } from '@/services'
import { useAsync, useTitle } from '@/hooks/misc'
import { downloadFile, toCsv } from '@/lib/csv'
import { formatDateTime, formatDuration, formatScore } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/Feedback'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import type { AdminParticipant } from '@/types'

type Status = 'all' | 'submitted' | 'in_progress' | 'registered'

function status(p: AdminParticipant): Exclude<Status, 'all'> {
  return p.attempt ? p.attempt.status : 'registered'
}

export function exportParticipantsCsv(list: AdminParticipant[], filename = 'brain-battle-participants.csv') {
  const rows = list.map((p) => [
    p.fullName, p.email, p.phone ?? '', p.university, p.department, `Day ${p.eventDay}`, p.createdAt,
    status(p), p.attempt?.score ?? '', p.attempt?.maxScore ?? '', p.attempt?.correct ?? '', p.attempt?.incorrect ?? '',
    p.attempt?.unanswered ?? '', p.attempt?.durationMs != null ? (p.attempt.durationMs / 1000).toFixed(1) : '',
    p.attempt?.submittedAt ?? '', p.attempt ? `Day ${p.attempt.eventDay}` : '', p.attempt?.flagged ? 'yes' : 'no',
    p.attempt?.disqualified ? 'yes' : 'no',
  ])
  downloadFile(filename, toCsv(
    ['name', 'email', 'phone', 'university', 'department', 'registered_day', 'registered_at', 'status', 'score', 'max_score',
      'correct', 'incorrect', 'unanswered', 'time_seconds', 'submitted_at', 'played_day', 'flagged', 'disqualified'],
    rows,
  ))
}

export default function AdminParticipants() {
  useTitle('Participants')
  const toast = useToast()
  const list = useAsync(() => adminApi.listParticipants())
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const [day, setDay] = useState('all')
  const [st, setSt] = useState<Status>('all')
  const [selected, setSelected] = useState<AdminParticipant | null>(null)

  const departments = useMemo(() => Array.from(new Set((list.data ?? []).map((p) => p.department))).sort(), [list.data])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list.data ?? []).filter(
      (p) =>
        (!s || p.fullName.toLowerCase().includes(s) || p.email.toLowerCase().includes(s)) &&
        (dept === 'all' || p.department === dept) &&
        (day === 'all' || String(p.eventDay) === day) &&
        (st === 'all' || status(p) === st),
    )
  }, [list.data, q, dept, day, st])

  return (
    <>
      <PageHeader
        title="Participants"
        description={`${list.data?.length ?? 0} registered`}
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="size-4" />} disabled={!rows.length}
            onClick={() => { exportParticipantsCsv(rows); toast(`Exported ${rows.length} rows`) }}>
            Export CSV{rows.length !== (list.data?.length ?? 0) ? ` (${rows.length})` : ''}
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <Input icon={<Search />} placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
        <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
          <option value="all">Both days</option><option value="1">Day 1</option><option value="2">Day 2</option>
        </Select>
        <Select value={st} onChange={(e) => setSt(e.target.value as Status)} aria-label="Status">
          <option value="all">Any status</option><option value="submitted">Completed</option>
          <option value="in_progress">In progress</option><option value="registered">Not started</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {list.loading && !list.data ? (
          <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={() => list.reload()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users />} title={list.data?.length ? 'No matches' : 'No participants yet'} description={list.data?.length ? 'Adjust the search or filters.' : 'Participants appear here as soon as they register.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 font-medium">Participant</th>
                  <th className="px-3 py-3 font-medium">Department</th>
                  <th className="px-3 py-3 font-medium">Day</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Score</th>
                  <th className="px-5 py-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} onClick={() => setSelected(p)} className="cursor-pointer transition hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-fg">{p.fullName}</p>
                      <p className="text-xs text-faint">{p.email}</p>
                    </td>
                    <td className="max-w-48 truncate px-3 py-3 text-muted">{p.department}</td>
                    <td className="px-3 py-3 text-muted">{p.eventDay}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5">
                        {status(p) === 'submitted' ? <Badge tone="success">Completed</Badge> : status(p) === 'in_progress' ? <Badge tone="warning">In progress</Badge> : <Badge>Not started</Badge>}
                        {p.attempt?.disqualified && <Badge tone="danger">DQ</Badge>}
                        {p.attempt?.flagged && !p.attempt.disqualified && <Flag className="size-3.5 text-warning" />}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-fg tabular">{p.attempt?.score != null ? `${formatScore(p.attempt.score)}/${formatScore(p.attempt.maxScore)}` : '—'}</td>
                    <td className="px-5 py-3 text-right text-muted tabular">{formatDuration(p.attempt?.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ParticipantDrawer p={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); void list.reload(true) }} />
    </>
  )
}

export function ParticipantDrawer({ p, onClose, onChanged }: { p: AdminParticipant | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const answers = useAsync(async () => (p?.attempt ? adminApi.getAttemptAnswers(p.attempt.id) : []), [p?.attempt?.id])

  async function remove() {
    if (!p) return
    setBusy(true)
    try {
      await adminApi.deleteParticipant(p.id)
      toast('Participant deleted — they can register again')
      setConfirmDelete(false)
      onChanged()
    } catch (e) { toast(errorMessage(e), 'error') } finally { setBusy(false) }
  }

  async function toggleDq() {
    if (!p?.attempt) return
    setBusy(true)
    try {
      await adminApi.setDisqualified(p.attempt.id, !p.attempt.disqualified)
      toast(p.attempt.disqualified ? 'Attempt reinstated' : 'Attempt disqualified')
      onChanged()
    } catch (e) { toast(errorMessage(e), 'error') } finally { setBusy(false) }
  }

  const a = p?.attempt
  return (
    <>
      <Dialog open={!!p} onClose={onClose} drawer title={p?.fullName} description={p ? `${p.email}${p.phone ? ` · ${p.phone}` : ''}` : undefined}>
        {p && (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['University', p.university], ['Department', p.department], ['Registered', formatDateTime(p.createdAt)], ['Registered day', `Day ${p.eventDay}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-bg-soft/60 p-3"><dt className="text-xs text-faint">{k}</dt><dd className="mt-0.5 text-fg">{v}</dd></div>
              ))}
            </dl>
            {a ? (
              <>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['Score', a.score != null ? `${formatScore(a.score)}/${formatScore(a.maxScore)}` : '—'], ['Correct', a.correct ?? '—'], ['Wrong', a.incorrect ?? '—'], ['Time', formatDuration(a.durationMs)]].map(([k, v]) => (
                    <div key={String(k)} className="rounded-xl border border-line p-3"><p className="font-headline text-lg text-fg">{v}</p><p className="text-[11px] text-faint">{k}</p></div>
                  ))}
                </div>
                <p className="text-xs text-faint">Played Day {a.eventDay} · started {formatDateTime(a.startedAt)} · {a.submittedAt ? `submitted ${formatDateTime(a.submittedAt)} (${a.submitReason})` : 'in progress'}</p>
                {a.flagged && (
                  <div className="rounded-xl border border-warning/30 bg-warning/8 p-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold text-warning"><Flag className="size-4" /> Flagged for review</p>
                    <ul className="mt-1 list-disc pl-6 text-muted">{a.flagReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-fg">Answers</h3>
                  {answers.loading ? <Spinner className="mt-3" label="Loading answers…" /> : answers.error ? <p className="mt-2 text-sm text-danger">{answers.error}</p> : (
                    <ol className="mt-3 space-y-2">
                      {answers.data?.map((x, i) => {
                        const sel = x.options.find((o) => o.id === x.selectedOptionId)
                        const correct = x.options.find((o) => o.isCorrect)
                        return (
                          <li key={x.questionId} className="rounded-xl border border-line p-3 text-sm">
                            <p className="text-fg"><span className="font-mono text-xs text-faint">Q{i + 1}</span> {x.prompt}</p>
                            <p className={cn('mt-1.5 flex items-center gap-1.5 text-xs', x.isCorrect ? 'text-success' : sel ? 'text-danger' : 'text-faint')}>
                              {x.isCorrect ? <Check className="size-3.5" /> : sel ? <X className="size-3.5" /> : null}
                              {sel ? sel.text : 'Not answered'}
                            </p>
                            {!x.isCorrect && correct && <p className="mt-0.5 text-xs text-muted">Correct: {correct.text}</p>}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-line p-4 text-sm text-muted">This participant hasn’t started the quiz yet.</p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line pt-5">
              {a?.status === 'submitted' && (
                <Button variant={a.disqualified ? 'secondary' : 'danger'} size="sm" loading={busy} onClick={toggleDq}>{a.disqualified ? 'Reinstate attempt' : 'Disqualify attempt'}</Button>
              )}
              <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>Delete participant</Button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} size="sm" title="Delete participant?" locked={busy}
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={remove}>Delete permanently</Button></>}>
        <p className="text-sm text-muted">This removes {p?.fullName}’s registration, attempt and answers. They will be able to register again with the same email. This cannot be undone.</p>
      </Dialog>
    </>
  )
}
