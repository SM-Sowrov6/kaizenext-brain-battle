import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  AlarmClock, BellOff, CheckCircle2, Clock3, Copy, Hourglass, Keyboard, ListChecks, MinusCircle, MonitorX, Play, RotateCcw, ShieldAlert, ShieldCheck, Target, Wifi,
} from 'lucide-react'
import { api, toAppError } from '@/services'
import { useConfig } from '@/hooks/useConfig'
import { useSession } from '@/hooks/useSession'
import { useInterval, useTitle } from '@/hooks/misc'
import { formatScore } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card, LiveDot } from '@/components/ui/Card'
import { Alert, ErrorState, PageLoader } from '@/components/ui/Feedback'
import { FlowSteps } from '@/components/quiz/FlowSteps'
import type { SessionInfo } from '@/types'

export default function InstructionsPage() {
  useTitle('Instructions')
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const { config, reload: reloadConfig } = useConfig()
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!session) return
    setError(null)
    try {
      const s = await api.getSession(session.token)
      if (s.attemptStatus === 'submitted') return navigate('/result', { replace: true })
      setInfo(s)
    } catch (err) {
      const e = toAppError(err)
      if (e.code === 'INVALID_SESSION') {
        setSession(null)
        navigate('/register', { replace: true })
        return
      }
      setError(e.isNetwork ? 'Connection problem — please check your internet.' : e.message)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  const quizOpen = Boolean(config?.event.quizEnabled)
  // While waiting for the admin to open the quiz, quietly re-check.
  useInterval(() => void reloadConfig(), quizOpen ? null : 8000, { pauseHidden: true })

  if (!session) return <Navigate to="/register" replace />
  if (error) return <div className="mx-auto max-w-xl px-4 py-16"><Card><ErrorState message={error} onRetry={load} /></Card></div>
  if (!info || !config) return <PageLoader label="Preparing your challenge…" />

  const q = config.quiz
  const resuming = info.attemptStatus === 'in_progress'

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:pt-10">
      <FlowSteps current={1} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="mt-10">
        <div className="text-center">
          <p className="text-sm text-muted">Welcome, <span className="font-semibold text-fg">{info.participant.fullName}</span></p>
          <h1 className="font-headline mt-2 text-3xl text-fg sm:text-4xl">Before you begin</h1>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<ListChecks />} value={String(q.questionCount)} label="Questions" />
          <Stat icon={<Clock3 />} value={`${formatScore(q.durationSeconds / 60)} min`} label="Total time" />
          <Stat icon={<Target />} value={formatScore(q.marksPerQuestion)} label={q.marksPerQuestion === 1 ? 'Mark each' : 'Marks each'} />
          <Stat
            icon={<MinusCircle />}
            value={q.negativeMarking ? `−${formatScore(q.negativeMark)}` : 'None'}
            label="Negative marking"
            tone={q.negativeMarking ? 'warning' : 'success'}
          />
        </div>

        <Card className="mt-4 p-6 sm:p-8">
          <h2 className="font-headline text-lg text-fg">Competition rules</h2>
          <ol className="mt-5 space-y-3.5">
            {config.event.rules.map((r, i) => (
              <li key={r} className="flex gap-3.5 text-sm leading-relaxed text-muted">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2 font-mono text-[11px] font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="pt-0.5">{r}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7 grid gap-3 border-t border-line pt-6 sm:grid-cols-3">
            <Tip icon={<Wifi />} title="Auto-saved">Answers sync as you go, even on a weak connection.</Tip>
            <Tip icon={<Keyboard />} title="Shortcuts">Keys 1–4 or A–D to answer, ← → to move.</Tip>
            <Tip icon={<ShieldCheck />} title="Fair play">Scores are calculated on the server only.</Tip>
          </div>
        </Card>

        <Card className="mt-4 border-danger/35 p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-headline text-lg text-fg">
            <ShieldAlert className="size-5 text-danger" /> Anti-cheat is on during the quiz
          </h2>
          <p className="mt-2 text-sm text-muted">
            Once you press Start, stay on the quiz screen until you submit.{' '}
            {(q.maxViolations ?? 2) <= 1 ? (
              <>Breaking a rule ends your quiz immediately and you are <span className="font-semibold text-danger">disqualified</span>.</>
            ) : (
              <>
                You get {(q.maxViolations ?? 2) - 1 === 1 ? 'one warning' : `${(q.maxViolations ?? 2) - 1} warnings`}; after that your quiz ends immediately
                and you are <span className="font-semibold text-danger">disqualified</span>.
              </>
            )}
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            <AcRule icon={<MonitorX />}>Don't switch apps or tabs, open ChatGPT, or go to the home screen</AcRule>
            <AcRule icon={<RotateCcw />}>Don't refresh, close or leave the page</AcRule>
            <AcRule icon={<Copy />}>Copy and paste are blocked and count as a violation</AcRule>
            <AcRule icon={<BellOff />}>Turn on Do Not Disturb, since calls and alerts can pull you out</AcRule>
          </ul>
        </Card>

        <div className="mt-6">
          {resuming ? (
            <Alert tone="warning" title="Your quiz is already running" className="mb-4">
              The timer kept counting while you were away. Jump back in now to make the most of your remaining time.
            </Alert>
          ) : !quizOpen ? (
            <Alert tone="info" title="The quiz opens soon" className="mb-4">
              <span className="inline-flex items-center gap-2">
                <LiveDot tone="accent" /> This page will unlock automatically the moment the quiz goes live.
              </span>
            </Alert>
          ) : (
            <p className="mb-4 flex items-center justify-center gap-2 text-center text-sm text-muted">
              <AlarmClock className="size-4 text-accent" /> The timer starts the moment you press Start.
            </p>
          )}
          <Button
            size="xl"
            block
            disabled={!resuming && !quizOpen}
            onClick={() => navigate('/quiz')}
            icon={resuming ? <RotateCcw className="size-5" /> : quizOpen ? <Play className="size-5 fill-current" /> : <Hourglass className="size-5" />}
          >
            {resuming ? 'Resume quiz' : quizOpen ? 'Start Quiz' : 'Waiting for the quiz to open'}
          </Button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-faint">
            <CheckCircle2 className="size-3.5 text-success" /> Registered for Day {info.participant.eventDay} · {info.participant.university}
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function Stat({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone?: 'success' | 'warning' }) {
  return (
    <Card className="p-4 text-center sm:p-5">
      <span className={`mx-auto grid size-9 place-items-center rounded-xl bg-surface-2 [&>svg]:size-4.5 ${tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-accent'}`}>
        {icon}
      </span>
      <p className="font-headline mt-3 text-xl text-fg sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-faint">{label}</p>
    </Card>
  )
}

function AcRule({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-line bg-bg-soft/60 p-3 text-sm text-fg">
      <span className="mt-0.5 shrink-0 text-danger [&>svg]:size-4.5">{icon}</span>
      <span>{children}</span>
    </li>
  )
}

function Tip({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-accent [&>svg]:size-4.5">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  )
}
