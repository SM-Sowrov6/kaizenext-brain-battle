// ════════════════════════════════════════════════════════════════
//  Kaizenext Brain Battle — quiz-api Edge Function (Deno)
//
//  The only door participants use. It holds the service-role key
//  (injected by Supabase, never shipped to browsers) and is the sole
//  authority for: registration, question delivery (without answer
//  keys), answer persistence, time limits, scoring and leaderboards.
//
//  POST { action: string, ...payload }
// ════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ApiError, corsHeaders, json, rateLimit, clientIp } from '../_shared/http.ts'
import {
  normalizeEmail, normalizePhone, cleanText, isEmail, randomToken, sha256Hex, shuffle,
} from '../_shared/util.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// Server-only privileged key, injected by Supabase (never set by us, never sent to browsers).
// Newer projects expose `SUPABASE_SECRET_KEYS` ({"default":"sb_secret_…"}); older ones the legacy service-role JWT.
function resolveServerKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    if (keys.default) return keys.default
    const first = Object.values(keys)[0]
    if (first) return first
  } catch { /* fall through */ }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  throw new Error('No server key available: expected SUPABASE_SECRET_KEYS or SUPABASE_SERVICE_ROLE_KEY')
}
const SERVICE_ROLE_KEY = resolveServerKey()
const GRACE_MS = 15_000 // network latency allowance after the deadline
const MAX_BODY_BYTES = 32 * 1024

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Small in-isolate caches (absorb booth-scale polling) ──────────
let configCache: { at: number; value: Awaited<ReturnType<typeof loadConfigUncached>> } | null = null
const leaderboardCache = new Map<string, { at: number; value: unknown }>()
let lastExpirySweep = 0

type Settings = {
  event_name: string; venue: string; day1_date: string; day2_date: string; active_day: 1 | 2
  quiz_enabled: boolean; registration_enabled: boolean; active_quiz_id: string | null
  competition_info: string; rules: string[]; prizes: unknown[]; default_theme: string
}
type Quiz = {
  id: string; title: string; duration_seconds: number; question_count: number
  marks_per_question: number; negative_marking: boolean; negative_mark: number
  shuffle_questions: boolean; shuffle_options: boolean
}

async function loadConfigUncached() {
  const { data: settings, error } = await db.from('event_settings').select('*').eq('id', 1).single<Settings>()
  if (error || !settings) throw new ApiError(503, 'NOT_CONFIGURED', 'Event settings are missing. Run the database migration.')
  if (!settings.active_quiz_id) throw new ApiError(503, 'NOT_CONFIGURED', 'No active quiz configured.')
  const { data: quiz, error: qErr } = await db.from('quizzes').select('*').eq('id', settings.active_quiz_id).single<Quiz>()
  if (qErr || !quiz) throw new ApiError(503, 'NOT_CONFIGURED', 'Active quiz not found.')
  const { count } = await db
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quiz.id).eq('is_active', true).is('archived_at', null)
  return { settings, quiz, activeQuestions: count ?? 0 }
}

async function loadConfig(fresh = false) {
  if (!fresh && configCache && Date.now() - configCache.at < 3000) return configCache.value
  const value = await loadConfigUncached()
  configCache = { at: Date.now(), value }
  return value
}

async function authParticipant(token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
    throw new ApiError(401, 'INVALID_SESSION', 'Your session is missing or invalid. Please register again.')
  }
  const { data, error } = await db
    .from('participants')
    .select('id, full_name, university, department, event_day')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(401, 'INVALID_SESSION', 'Your session has expired or was reset. Please register again.')
  return data as { id: string; full_name: string; university: string; department: string; event_day: 1 | 2 }
}

// ── Actions ───────────────────────────────────────────────────────

