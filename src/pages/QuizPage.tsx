import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClockOff, ArrowLeft, ArrowRight, CheckCheck, Eraser, LayoutGrid, Send, ShieldAlert, ShieldCheck, WifiOff } from 'lucide-react'
import { api, toAppError, type AnswerMap } from '@/services'
import { useSession } from '@/hooks/useSession'
import { useOnline, useTitle } from '@/hooks/misc'
import { useAntiCheat } from '@/hooks/useAntiCheat'
import { KEYS, storage } from '@/lib/storage'
import { cn } from '@/lib/cn'
import { LogoMark } from '@/components/ui/Brand'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState, PageLoader } from '@/components/ui/Feedback'
import { AmbientBackground } from '@/layouts/PublicLayout'
import { OptionButton, QuestionGrid, SaveIndicator, SegmentedProgress, TimerPill, type SaveStatus } from '@/components/quiz/QuizParts'
import type { AttemptState, SubmitReason, ViolationKind, ViolationResponse } from '@/types'

type Phase = 'loading' | 'active' | 'submitting' | 'error'
interface LocalCache { answers: Record<string, string>; pending: AnswerMap }

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const VIOLATION_TEXT: Record<ViolationKind, string> = {
  tab_hidden: 'You left the quiz screen (switched app or tab, or locked the phone).',
  page_leave: 'You refreshed or left the quiz page.',
  window_blur: 'The quiz window lost focus (another window or app was opened).',
  copy: 'Copying is not allowed during the quiz.',
  cut: 'Copying is not allowed during the quiz.',
  paste: 'Pasting is not allowed during the quiz.',
  devtools: 'Developer tools are not allowed during the quiz.',
  print_screen: 'Screenshots are not allowed during the quiz.',
}
const ackKey = (attemptId: string) => `kbb.ack.${attemptId}`

/** Mark Bangla text so it gets Bangla-friendly typography (see :lang(bn) in index.css). */
const langOf = (text: string) => (/[ঀ-৿]/.test(text) ? 'bn' : undefined)

