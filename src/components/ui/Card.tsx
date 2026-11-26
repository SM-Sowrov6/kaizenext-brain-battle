import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card-surface rounded-card', className)} {...rest}>
      {children}
    </div>
  )
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent/10 text-accent border-accent/25',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
}

export function Badge({
  tone = 'neutral', className, children, icon,
}: { tone?: Tone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Small pulsing "live" dot. */
export function LiveDot({ className, tone = 'success' }: { className?: string; tone?: 'success' | 'accent' | 'danger' }) {
  const color = tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : 'bg-accent'
  return (
    <span className={cn('relative inline-flex size-2', className)}>
      <span className={cn('absolute inline-flex size-full rounded-full opacity-70 animate-pulse-ring', color)} />
      <span className={cn('relative inline-flex size-2 rounded-full', color)} />
    </span>
  )
}

export function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs font-semibold uppercase tracking-[0.18em] text-accent', className)}>{children}</p>
  )
}