async function actionConfig() {
  const { settings: s, quiz: q, activeQuestions } = await loadConfig()
  const questionCount = Math.min(q.question_count, activeQuestions)
  return {
    event: {
      name: s.event_name, venue: s.venue, day1Date: s.day1_date, day2Date: s.day2_date,
      activeDay: s.active_day, quizEnabled: s.quiz_enabled && questionCount > 0,
      registrationEnabled: s.registration_enabled, competitionInfo: s.competition_info,
      rules: s.rules ?? [], prizes: s.prizes ?? [], defaultTheme: s.default_theme,
    },
    quiz: {
      title: q.title, questionCount, durationSeconds: q.duration_seconds,
      marksPerQuestion: Number(q.marks_per_question),
      totalMarks: questionCount * Number(q.marks_per_question),
      negativeMarking: q.negative_marking, negativeMark: Number(q.negative_mark),
    },
  }
}

async function actionRegister(body: Record<string, unknown>, req: Request) {
  const { settings } = await loadConfig(true)
  if (!settings.registration_enabled) throw new ApiError(403, 'REGISTRATION_CLOSED', 'Registration is closed right now. Please check with the Kaizenext booth.')

  const fullName = cleanText(body.fullName, 80)
  const email = cleanText(body.email, 254).toLowerCase()
  const university = cleanText(body.university, 120)
  const department = cleanText(body.department, 120)
  const phoneRaw = cleanText(body.phone, 30)
  const fields: Record<string, string> = {}
  if (fullName.length < 2) fields.fullName = 'Please enter your full name.'
  if (!isEmail(email)) fields.email = 'Please enter a valid email address.'
  if (university.length < 2) fields.university = 'Please enter your university.'
  if (department.length < 2) fields.department = 'Please enter your department.'
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null
  if (phoneRaw && !phone) fields.phone = 'Please enter a valid phone number.'
  if (body.consent !== true) fields.consent = 'Please accept the data notice to continue.'
  if (Object.keys(fields).length) throw new ApiError(422, 'VALIDATION', 'Please check the highlighted fields.', fields)

  const token = randomToken()
  const { data, error } = await db
    .from('participants')
    .insert({
      full_name: fullName, email, email_normalized: normalizeEmail(email),
      phone: phoneRaw || null, phone_normalized: phone,
      university, department, event_day: settings.active_day,
      token_hash: await sha256Hex(token), consent_at: new Date().toISOString(),
      user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
    })
    .select('id, full_name')
    .single()
  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('phone')) {
        throw new ApiError(409, 'PHONE_TAKEN', 'This phone number has already been used to participate.', { phone: 'Already registered.' })
      }
      throw new ApiError(409, 'EMAIL_TAKEN', 'This email has already been used. Each participant can play once — if you were interrupted, please visit the Kaizenext booth.', { email: 'Already registered.' })
    }
    throw error
  }
  return { token, participantId: data.id, fullName: data.full_name }
}

async function actionSession(body: Record<string, unknown>) {
  const p = await authParticipant(body.token)
  const { data: attempt } = await db
    .from('attempts').select('id, status, deadline_at').eq('participant_id', p.id).maybeSingle()
  let status: 'none' | 'in_progress' | 'submitted' = attempt ? attempt.status : 'none'
  if (attempt?.status === 'in_progress' && Date.parse(attempt.deadline_at) + GRACE_MS < Date.now()) {
    await db.rpc('finalize_attempt', { p_attempt_id: attempt.id, p_reason: 'expired' })
    status = 'submitted'
  }
  return {
    participant: { id: p.id, fullName: p.full_name, university: p.university, department: p.department, eventDay: p.event_day },
    attemptStatus: status,
  }
}

type AttemptRow = {
  id: string; participant_id: string; status: 'in_progress' | 'submitted'; question_ids: string[]
  option_order: Record<string, string[]>; started_at: string; deadline_at: string; negative_mark: number
  event_day: 1 | 2
}

