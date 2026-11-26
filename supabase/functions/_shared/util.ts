// Pure helpers shared by Edge Functions.

/** Trim, collapse whitespace, strip control characters, cap length. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  // deno-lint-ignore no-control-regex
  return v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function isEmail(v: string) {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

/** Identity key: lowercase, drop +tags, and dots for Gmail (same inbox). */
export function normalizeEmail(email: string) {
  const [local, domain] = email.trim().toLowerCase().split('@')
  let l = local.split('+')[0]
  let d = domain
  if (d === 'googlemail.com') d = 'gmail.com'
  if (d === 'gmail.com') l = l.replace(/\./g, '')
  return `${l}@${d}`
}

/** Digits only; Bangladeshi local numbers (01XXXXXXXXX) are expanded to 8801XXXXXXXXX. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  if (/^01\d{9}$/.test(digits)) return `88${digits}`
  return digits
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Unbiased Fisher–Yates using crypto randomness. Returns a new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
    const j = Math.floor(r * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
