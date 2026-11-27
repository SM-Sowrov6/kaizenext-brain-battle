import { useId } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

/** Brain Battle mark — a lightning bolt inside a lit tile; colours follow the active theme. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9 shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--t-accent)' }} />
          <stop offset="1" style={{ stopColor: 'var(--t-accent-2)' }} />
        </linearGradient>
        <radialGradient id={`r${id}`} cx="30%" cy="20%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" style={{ fill: 'var(--t-surface-2)' }} />
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill={`url(#g${id})`} opacity=".16" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill={`url(#r${id})`} />
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="none" style={{ stroke: 'var(--t-border-strong)' }} />
      <path d="M22.6 7.5 11.5 22.4h7.3l-2.4 10.1 12.1-15.6h-7.5z" fill={`url(#g${id})`} />
    </svg>
  )
}

export function Wordmark({ className, to = '/', compact }: { className?: string; to?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn('group flex items-center gap-2.5', className)} aria-label="Kaizenext Brain Battle — home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span className="font-headline text-[1.05rem] text-fg">
          Brain <span className="text-gradient">Battle</span>
        </span>
        {!compact && (
          <span className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-faint">by Kaizenext</span>
        )}
      </span>
    </Link>
  )
}

/**
 * Official Kaizenext logo (white "Kaizen" + orange "ext", from the job-fair brand pack).
 * Brand rules: never recolour it; place it directly on the dark surface; keep clear space around it.
 */
export function KaizenextLogo({ className, href }: { className?: string; href?: string }) {
  const img = (
    <img src="/brand/kaizenext-logo.svg" alt="Kaizenext" width={800} height={306} className={cn('block h-8 w-auto select-none', className)} draggable={false} />
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Kaizenext website" className="inline-block transition-opacity hover:opacity-90">
      {img}
    </a>
  ) : (
    img
  )
}

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('size-4', className)} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  )
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('size-4', className)} aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  )
}

export const KAIZENEXT_LINKS = {
  website: 'https://kaizenext.com/',
  uttirno: 'https://uttirno.org/',
  linkedin: 'https://www.linkedin.com/company/kaizenext',
  facebook: 'https://www.facebook.com/profile.php?id=61580389798280',
  email: 'contact@kaizenext.com',
}