async function buildAttemptState(a: AttemptRow, durationSeconds: number, negativeMarking: boolean) {
  const [{ data: qs, error: qe }, { data: opts, error: oe }, { data: ans, error: ae }] = await Promise.all([
    db.from('questions').select('id, prompt, marks').in('id', a.question_ids),
    db.from('question_options').select('id, question_id, text').in('question_id', a.question_ids), // never is_correct
    db.from('participant_answers').select('question_id, option_id').eq('attempt_id', a.id),
  ])
  if (qe || oe || ae) throw qe ?? oe ?? ae
  const qMap = new Map(qs!.map((q) => [q.id, q]))
  const oMap = new Map(opts!.map((o) => [o.id, o]))
  const questions = a.question_ids
    .filter((id) => qMap.has(id))
    .map((id) => {
      const q = qMap.get(id)!
      const order = a.option_order[id] ?? opts!.filter((o) => o.question_id === id).map((o) => o.id)
      return {
        id, prompt: q.prompt, marks: Number(q.marks),
        options: order.filter((oid) => oMap.has(oid)).map((oid) => ({ id: oid, text: oMap.get(oid)!.text })),
      }
    })
  const answers: Record<string, string> = {}
  for (const r of ans!) answers[r.question_id] = r.option_id
  return {
    status: 'in_progress' as const, attemptId: a.id, questions, answers,
    startedAt: a.started_at, deadlineAt: a.deadline_at, serverNow: new Date().toISOString(),
    durationSeconds, negativeMarking, negativeMark: Number(a.negative_mark),
  }
}

async function actionStart(body: Record<string, unknown>) {
  const p = await authParticipant(body.token)
  const { settings, quiz } = await loadConfig(true)

  const { data: existing } = await db.from('attempts').select('*').eq('participant_id', p.id).maybeSingle<AttemptRow>()
  if (existing) {
    if (existing.status === 'submitted') return { status: 'submitted', attemptId: existing.id }
    if (Date.parse(existing.deadline_at) + GRACE_MS < Date.now()) {
      await db.rpc('finalize_attempt', { p_attempt_id: existing.id, p_reason: 'expired' })
      return { status: 'submitted', attemptId: existing.id }
    }
    return buildAttemptState(existing, quiz.duration_seconds, quiz.negative_marking)
  }

  if (!settings.quiz_enabled) throw new ApiError(403, 'QUIZ_CLOSED', 'The quiz is not live right now. Please check back shortly.')

  const { data: pool, error: pe } = await db
    .from('questions').select('id, position')
    .eq('quiz_id', quiz.id).eq('is_active', true).is('archived_at', null)
    .order('position', { ascending: true })
  if (pe) throw pe
  if (!pool || pool.length === 0) throw new ApiError(503, 'QUIZ_NOT_READY', 'Questions are not ready yet. Please check back shortly.')

  const picked = (quiz.shuffle_questions ? shuffle(pool) : pool).slice(0, quiz.question_count).map((q) => q.id)
  const { data: opts, error: oe } = await db
    .from('question_options').select('id, question_id, position').in('question_id', picked).order('position')
  if (oe) throw oe
  const optionOrder: Record<string, string[]> = {}
  for (const qid of picked) {
    const ids = opts!.filter((o) => o.question_id === qid).map((o) => o.id)
    optionOrder[qid] = quiz.shuffle_options ? shuffle(ids) : ids
  }

  const now = Date.now()
  const { data: created, error: ce } = await db
    .from('attempts')
    .insert({
      participant_id: p.id, quiz_id: quiz.id, event_day: settings.active_day,
      question_ids: picked, option_order: optionOrder,
      negative_mark: quiz.negative_marking ? quiz.negative_mark : 0,
      started_at: new Date(now).toISOString(),
      deadline_at: new Date(now + quiz.duration_seconds * 1000).toISOString(),
    })
    .select('*')
    .single<AttemptRow>()
  if (ce) {
    if (ce.code === '23505') {
      // Double-tap / two tabs: return the attempt that won the race
      const { data: again } = await db.from('attempts').select('*').eq('participant_id', p.id).single<AttemptRow>()
      if (again!.status === 'submitted') return { status: 'submitted', attemptId: again!.id }
      return buildAttemptState(again!, quiz.duration_seconds, quiz.negative_marking)
    }
    throw ce
  }
  return buildAttemptState(created!, quiz.duration_seconds, quiz.negative_marking)
}

