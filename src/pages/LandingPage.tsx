import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, Award, BadgeCheck, Brain, CalendarDays, Clock3, Gift, ListChecks, Medal, MinusCircle,
  QrCode, ShieldCheck, Sparkles, Target, Trophy, UserPlus,
} from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { useSession } from '@/hooks/useSession'
import { useTitle } from '@/hooks/misc'
import { eventRange, formatDate, formatScore } from '@/lib/format'
import { cn } from '@/lib/cn'
import { LinkButton } from '@/components/ui/Button'
import { Badge, Card, LiveDot, SectionEyebrow } from '@/components/ui/Card'
import { Alert, Skeleton } from '@/components/ui/Feedback'
import { HeroVisual } from '@/components/landing/HeroVisual'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
}

function Reveal({ children, i = 0, className }: { children: ReactNode; i?: number; className?: string }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={i} className={className}>
      {children}
    </motion.div>
  )
}

export default function LandingPage() {
  useTitle('')
  const { config, loading, error, reload } = useConfig()
  const { session } = useSession()
  const ev = config?.event
  const quiz = config?.quiz

  const live = Boolean(ev?.quizEnabled)
  const canJoin = Boolean(session) || Boolean(ev?.registrationEnabled)
  const cta = session
    ? { to: '/instructions', label: 'Continue your challenge' }
    : { to: '/register', label: 'Start Your Challenge' }

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div className="text-center lg:text-left">
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
            <span className="inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-full border border-line-strong bg-surface/70 py-1.5 pr-4 pl-1.5 text-xs font-medium text-muted backdrop-blur">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold', live ? 'bg-success/12 text-success' : 'bg-surface-3 text-muted')}>
                {live ? <LiveDot /> : <span className="size-1.5 rounded-full bg-faint" />}
                {loading ? 'Checking…' : live ? 'Live now' : 'Opening soon'}
              </span>
              {ev ? `${ev.name} · ${eventRange(ev.day1Date, ev.day2Date)}` : 'DIU Job Utsob 2026 · Nov 28–29'}
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp} initial="hidden" animate="show" custom={1}
            className="font-headline mt-7 text-[2.75rem] leading-[1.02] text-fg sm:text-6xl lg:text-[4.6rem]"
          >
            Your Mind.
            <br />
            <span className="font-flair text-gradient pr-2 text-[1.08em] leading-[1.1]">Your Challenge.</span>
          </motion.h1>

          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
            Scan, register in 30 seconds, and race the clock through a quick-fire quiz on tech, AI and careers.
            Top the live leaderboard at the Kaizenext booth and walk away with a prize.
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            {canJoin || loading ? (
              <LinkButton to={cta.to} size="xl" iconRight={<ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-1" />} className="w-full sm:w-auto">
                {cta.label}
              </LinkButton>
            ) : (
              <div className="rounded-2xl border border-line-strong bg-surface px-5 py-3.5 text-sm text-muted">
                Registration is closed right now — check back soon.
              </div>
            )}
            <LinkButton to="/leaderboard" variant="secondary" size="xl" icon={<Trophy className="size-5" />} className="w-full sm:w-auto">
              Leaderboard
            </LinkButton>
          </motion.div>

          {/* quick facts — real configured values only */}
          <motion.dl variants={fadeUp} initial="hidden" animate="show" custom={4} className="mx-auto mt-10 grid max-w-md grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/50 backdrop-blur lg:mx-0">
            {[
              { label: 'Questions', value: quiz?.questionCount },
              { label: 'Minutes', value: quiz ? formatScore(Math.round((quiz.durationSeconds / 60) * 10) / 10) : undefined },
              { label: 'Attempt', value: quiz ? '1' : undefined },
            ].map((f) => (
              <div key={f.label} className="px-3 py-3.5 text-center">
                <dd className="font-headline text-2xl text-fg tabular">{f.value ?? <Skeleton className="mx-auto h-7 w-8" />}</dd>
                <dt className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-faint">{f.label}</dt>
              </div>
            ))}
          </motion.dl>
          {error && !config && (
            <Alert tone="warning" className="mx-auto mt-6 max-w-md text-left lg:mx-0" action={<button onClick={() => void reload()} className="text-sm font-semibold text-accent">Retry</button>}>
              {error}
            </Alert>
          )}
        </div>

        <div className="relative px-4 sm:px-10 lg:px-0">
          <HeroVisual />
        </div>
      </section>

      {/* ── Tagline band ───────────────────────────────────── */}
      <section aria-label="Tagline" className="relative overflow-hidden border-y border-line bg-surface/40 py-5">
        <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-12 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-12" aria-hidden={k === 1}>
              {['Think Fast.', 'Play Smart.', 'Win Big.', 'Think Fast.', 'Play Smart.', 'Win Big.'].map((w, i) => (
                <span key={i} className="font-headline flex items-center gap-12 text-2xl text-faint sm:text-3xl">
                  <span className={i % 3 === 2 ? 'text-gradient' : ''}>{w}</span>
                  <Sparkles className="size-5 text-accent/60" />
                </span>
              ))}
            </div>
          ))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 className="font-headline mt-3 text-3xl text-fg sm:text-5xl">From scan to scoreboard in minutes</h2>
          <p className="mt-4 text-muted">No app, no account, no password. Just your phone and your brain.</p>
        </Reveal>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <QrCode />, title: 'Scan the QR', text: 'Point your camera at the code at the Kaizenext booth.' },
            { icon: <UserPlus />, title: 'Register fast', text: 'Name, email, university, department. That\'s it.' },
            { icon: <Brain />, title: 'Beat the clock', text: `${quiz?.questionCount ?? 10} questions. One shot. Every second counts.` },
            { icon: <Trophy />, title: 'Climb the board', text: 'See your rank instantly on your phone and the booth screen.' },
          ].map((s, i) => (
            <Reveal key={s.title} i={i}>
              <Card className="group relative h-full overflow-hidden p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-line-strong">
                <div className="absolute -right-10 -top-10 size-32 rounded-full bg-accent/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-accent [&>svg]:size-5.5">{s.icon}</span>
                  <span className="font-headline text-4xl text-surface-3">0{i + 1}</span>
                </div>
                <h3 className="font-headline mt-6 text-lg text-fg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Competition info ───────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <Reveal>
            <Card className="h-full p-7 sm:p-9">
              <SectionEyebrow>The competition</SectionEyebrow>
              <h2 className="font-headline mt-3 text-3xl text-fg sm:text-4xl">Fair, fast and transparent</h2>
              {loading ? (
                <div className="mt-5 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
              ) : (
                <p className="mt-4 leading-relaxed text-muted">{ev?.competitionInfo}</p>
              )}
              <ul className="mt-7 space-y-3">
                {(ev?.rules ?? []).slice(0, 5).map((r) => (
                  <li key={r} className="flex gap-3 text-sm leading-relaxed text-muted">
                    <BadgeCheck className="mt-0.5 size-4.5 shrink-0 text-accent" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal i={1}>
            <Card className="relative h-full overflow-hidden p-7 sm:p-9">
              <div className="absolute -right-24 -top-24 size-64 rounded-full bg-gradient-accent opacity-10 blur-3xl" />
              <SectionEyebrow>Format</SectionEyebrow>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <FormatTile icon={<ListChecks />} label="Questions" value={quiz ? String(quiz.questionCount) : null} />
                <FormatTile icon={<Clock3 />} label="Duration" value={quiz ? `${formatScore(quiz.durationSeconds / 60)} min` : null} />
                <FormatTile icon={<Target />} label="Per question" value={quiz ? `${formatScore(quiz.marksPerQuestion)} mark${quiz.marksPerQuestion === 1 ? '' : 's'}` : null} />
                <FormatTile icon={<MinusCircle />} label="Negative marking" value={quiz ? (quiz.negativeMarking ? `−${formatScore(quiz.negativeMark)}` : 'None') : null} />
              </div>
              <div className="mt-6 rounded-2xl border border-line bg-bg-soft/60 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-faint">
                  <CalendarDays className="size-3.5" /> Event days
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ev ? (
                    ([1, 2] as const).map((d) => (
                      <div key={d} className={cn('rounded-xl border px-3 py-2.5', ev.activeDay === d ? 'border-accent/50 bg-accent/8' : 'border-line')}>
                        <p className="text-sm font-semibold text-fg">Day {d}</p>
                        <p className="text-xs text-muted">{formatDate(d === 1 ? ev.day1Date : ev.day2Date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                        {ev.activeDay === d && <Badge tone="accent" className="mt-2">Today</Badge>}
                      </div>
                    ))
                  ) : (
                    <><Skeleton className="h-16" /><Skeleton className="h-16" /></>
                  )}
                </div>
              </div>
              <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-faint">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                Answers are checked and scored on our servers. Leaderboards show names only — never emails or phone numbers.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ── Prizes ─────────────────────────────────────────── */}
      <section id="prizes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Prizes</SectionEyebrow>
          <h2 className="font-headline mt-3 text-3xl text-fg sm:text-5xl">Play for more than bragging rights</h2>
        </Reveal>
        {ev && ev.prizes.length > 0 ? (
          <div className={cn('mt-14 grid gap-4', ev.prizes.length >= 3 ? 'md:grid-cols-3' : ev.prizes.length === 2 ? 'md:grid-cols-2' : 'max-w-md mx-auto')}>
            {ev.prizes.map((p, i) => (
              <Reveal key={`${p.place}-${i}`} i={i}>
                <Card className={cn('relative h-full overflow-hidden p-7 text-center', i === 0 && 'border-accent/40 md:-translate-y-3')}>
                  {i === 0 && <div className="absolute inset-x-0 top-0 h-px bg-gradient-accent" />}
                  {i === 0 && <div className="absolute left-1/2 top-0 h-32 w-48 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />}
                  <div className={cn('relative mx-auto grid size-16 place-items-center rounded-2xl border', i === 0 ? 'border-transparent bg-gradient-accent text-on-accent shadow-[0_12px_40px_-10px_var(--t-accent)]' : 'border-line-strong bg-surface-2 text-accent')}>
                    {i === 0 ? <Trophy className="size-7" /> : i === 1 ? <Medal className="size-7" /> : i === 2 ? <Award className="size-7" /> : <Gift className="size-7" />}
                  </div>
                  <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{p.place}</p>
                  <h3 className="font-headline relative mt-2 text-xl text-fg">{p.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted">{p.description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-muted">{loading ? 'Loading prizes…' : 'Prize details will be announced at the booth.'}</p>
        )}
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-line-strong p-10 text-center sm:p-16">
            <div className="absolute inset-0 bg-gradient-accent opacity-[0.12]" />
            <div className="bg-grid mask-fade-b absolute inset-0 opacity-70" />
            <div className="absolute -bottom-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" />
            <div className="relative">
              <h2 className="font-headline text-3xl text-fg sm:text-5xl">
                Ready to <span className="font-flair text-gradient">battle?</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-muted">One attempt. {quiz ? formatScore(quiz.durationSeconds / 60) : 5} minutes. Your name on the big screen.</p>
              <div className="mt-8 flex justify-center">
                {canJoin || loading ? (
                  <LinkButton to={cta.to} size="xl" iconRight={<ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-1" />}>
                    {cta.label}
                  </LinkButton>
                ) : (
                  <LinkButton to="/leaderboard" size="xl" variant="secondary" icon={<Trophy className="size-5" />}>View leaderboard</LinkButton>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}

function FormatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-bg-soft/60 p-4">
      <span className="text-accent [&>svg]:size-4.5">{icon}</span>
      <p className="font-headline mt-3 text-xl text-fg">{value ?? <Skeleton className="h-6 w-14" />}</p>
      <p className="mt-0.5 text-xs text-faint">{label}</p>
    </div>
  )
}
