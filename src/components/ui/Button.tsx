import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const base =
  'group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold ' +
  'transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-out ' +
  'active:scale-[0.975] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-accent text-on-accent shadow-[0_8px_30px_-8px_color-mix(in_oklab,var(--t-accent)_70%,transparent),inset_0_1px_0_rgb(255_255_255/0.25)] ' +
    'hover:shadow-[0_14px_44px_-10px_color-mix(in_oklab,var(--t-accent)_85%,transparent),inset_0_1px_0_rgb(255_255_255/0.3)] hover:-translate-y-px overflow-hidden',
  secondary:
    'bg-surface-2 text-fg border border-line-strong hover:bg-surface-3 hover:border-[color-mix(in_oklab,var(--t-accent)_40%,var(--t-border-strong))]',
  outline: 'border border-line-strong text-fg hover:border-accent/60 hover:bg-accent/5',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20 hover:border-danger/50',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-lg',
  md: 'h-11 px-5 text-[0.9375rem] rounded-xl',
  lg: 'h-13 px-6 text-base rounded-xl',
  xl: 'h-15 px-8 text-lg rounded-2xl',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  className?: string
  children?: ReactNode
  block?: boolean
}

function Inner({ loading, icon, iconRight, children, variant }: CommonProps) {
  return (
    <>
      {variant === 'primary' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_25%,rgb(255_255_255/0.28)_50%,transparent_75%)] transition-transform duration-700 ease-out group-hover/btn:translate-x-full"
        />
      )}
      {loading ? <Loader2 className="size-[1.1em] animate-spin" /> : icon}
      {children && <span className="relative">{children}</span>}
      {!loading && iconRight}
    </>
  )
}

export const Button = forwardRef<HTMLButtonElement, CommonProps & ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button({ variant = 'primary', size = 'md', loading, icon, iconRight, className, children, block, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        <Inner {...{ loading, icon, iconRight, children, variant }} />
      </button>
    )
  },
)

export function LinkButton({
  to, variant = 'primary', size = 'md', icon, iconRight, className, children, block, external,
}: CommonProps & { to: string; external?: boolean }) {
  const cls = cn(base, variants[variant], sizes[size], block && 'w-full', className)
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>
        <Inner {...{ icon, iconRight, children, variant }} />
      </a>
    )
  }
  return (
    <Link to={to} className={cls}>
      <Inner {...{ icon, iconRight, children, variant }} />
    </Link>
  )
}
