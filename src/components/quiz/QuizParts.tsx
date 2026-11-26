import { Check, Cloud, CloudOff, Loader2, Timer } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline'

export function TimerPill({ remaining, total }: { remaining: number; total: number }) {
  const danger = remaining <= 15
  const warning = remaining <= 60 && !danger
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <div
      role="timer"
      aria-live={danger ? 'assertive' : 'off'}
      aria-label={`${formatClock(remaining)} remaining`}
      className={cn(
        'flex items-center gap-2.5 rounded-full border py-1 pr-4 pl-1 transition-colors duration-500',
        danger ? 'border-danger/50 bg-danger/12 text-danger' : warning ? 'border-warning/40 bg-warning/10 text-warning' : 'border-line-strong bg-surface text-fg',
      )}
    >
      <span className="relative grid size-8 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-current opacity-15" />
          <circle
            cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className={cn('transition-[stroke-dashoffset] duration-300 ease-linear', danger || warning ? 'stroke-current' : '')}
            style={danger || warning ? undefined : { stroke: 'var(--t-accent)' }}
          />
        </svg>
        <Timer className={cn('size-3.5', danger && 'animate-pulse')} />
      </span>
      <span className="font-mono text-base font-semibold tabular sm:text-lg">{formatClock(remaining)}</span>
    </div>
  )
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const map = {
    idle: { icon: <Cloud className="size-3.5" />, text: 'Auto-save on', cls: 'text-faint' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', cls: 'text-muted' },
    saved: { icon: <Check className="size-3.5" />, text: 'All answers saved', cls: 'text-success' },
    offline: { icon: <CloudOff className="size-3.5" />, text: 'Offline — answers kept on this device', cls: 'text-warning' },
  }[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium transition-colors', map.cls)} aria-live="polite">
      {map.icon}
      {map.text}
    </span>
  )
}

export function SegmentedProgress({
  total, current, answered, onJump,
}: { total: number; current: number; answered: (i: number) => boolean; onJump: (i: number) => void }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          aria-label={`Go to question ${i + 1}`}
          className="group relative h-4 flex-1 cursor-pointer"
        >
          <span
            className={cn(
              'absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-300',
              answered(i) ? 'bg-gradient-accent' : 'bg-surface-3 group-hover:bg-line-strong',
              i === current && 'h-2 ring-2 ring-accent/50 ring-offset-1 ring-offset-bg',
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function OptionButton({
  letter, text, selected, onSelect, index,
}: { letter: string; text: string; selected: boolean; onSelect: () => void; index: number }) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        'group relative flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-[border-color,background-color,box-shadow] duration-200 sm:px-5 sm:py-4.5',
        selected
          ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_var(--t-accent),0_12px_36px_-14px_color-mix(in_oklab,var(--t-accent)_70%,transparent)]'
          : 'border-line bg-bg-soft/70 hover:border-line-strong hover:bg-surface-2',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-xl border font-mono text-sm font-semibold transition-all duration-200',
          selected ? 'border-transparent bg-gradient-accent text-on-accent' : 'border-line-strong text-muted group-hover:border-accent/50 group-hover:text-fg',
        )}
      >
        {selected ? <Check className="size-4.5" strokeWidth={3} /> : letter}
      </span>
      <span className={cn('flex-1 text-[0.98rem] leading-snug sm:text-base', selected ? 'text-fg font-medium' : 'text-fg/90')}>{text}</span>
    </motion.button>
  )
}

export function QuestionGrid({
  total, current, answered, onJump,
}: { total: number; current: number; answered: (i: number) => boolean; onJump: (i: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          aria-label={`Question ${i + 1}${answered(i) ? ', answered' : ''}`}
          aria-current={i === current ? 'true' : undefined}
          className={cn(
            'grid aspect-square place-items-center rounded-xl border font-mono text-sm font-semibold transition-all duration-200',
            answered(i) ? 'border-transparent bg-accent/15 text-accent' : 'border-line bg-bg-soft/60 text-faint hover:border-line-strong hover:text-muted',
            i === current && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
          )}
        >
          {i + 1}
        </button>
      ))}
    </div>
  )
}