async function loadOwnAttempt(participantId: string, attemptId: unknown) {
  if (typeof attemptId !== 'string') throw new ApiError(400, 'BAD_REQUEST', 'attemptId is required.')
  const { data } = await db.from('attempts').select('*').eq('id', attemptId).eq('participant_id', participantId).maybeSingle<AttemptRow>()
  if (!data) throw new ApiError(404, 'ATTEMPT_NOT_FOUND', 'Quiz attempt not found.')
  return data
}

async function applyAnswers(a: AttemptRow, answers: unknown) {
  if (!answers || typeof answers !== 'object') return 0
  const entries = Object.entries(answers as Record<string, unknown>).slice(0, 200)
  const upserts: { attempt_id: string; question_id: string; option_id: string; answered_at: string }[] = []
  const clears: string[] = []
  const now = new Date().toISOString()
  for (const [qid, oid] of entries) {
    const allowed = a.option_order[qid]
    if (!allowed) continue // not part of this attempt → ignore silently
    if (oid === null) clears.push(qid)
    else if (typeof oid === 'string' && allowed.includes(oid)) upserts.push({ attempt_id: a.id, question_id: qid, option_id: oid, answered_at: now })
  }
  if (upserts.length) {
    const { error } = await db.from('participant_answers').upsert(upserts, { onConflict: 'attempt_id,question_id' })
    if (error) throw error
  }
  if (clears.length) {
    const { error } = await db.from('participant_answers').delete().eq('attempt_id', a.id).in('question_id', clears)
    if (error) throw error
  }
  return upserts.length + clears.length
}

async function actionSave(body: Record<string, unknown>) {
  const p = await authParticipant(body.token)
  const a = await loadOwnAttempt(p.id, body.attemptId)
  if (a.status !== 'in_progress') throw new ApiError(409, 'ATTEMPT_CLOSED', 'This quiz has already been submitted.')
  if (Date.now() > Date.parse(a.deadline_at) + GRACE_MS) {
    await db.rpc('finalize_attempt', { p_attempt_id: a.id, p_reason: 'expired' })
    throw new ApiError(409, 'ATTEMPT_CLOSED', 'Time is up — your quiz has been submitted.')
  }
  const saved = await applyAnswers(a, body.answers)
  return { ok: true, saved, serverNow: new Date().toISOString() }
}

async function buildResult(attemptId: string) {
  const { data: a, error } = await db
    .from('attempts')
    .select('id, event_day, score, max_score, correct_count, incorrect_count, unanswered_count, duration_ms, submitted_at, submit_reason, question_ids, participants(full_name)')
    .eq('id', attemptId).single()
  if (error || !a) throw error ?? new ApiError(404, 'ATTEMPT_NOT_FOUND', 'Result not found.')
  const [day, overall] = await Promise.all([
    db.rpc('get_attempt_rank', { p_attempt_id: attemptId, p_day: a.event_day }).single<{ rank: number; total: number }>(),
    db.rpc('get_attempt_rank', { p_attempt_id: attemptId, p_day: null }).single<{ rank: number; total: number }>(),
  ])
  // deno-lint-ignore no-explicit-any
  const participant = (a as any).participants
  return {
    attemptId: a.id,
    fullName: Array.isArray(participant) ? participant[0]?.full_name : participant?.full_name,
    score: Number(a.score), maxScore: Number(a.max_score),
    correct: a.correct_count, incorrect: a.incorrect_count, unanswered: a.unanswered_count,
    totalQuestions: a.question_ids.length, durationMs: a.duration_ms, submittedAt: a.submitted_at,
    eventDay: a.event_day, submitReason: a.submit_reason,
    rankDay: Number(day.data?.rank ?? 0), finishersDay: Number(day.data?.total ?? 0),
    rankOverall: Number(overall.data?.rank ?? 0), finishersOverall: Number(overall.data?.total ?? 0),
  }
}

async function actionSubmit(body: Record<string, unknown>) {
  const p = await authParticipant(body.token)
  const a = await loadOwnAttempt(p.id, body.attemptId)
  if (a.status === 'in_progress') {
    if (Date.now() <= Date.parse(a.deadline_at) + GRACE_MS) await applyAnswers(a, body.answers)
    const reason = body.reason === 'timeout' ? 'timeout' : 'manual'
    const { error } = await db.rpc('finalize_attempt', { p_attempt_id: a.id, p_reason: reason })
    if (error) throw error
    leaderboardCache.clear()
  }
  return buildResult(a.id) // idempotent: repeated submits return the same result
}

