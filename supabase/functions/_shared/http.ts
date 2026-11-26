// Shared HTTP helpers for Edge Functions.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

// Comma-separated list, e.g. "https://brainbattle.kaizenext.com,http://localhost:5173".
// Unset → allow any origin (fine: the API is public by design and token-authenticated).
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allow = ALLOWED.length === 0 ? '*' : ALLOWED.includes(origin) ? origin : ALLOWED[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function clientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

// Fixed-window, per-isolate limiter. Limits are deliberately generous because
// many students share one campus Wi-Fi IP; this only stops scripted abuse.
const buckets = new Map<string, { start: number; count: number }>()
export function rateLimit(key: string, perMinute: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now - b.start > 60_000) {
    buckets.set(key, { start: now, count: 1 })
    if (buckets.size > 20_000) buckets.clear()
    return
  }
  b.count++
  if (b.count > perMinute) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.')
  }
}
