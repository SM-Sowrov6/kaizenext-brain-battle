export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 83_450 → "1:23.4" ; 9_800 → "9.8s" */
export function formatDuration(ms: number | null | undefined) {
  if (ms == null) return '—'
  const totalTenths = Math.round(ms / 100)
  const minutes = Math.floor(totalTenths / 600)
  const secs = (totalTenths % 600) / 10
  if (minutes === 0) return `${secs.toFixed(1)}s`
  return `${minutes}:${secs.toFixed(1).padStart(4, '0')}`
}

export function formatScore(n: number | null | undefined) {
  if (n == null) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', opts)
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Event range label, e.g. "Nov 28–29, 2026" */
export function eventRange(d1: string, d2: string) {
  const a = new Date(`${d1}T00:00:00`)
  const b = new Date(`${d2}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${d1} – ${d2}`
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const month = a.toLocaleDateString('en-US', { month: 'short' })
  return sameMonth
    ? `${month} ${a.getDate()}–${b.getDate()}, ${b.getFullYear()}`
    : `${formatDate(d1)} – ${formatDate(d2)}, ${b.getFullYear()}`
}