async function actionResult(body: Record<string, unknown>) {
  const p = await authParticipant(body.token)
  const { data: a } = await db.from('attempts').select('id, status, deadline_at').eq('participant_id', p.id).maybeSingle()
  if (!a) throw new ApiError(404, 'NO_ATTEMPT', 'You have not taken the quiz yet.')
  if (a.status === 'in_progress') {
    if (Date.parse(a.deadline_at) + GRACE_MS < Date.now()) {
      await db.rpc('finalize_attempt', { p_attempt_id: a.id, p_reason: 'expired' })
    } else {
      throw new ApiError(409, 'ATTEMPT_IN_PROGRESS', 'Your quiz is still in progress.')
    }
  }
  return buildResult(a.id)
}

async function actionLeaderboard(body: Record<string, unknown>) {
  const scope = body.day === 1 || body.day === 2 ? body.day : 'all'
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50)
  const key = `${scope}:${limit}`
  const cached = leaderboardCache.get(key)
  if (cached && Date.now() - cached.at < 2500) return cached.value

  if (Date.now() - lastExpirySweep > 15_000) {
    lastExpirySweep = Date.now()
    await db.rpc('finalize_expired_attempts', { p_grace_seconds: Math.ceil(GRACE_MS / 1000) + 5 })
  }
  const { settings } = await loadConfig()
  const dayArg = scope === 'all' ? null : scope

  let pq = db.from('participants').select('id', { count: 'exact', head: true })
  let cq = db.from('attempts').select('id', { count: 'exact', head: true }).eq('status', 'submitted').eq('disqualified', false)
  if (dayArg) { pq = pq.eq('event_day', dayArg); cq = cq.eq('event_day', dayArg) }

  const [{ data: rows, error }, { count: participants }, { count: completed }] = await Promise.all([
    db.rpc('get_leaderboard', { p_day: dayArg, p_limit: limit }),
    pq, cq,
  ])
  if (error) throw error
  const value = {
    scope,
    // deno-lint-ignore no-explicit-any
    entries: (rows ?? []).map((r: any) => ({
      rank: Number(r.rank), attemptId: r.attempt_id, name: r.display_name, university: r.university,
      department: r.department, score: Number(r.score), maxScore: Number(r.max_score),
      correct: r.correct_count, durationMs: r.duration_ms, submittedAt: r.submitted_at,
    })),
    stats: { participants: participants ?? 0, completed: completed ?? 0 },
    activeDay: settings.active_day,
    updatedAt: new Date().toISOString(),
  }
  leaderboardCache.set(key, { at: Date.now(), value })
  return value
}

const LIMITS: Record<string, number> = {
  register: 40, start: 60, save: 900, submit: 60, leaderboard: 600, config: 600, session: 300, result: 300,
}

const handlers: Record<string, (body: Record<string, unknown>, req: Request) => Promise<unknown>> = {
  config: () => actionConfig(),
  register: actionRegister,
  session: actionSession,
  start: actionStart,
  save: actionSave,
  submit: actionSubmit,
  result: actionResult,
  leaderboard: actionLeaderboard,
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.')
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) throw new ApiError(413, 'TOO_LARGE', 'Request too large.')
    let body: Record<string, unknown>
    try { body = JSON.parse(raw || '{}') } catch { throw new ApiError(400, 'BAD_JSON', 'Malformed request.') }
    const action = String(body.action ?? '')
    const handler = handlers[action]
    if (!handler) throw new ApiError(400, 'UNKNOWN_ACTION', 'Unknown action.')
    rateLimit(`${clientIp(req)}:${action}`, LIMITS[action] ?? 120)
    return json(await handler(body, req), 200, cors)
  } catch (err) {
    if (err instanceof ApiError) {
      return json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status, cors)
    }
    console.error('[quiz-api] unexpected error', err)
    return json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again.' } }, 500, cors)
  }
})
