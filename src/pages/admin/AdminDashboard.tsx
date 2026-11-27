import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Activity, ArrowRight, Award, CheckCircle2, Flag, Gauge, RefreshCw, UserPlus, Users } from 'lucide-react'
import { adminApi, errorMessage } from '@/services'
import { useAsync, useInterval, useTitle } from '@/hooks/misc'
import { useConfig } from '@/hooks/useConfig'
import { formatDuration, formatScore, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Switch } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import type { EventSettings } from '@/types'

export default function AdminDashboard() {
  useTitle('Admin dashboard')
  const toast = useToast()
  const { reload: reloadPublicConfig } = useConfig()
  const stats = useAsync(() => adminApi.getStats())
  const recent = useAsync(async () => (await adminApi.listParticipants()).slice(0, 8))
  const settings = useAsync(() => adminApi.getSettings())

  useInterval(() => { void stats.reload(true); void recent.reload(true) }, 15000, { pauseHidden: true })

  async function patch(p: Partial<EventSettings>, msg: string) {
    const prev = settings.data
    if (prev) settings.setData({ ...prev, ...p })
    try {
      settings.setData(await adminApi.updateSettings(p))
      toast(msg)
      void reloadPublicConfig()
    } catch (e) {
      settings.setData(prev)
      toast(errorMessage(e), 'error')
    }
  }

  const s = stats.data
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of Brain Battle. Refreshes every 15 seconds."
        actions={<Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => { void stats.reload(); void recent.reload() }}>Refresh</Button>}
      />

      {stats.error && !s ? (
        <Card><ErrorState message={stats.error} onRetry={() => stats.reload()} /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Users />} label="Total registrations" value={s?.totalRegistrations} sub="Whole campaign" />
          <StatCard icon={<CheckCircle2 />} label="Completed quizzes" value={s?.totalCompleted} sub={s && `${s.inProgress} in progress now`} />
          <StatCard icon={<Gauge />} label="Average score" value={s ? (s.averageScore == null ? '—' : formatScore(Math.round(s.averageScore * 100) / 100)) : undefined} sub={s?.maxScore != null ? `out of ${formatScore(s.maxScore)}` : 'No finishers yet'} />
          <StatCard icon={<Award />} label="Highest score" value={s ? (s.highestScore == null ? '—' : formatScore(s.highestScore)) : undefined} sub={s && s.flagged > 0 ? `${s.flagged} attempt(s) flagged for review` : 'No flags'} warn={Boolean(s && s.flagged > 0)} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Event controls */}
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Activity className="size-4.5 text-accent" />
            <h2 className="font-semibold text-fg">Event controls</h2>
          </div>
          {settings.loading && !settings.data ? (
            <div className="mt-6 space-y-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-16" /></div>
          ) : settings.error ? (
            <ErrorState message={settings.error} onRetry={() => settings.reload()} />
          ) : settings.data && (
            <div className="mt-6 space-y-6">
              <Switch
                label="Quiz live"
                description="Participants can start new attempts."
                checked={settings.data.quizEnabled}
                onChange={(v) => void patch({ quizEnabled: v }, v ? 'Quiz is now live' : 'Quiz closed for new attempts')}
              />
              <Switch
                label="Registration open"
                description="New participants can sign up."
                checked={settings.data.registrationEnabled}
                onChange={(v) => void patch({ registrationEnabled: v }, v ? 'Registration opened' : 'Registration closed')}
              />
              <CampaignCard start={settings.data.campaignStart} end={settings.data.campaignEnd} results={settings.data.resultsDate} />
            </div>
          )}
        </Card>

        {/* Recent participants */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4.5 text-accent" />
              <h2 className="font-semibold text-fg">Recent participants</h2>
            </div>
            <Link to="/admin/participants" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          {recent.loading && !recent.data ? (
            <div className="space-y-2 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : recent.error ? (
            <ErrorState message={recent.error} onRetry={() => recent.reload()} />
          ) : recent.data && recent.data.length === 0 ? (
            <EmptyState icon={<Users />} title="No participants yet" description="Registrations will appear here in real time." />
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recent.data?.map((p, i) => (
                <motion.li key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{p.fullName}</p>
                    <p className="truncate text-xs text-faint">{p.department} · {timeAgo(p.createdAt)}</p>
                  </div>
                  {p.attempt?.status === 'submitted' ? (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-fg tabular">{formatScore(p.attempt.score)}/{formatScore(p.attempt.maxScore)}</p>
                      <p className="text-[11px] text-faint">{formatDuration(p.attempt.durationMs)}</p>
                    </div>
                  ) : p.attempt ? (
                    <Badge tone="warning">In progress</Badge>
                  ) : (
                    <Badge>Registered</Badge>
                  )}
                  {p.attempt?.flagged && !p.attempt.disqualified && <Flag className="size-4 text-warning" aria-label="Flagged" />}
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function CampaignCard({ start, end, results }: { start: string; end: string; results: string }) {
  const now = Date.now()
  const status = now < Date.parse(start) ? 'upcoming' : now > Date.parse(end) ? 'ended' : 'live'
  const days = Math.max(0, Math.ceil((Date.parse(status === 'upcoming' ? start : end) - now) / 86_400_000))
  const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  return (
    <div className={cn('rounded-xl border p-4', status === 'live' ? 'border-success/40 bg-success/8' : 'border-line')}>
      <p className="text-sm font-medium text-fg">
        Campaign {status === 'live' ? 'is live' : status === 'upcoming' ? 'starts soon' : 'has ended'}
        {status !== 'ended' && <span className="text-muted"> · {days} day{days === 1 ? '' : 's'} {status === 'live' ? 'left' : 'to go'}</span>}
      </p>
      <p className="mt-1 text-[0.8125rem] text-muted">{fmt(start)} → {fmt(end)} · results {results}</p>
      <p className="mt-1 text-xs text-faint">The quiz opens and closes automatically. Change dates in Settings.</p>
    </div>
  )
}

function StatCard({ icon, label, value, sub, warn }: { icon: ReactNode; label: string; value: ReactNode | undefined; sub?: ReactNode; warn?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-accent [&>svg]:size-4.5">{icon}</span>
      </div>
      <p className="font-headline mt-4 text-3xl text-fg tabular">{value === undefined ? <Skeleton className="h-8 w-16" /> : value}</p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
      {sub && <p className={cn('mt-2 text-[11px]', warn ? 'text-warning' : 'text-faint')}>{sub}</p>}
    </Card>
  )
}