export default function QuizPage() {
  useTitle('Quiz in progress')
  const navigate = useNavigate()
  const online = useOnline()
  const { session, setSession } = useSession()

  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<AttemptState | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [remaining, setRemaining] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [strikes, setStrikes] = useState(0)
  const [maxStrikes, setMaxStrikes] = useState(2)
  const [warning, setWarning] = useState<{ kind: ViolationKind | null; strikes: number } | null>(null)

  const pending = useRef<AnswerMap>({})
  const inflight = useRef(false)
  const offset = useRef(0) // serverTime - clientTime
  const submitted = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const token = session?.token

  /* ── Load / resume ───────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!token) return
    setPhase('loading')
    setError(null)
    try {
      const res = await api.start(token)
      if (res.status === 'submitted') {
        navigate('/result', { replace: true })
        return
      }
      offset.current = Date.parse(res.serverNow) - Date.now()
      // Merge unsynced local answers (e.g. after a refresh while offline)
      const cache = storage.get<LocalCache | null>(KEYS.answers(res.attemptId), null)
      const merged = { ...res.answers }
      pending.current = {}
      if (cache?.pending) {
        for (const [qid, oid] of Object.entries(cache.pending)) {
          if (oid === null) delete merged[qid]
          else merged[qid] = oid
          pending.current[qid] = oid
        }
      }
      setAttempt(res)
      setAnswers(merged)
      setStrikes(res.strikes ?? 0)
      setMaxStrikes(res.maxStrikes ?? 2)
      if ((res.strikes ?? 0) > storage.get<number>(ackKey(res.attemptId), 0)) setWarning({ kind: 'page_leave', strikes: res.strikes })
      const firstUnanswered = res.questions.findIndex((q) => !merged[q.id])
      setIndex(firstUnanswered === -1 ? 0 : firstUnanswered)
      setRemaining((Date.parse(res.deadlineAt) - (Date.now() + offset.current)) / 1000)
      setPhase('active')
      if (Object.keys(pending.current).length) scheduleSave(0)
    } catch (err) {
      const e = toAppError(err)
      if (e.code === 'INVALID_SESSION') {
        setSession(null)
        navigate('/register', { replace: true })
        return
      }
      if (e.code === 'QUIZ_CLOSED' || e.code === 'QUIZ_NOT_READY') {
        navigate('/instructions', { replace: true })
        return
      }
      setError(e.isNetwork ? 'We couldn’t reach the server. Check your connection and try again.' : e.message)
      setPhase('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  /* ── Persistence & sync ──────────────────────────────────── */
  const persistLocal = useCallback((a: Record<string, string>) => {
    if (!attempt) return
    storage.set(KEYS.answers(attempt.attemptId), { answers: a, pending: pending.current } satisfies LocalCache)
  }, [attempt])

  const flush = useCallback(async () => {
    if (!attempt || !token || inflight.current || submitted.current) return
    const batch = { ...pending.current }
    if (Object.keys(batch).length === 0) return
    inflight.current = true
    setSaveStatus('saving')
    try {
      const r = await api.save(token, attempt.attemptId, batch)
      offset.current = Date.parse(r.serverNow) - Date.now()
      for (const [k, v] of Object.entries(batch)) if (pending.current[k] === v) delete pending.current[k]
      storage.set(KEYS.answers(attempt.attemptId), { answers: answersRef.current, pending: pending.current })
      setSaveStatus(Object.keys(pending.current).length ? 'saving' : 'saved')
      inflight.current = false
      if (Object.keys(pending.current).length) void flush()
    } catch (err) {
      inflight.current = false
      const e = toAppError(err)
      if (e.code === 'ATTEMPT_CLOSED') {
        submitted.current = true
        navigate('/result', { replace: true })
        return
      }
      setSaveStatus('offline')
      scheduleSave(e.isNetwork ? 3000 : 5000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, token])

  const flushRef = useRef(flush)
  flushRef.current = flush
  const answersRef = useRef(answers)
  answersRef.current = answers

  function scheduleSave(ms = 350) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flushRef.current(), ms)
  }

  useEffect(() => {
    if (online && Object.keys(pending.current).length) scheduleSave(200)
  }, [online])

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const choose = useCallback((qid: string, optionId: string | null) => {
    if (phase !== 'active' || submitted.current) return
    const next = { ...answersRef.current }
    if (optionId === null) delete next[qid]
    else next[qid] = optionId
    answersRef.current = next
    pending.current[qid] = optionId
    setAnswers(next)
    persistLocal(next)
    setSaveStatus('saving')
    scheduleSave()
  }, [phase, persistLocal])

  /* ── Submit ──────────────────────────────────────────────── */
  const submit = useCallback(async (reason: SubmitReason, kind?: ViolationKind) => {
    if (!attempt || !token || submitted.current) return
    submitted.current = true
    setConfirmOpen(false)
    setNavOpen(false)
    setPhase('submitting')
    setSubmitError(null)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const payload: AnswerMap = { ...answersRef.current }
    for (const [k, v] of Object.entries(pending.current)) if (v === null) payload[k] = null

    for (let i = 0; i < 6; i++) {
      try {
        const result = await api.submit(token, attempt.attemptId, payload, reason, kind)
        storage.remove(KEYS.answers(attempt.attemptId))
        storage.remove(ackKey(attempt.attemptId))
        navigate('/result', { replace: true, state: { result } })
        return
      } catch (err) {
        const e = toAppError(err)
        if (!e.isNetwork) {
          if (e.code === 'INVALID_SESSION') { setSession(null); navigate('/register', { replace: true }); return }
          // The server already closed this attempt (e.g. finalised after the deadline) — show the result.
          navigate('/result', { replace: true })
          return
        }
        setSubmitError('Connection lost — retrying. Your answers are safe on this device.')
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
      }
    }
    submitted.current = false
    setPhase('active')
    setSubmitError((m) => m ?? 'We could not submit your quiz. Please check your connection and try again.')
  }, [attempt, token, navigate, setSession])

  /* ── Timer ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!attempt || phase === 'loading' || phase === 'error') return
    const deadline = Date.parse(attempt.deadlineAt)
    const tick = () => {
      const left = (deadline - (Date.now() + offset.current)) / 1000
      setRemaining(left)
      if (left <= 0 && !submitted.current) {
        setTimeUp(true)
        void submit('timeout')
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [attempt, phase, submit])

  /* ── Anti-cheat ──────────────────────────────────────────── */
  const strikesRef = useRef(0)
  strikesRef.current = strikes

  const applyViolation = useCallback((res: ViolationResponse, kind: ViolationKind) => {
    if (!attempt) return
    setMaxStrikes(res.maxStrikes)
    if (res.out) {
      submitted.current = true
      storage.remove(KEYS.answers(attempt.attemptId))
      storage.remove(ackKey(attempt.attemptId))
      navigate('/result', { replace: true, state: res.result ? { result: res.result } : null })
      return
    }
    if (res.strikes > strikesRef.current) {
      setStrikes(res.strikes)
      setWarning({ kind, strikes: res.strikes })
    }
  }, [attempt, navigate])

  const reportViolation = useCallback((kind: ViolationKind, eventId: string) => {
    if (!attempt || !token || submitted.current) return
    api.violation(token, attempt.attemptId, kind, eventId)
      .then((res) => applyViolation(res, kind))
      .catch(() => {
        // Couldn't reach the server: enforce locally; the server is told on submit.
        const next = strikesRef.current + 1
        if (next >= maxStrikes) void submit('violation', kind)
        else { setStrikes(next); setWarning({ kind, strikes: next }) }
      })
  }, [attempt, token, applyViolation, maxStrikes, submit])

  const beaconViolation = useCallback((kind: ViolationKind, eventId: string) => {
    if (!attempt || !token || submitted.current) return
    api.beaconViolation(token, attempt.attemptId, kind, eventId)
  }, [attempt, token])

  useAntiCheat({ enabled: phase === 'active' && Boolean(attempt), report: reportViolation, beacon: beaconViolation })

  const acknowledgeWarning = () => {
    if (attempt && warning) storage.set(ackKey(attempt.attemptId), warning.strikes)
    setWarning(null)
  }

  /* ── Leave protection ────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'active') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase])

  /* ── Keyboard ────────────────────────────────────────────── */
  const questions = attempt?.questions ?? []
  const q = questions[index]
  const go = useCallback((i: number) => {
    if (i < 0 || i >= questions.length) return
    setDirection(i > index ? 1 : -1)
    setIndex(i)
    setNavOpen(false)
  }, [index, questions.length])

  useEffect(() => {
    if (phase !== 'active' || !q) return
    const onKey = (e: KeyboardEvent) => {
      if (confirmOpen || navOpen || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      const n = '1234'.indexOf(k) !== -1 ? Number(k) - 1 : 'abcd'.indexOf(k)
      if (n >= 0 && n < q.options.length) { e.preventDefault(); choose(q.id, q.options[n].id) }
      else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, q, index, confirmOpen, navOpen, choose, go])

  const answeredCount = useMemo(() => questions.filter((x) => answers[x.id]).length, [questions, answers])
  const isAnswered = useCallback((i: number) => Boolean(questions[i] && answers[questions[i].id]), [questions, answers])

  /* ── Render ──────────────────────────────────────────────── */
  if (!session) return <Navigate to="/register" replace />
  if (phase === 'loading') return <><AmbientBackground intensity={0.6} /><PageLoader label="Loading your questions…" /></>
  if (phase === 'error' || !attempt) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <AmbientBackground intensity={0.6} />
        <Card className="w-full max-w-md"><ErrorState title="Couldn’t load the quiz" message={error} onRetry={load} /></Card>
      </div>
    )
  }

  const last = index === questions.length - 1
  const unanswered = questions.map((x, i) => (answers[x.id] ? -1 : i)).filter((i) => i >= 0)

  return (
    <div className="relative flex min-h-dvh flex-col select-none [-webkit-touch-callout:none]">
      <AmbientBackground intensity={0.55} />

      {/* Top bar */}
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="size-8" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-fg">Question {index + 1} <span className="text-faint">/ {questions.length}</span></p>
              <p className={cn('flex items-center gap-1 text-xs', strikes > 0 ? 'text-danger' : 'text-faint')}>
                {strikes > 0 ? <ShieldAlert className="size-3.5" /> : <ShieldCheck className="size-3.5 text-success" />}
                {strikes > 0 ? `Warning ${strikes}/${maxStrikes - 1}` : 'Proctored'}
                <span className="hidden sm:inline">· {answeredCount} answered</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TimerPill remaining={remaining} total={attempt.durationSeconds} />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
          <SegmentedProgress total={questions.length} current={index} answered={isAnswered} onJump={go} />
        </div>
      </header>

      {!online && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs font-medium text-warning">
          <WifiOff className="mr-1.5 inline size-3.5" /> You’re offline. Keep answering — we’ll sync automatically when you reconnect.
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1fr_300px]">
        {/* Question */}
        <section className="min-w-0">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={q.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="p-5 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-lg bg-accent/12 px-2.5 py-1 font-mono text-xs font-semibold text-accent">
                    Q {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-medium text-faint">
                    {q.marks} mark{q.marks === 1 ? '' : 's'}
                    {attempt.negativeMarking && <span className="text-warning"> · −{attempt.negativeMark} if wrong</span>}
                  </span>
                </div>
                <h1 lang={langOf(q.prompt)} className="font-headline mt-5 text-xl leading-snug text-fg sm:text-[1.65rem]">{q.prompt}</h1>
                <div role="radiogroup" aria-label="Answer options" className="mt-7 space-y-3">
                  {q.options.map((o, i) => (
                    <OptionButton
                      key={o.id}
                      index={i}
                      letter={LETTERS[i]}
                      text={o.text}
                      selected={answers[q.id] === o.id}
                      onSelect={() => choose(q.id, o.id)}
                    />
                  ))}
                </div>
                <div className="mt-5 flex min-h-8 items-center justify-between gap-3">
                  <SaveIndicator status={saveStatus} />
                  {answers[q.id] && (
                    <button onClick={() => choose(q.id, null)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-faint transition hover:bg-surface-2 hover:text-muted">
                      <Eraser className="size-3.5" /> Clear answer
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>

          {submitError && phase === 'active' && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-fg">
              {submitError}
            </div>
          )}

          {/* Nav buttons */}
          <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-line bg-bg/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <Button variant="secondary" size="lg" className="w-13 shrink-0 px-0 sm:w-auto sm:px-6" onClick={() => go(index - 1)} disabled={index === 0} icon={<ArrowLeft className="size-4.5" />} aria-label="Previous question">
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button variant="ghost" size="lg" className="shrink-0 px-2.5 sm:px-6 lg:hidden" onClick={() => setNavOpen(true)} icon={<LayoutGrid className="size-4.5" />} aria-label={`Questions: ${answeredCount} of ${questions.length} answered`}>
                {answeredCount}/{questions.length}
              </Button>
              <div className="flex-1" />
              {last ? (
                <Button size="lg" className="shrink-0 px-4 sm:px-6" onClick={() => setConfirmOpen(true)} icon={<Send className="size-4.5" />}>
                  <span className="sm:hidden">Submit</span>
                  <span className="hidden sm:inline">Review & submit</span>
                </Button>
              ) : (
                <Button size="lg" className="shrink-0 px-4 sm:px-6" onClick={() => go(index + 1)} iconRight={<ArrowRight className="size-4.5" />}>Next</Button>
              )}
            </div>
          </div>
        </section>

        {/* Navigator (desktop) */}
        <aside className="hidden lg:block">
          <Card className="sticky top-28 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-fg">Questions</h2>
              <span className="text-xs text-faint tabular">{answeredCount} of {questions.length} answered</span>
            </div>
            <div className="mt-4"><QuestionGrid total={questions.length} current={index} answered={isAnswered} onJump={go} /></div>
            <div className="mt-4 flex gap-4 text-[11px] text-faint">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-accent/40" /> Answered</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded border border-line-strong" /> Not yet</span>
            </div>
            <Button block className="mt-5" variant={answeredCount === questions.length ? 'primary' : 'secondary'} onClick={() => setConfirmOpen(true)} icon={<CheckCheck className="size-4.5" />}>
              Submit quiz
            </Button>
            <p className="mt-3 text-center text-[11px] text-faint">Keys 1–4 / A–D to answer · ← → to move</p>
          </Card>
        </aside>
      </main>

      {/* Mobile navigator sheet */}
      <Dialog open={navOpen} onClose={() => setNavOpen(false)} title="Jump to question" description={`${answeredCount} of ${questions.length} answered`} size="sm">
        <QuestionGrid total={questions.length} current={index} answered={isAnswered} onJump={go} />
        <Button block className="mt-6" onClick={() => { setNavOpen(false); setConfirmOpen(true) }} icon={<CheckCheck className="size-4.5" />}>
          Submit quiz
        </Button>
      </Dialog>

      {/* Submit confirmation */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit your answers?"
        description="You can’t change your answers after submitting."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Keep reviewing</Button>
            <Button onClick={() => void submit('manual')} icon={<Send className="size-4.5" />}>Submit now</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-bg-soft/60 p-4 text-center">
            <p className="font-headline text-3xl text-accent">{answeredCount}</p>
            <p className="text-xs text-faint">Answered</p>
          </div>
          <div className={cn('rounded-2xl border p-4 text-center', unanswered.length ? 'border-warning/30 bg-warning/8' : 'border-line bg-bg-soft/60')}>
            <p className={cn('font-headline text-3xl', unanswered.length ? 'text-warning' : 'text-fg')}>{unanswered.length}</p>
            <p className="text-xs text-faint">Unanswered</p>
          </div>
        </div>
        {unanswered.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-medium text-muted">Tap to revisit:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unanswered.map((i) => (
                <button key={i} onClick={() => { setConfirmOpen(false); go(i) }} className="rounded-lg border border-warning/30 bg-warning/8 px-2.5 py-1 font-mono text-xs font-semibold text-warning transition hover:bg-warning/15">
                  Q{i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </Dialog>

      {/* Anti-cheat warning (the timer keeps running behind it) */}
      <AnimatePresence>
        {warning && phase === 'active' && (
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ac-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] grid place-items-center bg-bg/95 px-6 backdrop-blur-md"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--t-danger)_28%,transparent),transparent_70%)]" />
            <motion.div initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} className="relative flex w-full max-w-md flex-col items-center text-center">
              <motion.div
                animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
                transition={{ duration: 0.6 }}
                className="grid size-18 place-items-center rounded-3xl border border-danger/50 bg-danger/15 text-danger"
              >
                <ShieldAlert className="size-9" />
              </motion.div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-danger">
                Warning {warning.strikes} of {Math.max(1, maxStrikes - 1)}
              </p>
              <h2 id="ac-title" className="font-headline mt-2 text-3xl text-fg">Stay on the quiz screen</h2>
              <p className="mt-3 text-muted">{warning.kind ? VIOLATION_TEXT[warning.kind] : 'A rule was broken.'} This has been recorded.</p>
              <p className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-fg">
                {maxStrikes - warning.strikes <= 1
                  ? 'One more time and your quiz ends immediately. You will be disqualified.'
                  : `${maxStrikes - warning.strikes} more and your quiz ends. You will be disqualified.`}
              </p>
              <p className="mt-3 text-xs text-faint">The timer is still running.</p>
              <Button size="lg" variant="danger" className="mt-7 w-full" onClick={acknowledgeWarning}>
                I understand, continue the quiz
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submitting overlay */}
      <AnimatePresence>
        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-bg/80 px-6 backdrop-blur-md">
            <motion.div initial={{ scale: 0.92, y: 10 }} animate={{ scale: 1, y: 0 }} className="flex max-w-sm flex-col items-center text-center">
              {timeUp ? (
                <div className="mb-6 grid size-16 place-items-center rounded-2xl border border-warning/40 bg-warning/12 text-warning">
                  <AlarmClockOff className="size-7" />
                </div>
              ) : (
                <div className="relative mb-6 size-16">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-accent opacity-25 blur-xl" />
                  <div className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-accent [animation-duration:800ms]" />
                </div>
              )}
              <h2 className="font-headline text-2xl text-fg">{timeUp ? 'Time’s up!' : 'Submitting…'}</h2>
              <p className="mt-2 text-sm text-muted">{submitError ?? 'Scoring your answers on the server. Hang tight.'}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
