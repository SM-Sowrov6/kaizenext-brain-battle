import { env } from '@/lib/env'
import { AppError } from './errors'
import type { ParticipantApi } from './types'

interface CallOptions {
  timeoutMs?: number
  /** Retries on network failure only (safe for idempotent actions). */
  retries?: number
}

async function call<T>(action: string, payload: Record<string, unknown> = {}, opts: CallOptions = {}): Promise<T> {
  const { timeoutMs = 12_000, retries = 1 } = opts
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: env.supabaseKey,
  }
  // Legacy anon keys are JWTs and may be sent as bearer; new publishable keys are not.
  if (env.supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${env.supabaseKey}`

  let lastErr: AppError | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(`${env.supabaseUrl}/functions/v1/quiz-api`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...payload }),
        signal: ctrl.signal,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const e = data?.error
        throw new AppError(e?.code ?? 'SERVER_ERROR', e?.message ?? `Request failed (${res.status}).`, e?.fields, res.status)
      }
      return data as T
    } catch (err) {
      if (err instanceof AppError) throw err // server answered — don't retry
      lastErr =
        err instanceof DOMException && err.name === 'AbortError'
          ? new AppError('TIMEOUT', 'The server took too long to respond.')
          : new AppError('NETWORK', 'Network error.')
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr!
}

export const supabaseParticipantApi: ParticipantApi = {
  getConfig: () => call('config', {}, { retries: 2 }),
  register: (input) => call('register', { ...input }, { retries: 0 }),
  getSession: (token) => call('session', { token }, { retries: 2 }),
  start: (token) => call('start', { token }, { retries: 2, timeoutMs: 15_000 }),
  save: (token, attemptId, answers) => call('save', { token, attemptId, answers }, { retries: 0, timeoutMs: 8_000 }),
  submit: (token, attemptId, answers, reason, kind) =>
    call('submit', { token, attemptId, answers, reason, kind }, { retries: 2, timeoutMs: 15_000 }),
  violation: (token, attemptId, kind, eventId) =>
    call('violation', { token, attemptId, kind, eventId }, { retries: 2, timeoutMs: 8_000 }),
  beaconViolation(token, attemptId, kind, eventId) {
    // text/plain + no custom headers = a "simple" request, so sendBeacon can deliver it
    // even while the page is being hidden, refreshed or closed.
    const body = new Blob([JSON.stringify({ action: 'violation', token, attemptId, kind, eventId })], { type: 'text/plain;charset=UTF-8' })
    const url = `${env.supabaseUrl}/functions/v1/quiz-api`
    const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, body)
    if (!sent) void fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => undefined)
  },
  result: (token) => call('result', { token }, { retries: 2 }),
  leaderboard: (day) => call('leaderboard', { day }, { retries: 1, timeoutMs: 10_000 }),
}
