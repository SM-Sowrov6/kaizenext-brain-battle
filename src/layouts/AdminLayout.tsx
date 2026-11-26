import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { ExternalLink, FileQuestion, LayoutDashboard, LogOut, QrCode, Settings, Trophy, Users } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { cn } from '@/lib/cn'
import { Wordmark } from '@/components/ui/Brand'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/questions', label: 'Questions', icon: FileQuestion },
  { to: '/admin/participants', label: 'Participants', icon: Users },
  { to: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/qr', label: 'QR code', icon: QrCode },
]

export function AdminLayout() {
  const { user, signOut } = useAdminAuth()
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[248px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg-soft/60 p-4 lg:flex">
        <div className="px-2 py-2"><Wordmark to="/admin" /></div>
        <p className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">Manage</p>
        <nav className="mt-2 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--t-border-strong)]' : 'text-muted hover:bg-surface hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-4.5', isActive && 'text-accent')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <a href="/leaderboard" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm text-muted transition hover:border-line-strong hover:text-fg">
            Open booth display <ExternalLink className="size-3.5" />
          </a>
          <ThemeSwitcher compact className="w-fit" />
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-faint">Signed in</p>
              <p className="truncate text-xs text-fg">{user?.email}</p>
            </div>
            <button onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-danger">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar (mobile/tablet) */}
      <header className="glass sticky top-0 z-30 border-b border-line lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Wordmark to="/admin" compact />
          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            <button onClick={() => void signOut()} aria-label="Sign out" className="grid size-9 place-items-center rounded-lg text-muted hover:text-danger">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium', isActive ? 'bg-surface-2 text-fg' : 'text-muted')
              }
            >
              <Icon className="size-3.5" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-headline text-2xl text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
