import { motion } from 'framer-motion'
import { THEMES, useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

/**
 * Three-way theme toggle: Midnight · Kaizenext · Uttirno.
 * Swatch-only on small screens, labelled from `md` up (unless `compact`).
 */
export function ThemeSwitcher({ compact, className }: { compact?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn('relative flex items-center gap-0.5 rounded-full border border-line bg-surface/70 p-1 backdrop-blur', className)}
    >
      {THEMES.map((t) => {
        const active = t.id === theme
        return (
          <button
            key={t.id}
            role="radio"
            aria-checked={active}
            title={`${t.name} theme — ${t.description}`}
            onClick={() => setTheme(t.id)}
            className={cn(
              'relative flex h-8 items-center gap-2 rounded-full px-2 text-xs font-medium transition-colors duration-200',
              !compact && 'md:px-3',
              active ? 'text-fg' : 'text-faint hover:text-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-full border border-line-strong bg-surface-3"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span
              aria-hidden
              className="relative size-4 shrink-0 rounded-full ring-1 ring-white/15"
              style={{ background: `conic-gradient(from 210deg, ${t.swatch[1]}, ${t.swatch[2]}, ${t.swatch[1]})`, boxShadow: `inset 0 0 0 3px ${t.swatch[0]}` }}
            />
            <span className={cn('relative', compact ? 'sr-only' : 'sr-only md:not-sr-only')}>{t.name}</span>
          </button>
        )
      })}
    </div>
  )
}
