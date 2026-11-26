import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { ArrowUpRight, Mail, Trophy } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FacebookIcon, KAIZENEXT_LINKS, LinkedInIcon, Wordmark } from '@/components/ui/Brand'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'

/** Ambient lighting behind every public page. Pure CSS, GPU-cheap. */
export function AmbientBackground({ intensity = 1 }: { intensity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <div
        className="absolute -top-[30%] left-1/2 h-[80vh] w-[120vw] -translate-x-1/2 rounded-[50%] blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--t-glow-1), transparent)', opacity: intensity }}
      />
      <div
        className="absolute -right-[20%] top-[30%] h-[70vh] w-[60vw] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--t-glow-2), transparent)', opacity: intensity * 0.9 }}
      />
      <div className="bg-grid mask-fade-b absolute inset-0 opacity-60" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
    </div>
  )
}

function Header({ minimal }: { minimal?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled ? 'glass border-b border-line' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-1.5 sm:gap-3">
          {!minimal && pathname === '/' && (
            <div className="mr-1 hidden items-center gap-1 lg:flex">
              <a href="#how" className="rounded-lg px-3 py-2 text-sm text-muted transition hover:text-fg">How it works</a>
              <a href="#prizes" className="rounded-lg px-3 py-2 text-sm text-muted transition hover:text-fg">Prizes</a>
            </div>
          )}
          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              cn(
                'hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition sm:flex',
                isActive ? 'text-fg' : 'text-muted hover:text-fg',
              )
            }
          >
            <Trophy className="size-4" /> Leaderboard
          </NavLink>
          <ThemeSwitcher />
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Think Fast. Play Smart. Win Big. A live quiz challenge by Kaizenext — an AI technology startup from Dhaka.
          </p>
          <div className="mt-5 flex gap-2">
            {[
              { href: KAIZENEXT_LINKS.linkedin, label: 'Kaizenext on LinkedIn', icon: <LinkedInIcon /> },
              { href: KAIZENEXT_LINKS.facebook, label: 'Kaizenext on Facebook', icon: <FacebookIcon /> },
              { href: `mailto:${KAIZENEXT_LINKS.email}`, label: 'Email Kaizenext', icon: <Mail className="size-4" /> },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                target={s.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
        <FooterCol title="Kaizenext">
          <FooterLink href={KAIZENEXT_LINKS.website} external>kaizenext.com</FooterLink>
          <FooterLink href={KAIZENEXT_LINKS.uttirno} external>Uttirno — AI exam prep</FooterLink>
          <FooterLink href={`mailto:${KAIZENEXT_LINKS.email}`}>{KAIZENEXT_LINKS.email}</FooterLink>
        </FooterCol>
        <FooterCol title="Brain Battle">
          <FooterLink to="/register">Start your challenge</FooterLink>
          <FooterLink to="/leaderboard">Live leaderboard</FooterLink>
          <FooterLink href="/#how">How it works</FooterLink>
        </FooterCol>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Kaizenext. All rights reserved.</p>
          <p>Made for DIU Job Utsob 2026</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">{title}</h4>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  )
}

function FooterLink({ href, to, external, children }: { href?: string; to?: string; external?: boolean; children: ReactNode }) {
  const cls = 'group inline-flex items-center gap-1 text-sm text-muted transition hover:text-fg'
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>{children}</Link>
      ) : (
        <a href={href} className={cls} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
          {children}
          {external && <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />}
        </a>
      )}
    </li>
  )
}

export function PublicLayout({ minimal }: { minimal?: boolean }) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBackground intensity={minimal ? 0.7 : 1} />
      <Header minimal={minimal} />
      <main className="flex-1">
        <Outlet />
      </main>
      {!minimal && <Footer />}
    </div>
  )
}
