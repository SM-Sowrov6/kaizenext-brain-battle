import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div role="status" className={cn('flex items-center gap-3 text-muted', className)}>
      <Loader2 className="size-5 animate-spin text-accent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

/** Full-area branded loader. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6">
      <div className="flex flex-col items-center gap-5">
        <div className="relative size-14">
          <div className="absolute inset-0 rounded-2xl bg-gradient-accent opacity-20 blur-xl" />
          <div className="absolute inset-0 rounded-2xl border-2 border-line" />
          <div className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-accent [animation-duration:900ms]" />
        </div>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />
}

export function EmptyState({
  icon, title, description, action, className,
}: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center px-6 py-14 text-center', className)}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-2xl" />
        <div className="relative grid size-14 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-accent [&>svg]:size-6">
          {icon}
        </div>
      </div>
      <h3 className="font-headline text-lg text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}

export function ErrorState({
  title = 'Something went wrong', message, onRetry, className,
}: { title?: string; message?: string | null; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="font-headline text-lg">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" icon={<RefreshCw className="size-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

type AlertTone = 'info' | 'success' | 'warning' | 'danger'
const alertStyle: Record<AlertTone, { cls: string; icon: ReactNode }> = {
  info: { cls: 'border-accent/25 bg-accent/8 text-fg', icon: <Info className="size-4.5 text-accent" /> },
  success: { cls: 'border-success/25 bg-success/8 text-fg', icon: <CheckCircle2 className="size-4.5 text-success" /> },
  warning: { cls: 'border-warning/30 bg-warning/8 text-fg', icon: <AlertTriangle className="size-4.5 text-warning" /> },
  danger: { cls: 'border-danger/30 bg-danger/8 text-fg', icon: <XCircle className="size-4.5 text-danger" /> },
}

export function Alert({
  tone = 'info', title, children, className, action,
}: { tone?: AlertTone; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const s = alertStyle[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border px-4 py-3', s.cls, className)}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('leading-relaxed text-muted', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
