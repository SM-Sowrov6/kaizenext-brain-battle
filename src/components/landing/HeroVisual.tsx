import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Ticket, Timer, Trophy } from 'lucide-react'
import { cn } from '@/lib/cn'

// A decorative, self-playing quiz card. The question is illustrative only
// and is not part of the real question bank.
const DEMO = {
  q: 'Which data structure follows Last-In, First-Out?',
  options: ['Queue', 'Stack', 'Linked list', 'Hash map'],
  answer: 1,
}

const STEPS = 4 // 0 idle → 1 hover → 2 selected → 3 correct

export function HeroVisual() {
  const [step, setStep] = useState(0)
  const [seconds, setSeconds] = useState(42)

  useEffect(() => {
    const durations = [1400, 900, 900, 2200]
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS), durations[step])
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s <= 8 ? 42 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const ring = 2 * Math.PI * 18
  const progress = seconds / 60

  return (
    <div className="relative mx-auto w-full max-w-[460px] select-none" aria-hidden>
      {/* orbit rings */}
      <div className="absolute left-1/2 top-1/2 size-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line opacity-60" />
      <div className="absolute left-1/2 top-1/2 size-[100%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full border border-dashed border-line-strong opacity-50">
        <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_16px_var(--t-accent)]" />
      </div>
      <div className="absolute left-1/2 top-1/2 size-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-accent opacity-[0.13] blur-3xl" />

      {/* main card */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="card-surface relative rounded-[1.75rem] p-5 sm:p-6"
        style={{ transformPerspective: 1000 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent/12 px-2 py-1 font-mono text-[11px] font-semibold text-accent">Q 07/10</span>
            <span className="text-[11px] font-medium text-faint">1 mark</span>
          </div>
          <div className="relative grid size-11 place-items-center">
            <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
              <circle cx="20" cy="20" r="18" fill="none" strokeWidth="3" style={{ stroke: 'var(--t-border-strong)' }} />
              <circle
                cx="20" cy="20" r="18" fill="none" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={ring} strokeDashoffset={ring * (1 - progress)}
                style={{ stroke: 'var(--t-accent)', transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="font-mono text-[11px] font-semibold tabular text-fg">{seconds}</span>
          </div>
        </div>

        {/* segmented progress */}
        <div className="mt-4 flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full', i < 6 ? 'bg-gradient-accent' : i === 6 ? 'bg-accent/50' : 'bg-surface-3')} />
          ))}
        </div>

        <p className="font-headline mt-5 text-[1.15rem] leading-snug text-fg sm:text-xl">{DEMO.q}</p>

        <div className="mt-5 space-y-2.5">
          {DEMO.options.map((opt, i) => {
            const isAnswer = i === DEMO.answer
            const hovered = step === 1 && isAnswer
            const selected = step >= 2 && isAnswer
            const correct = step === 3 && isAnswer
            return (
              <div
                key={opt}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-all duration-300',
                  correct
                    ? 'border-success/60 bg-success/10 text-fg'
                    : selected
                      ? 'border-accent bg-accent/10 text-fg glow-accent'
                      : hovered
                        ? 'border-line-strong bg-surface-2 text-fg'
                        : 'border-line bg-bg-soft/60 text-muted',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-lg border font-mono text-xs font-semibold transition-all duration-300',
                    correct ? 'border-transparent bg-success text-white' : selected ? 'border-transparent bg-gradient-accent text-on-accent' : 'border-line-strong text-faint',
                  )}
                >
                  {correct ? <Check className="size-4" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                </span>
                {opt}
              </div>
            )
          })}
        </div>

        <AnimatePresence>
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: -6, scale: 1 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ type: 'spring', stiffness: 380, damping: 20 }}
              className="absolute right-6 bottom-6 rounded-full bg-success px-3 py-1 text-sm font-bold text-white shadow-[0_8px_24px_-6px_var(--t-success)]"
            >
              +1
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* floating chips */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="glass absolute -left-3 top-10 hidden animate-float items-center gap-2.5 rounded-2xl border border-line-strong px-3.5 py-2.5 shadow-2xl sm:-left-10 sm:flex"
      >
        <span className="grid size-8 place-items-center rounded-xl bg-warning/15 text-warning">
          <Trophy className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-medium uppercase tracking-wider text-faint">Top score</p>
          <p className="text-sm font-bold text-fg">10 / 10</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="glass absolute -right-2 bottom-24 hidden items-center gap-2.5 rounded-2xl border border-line-strong px-3.5 py-2.5 shadow-2xl [animation-delay:1.5s] animate-float sm:-right-8 sm:flex"
      >
        <span className="grid size-8 place-items-center rounded-xl bg-accent/15 text-accent">
          <Ticket className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-medium uppercase tracking-wider text-faint">Lucky draw</p>
          <p className="text-sm font-bold text-fg">Top scorers win prizes</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        className="glass absolute -bottom-5 left-8 hidden items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium text-muted shadow-xl sm:flex"
      >
        <Timer className="size-3.5 text-accent" /> Auto-submits at 00:00
      </motion.div>
    </div>
  )
}
