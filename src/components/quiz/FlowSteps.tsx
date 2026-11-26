import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

const STEPS = ['Register', 'Instructions', 'Quiz', 'Result']

export function FlowSteps({ current }: { current: number }) {
  return (
    <ol className="mx-auto flex w-full max-w-md items-center" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'grid size-7 place-items-center rounded-full border text-xs font-semibold transition-all duration-300',
                  done && 'border-transparent bg-gradient-accent text-on-accent',
                  active && 'border-accent bg-accent/12 text-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--t-accent)_12%,transparent)]',
                  !done && !active && 'border-line-strong text-faint',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('text-[11px] font-medium', active ? 'text-fg' : 'text-faint')}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={cn('mx-1.5 mb-5 h-px flex-1 transition-colors', done ? 'bg-accent/60' : 'bg-line-strong')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
