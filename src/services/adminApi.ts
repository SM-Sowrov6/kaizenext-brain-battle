import { getSupabase } from '@/lib/supabase'
import type {
  DrawWinner,
  AdminAttemptSummary, AdminParticipant, AdminQuestion, AdminStats, EventSettings, QuizSettings,
} from '@/types'
import { AppError } from './errors'
import type { AdminApi, AdminPoolEntry, AdminUser } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

function fail(error: { message: string; code?: string } | null): never {
  const msg = error?.message ?? 'Request failed'
  if (msg.includes('NOT_AUTHORIZED') || error?.code === '42501') {
    throw new AppError('NOT_AUTHORIZED', 'Your account is not authorised for this action.')
  }
  if (msg.toLowerCase().includes('failed to fetch')) throw new AppError('NETWORK', 'Network error.')
  throw new AppError(error?.code ?? 'DB_ERROR', msg)
}

/** Page through PostgREST's 1000-row cap. */
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: any }>) {
  const page = 1000
  const out: Row[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1)
    if (error) fail(error)
    out.push(...(data ?? []))
    if (!data || data.length < page) break
  }
  return out
}

async function activeQuizId(): Promise<string> {
  const { data, error } = await getSupabase().from('event_settings').select('active_quiz_id').eq('id', 1).single()
  if (error) fail(error)
  if (!data?.active_quiz_id) throw new AppError('NOT_CONFIGURED', 'No active quiz is configured in event_settings.')
  return data.active_quiz_id
}

const mapSettings = (r: Row): EventSettings => ({
  eventName: r.event_name, venue: r.venue, day1Date: r.day1_date, day2Date: r.day2_date,
  activeDay: r.active_day, quizEnabled: r.quiz_enabled, registrationEnabled: r.registration_enabled,
  competitionInfo: r.competition_info, rules: r.rules ?? [], prizes: r.prizes ?? [],
})

const mapQuiz = (r: Row): QuizSettings => ({
  id: r.id, title: r.title, durationSeconds: r.duration_seconds, questionCount: r.question_count,
  marksPerQuestion: Number(r.marks_per_question), negativeMarking: r.negative_marking,
  negativeMark: Number(r.negative_mark), shuffleQuestions: r.shuffle_questions, shuffleOptions: r.shuffle_options,
  maxViolations: r.max_violations ?? 2,
})

const num = (v: any) => (v == null ? null : Number(v))

const mapWinner = (w: Row): DrawWinner => ({
  id: w.id, position: Number(w.prize_position), attemptId: w.attempt_id, name: w.display_name,
  university: w.university, department: w.department, drawnAt: w.drawn_at,
})

const mapAttempt = (a: Row | null | undefined): AdminAttemptSummary | null =>
  a
    ? {
        id: a.id, status: a.status, eventDay: a.event_day, score: num(a.score), maxScore: num(a.max_score),
        correct: a.correct_count, incorrect: a.incorrect_count, unanswered: a.unanswered_count,
        durationMs: a.duration_ms, startedAt: a.started_at, submittedAt: a.submitted_at,
        submitReason: a.submit_reason, flagged: a.flagged, flagReasons: a.flag_reasons ?? [],
        disqualified: a.disqualified,
      }
    : null

async function requireAdmin(userId: string, email: string): Promise<AdminUser> {
  const { data, error } = await getSupabase().from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) fail(error)
  if (!data) {
    await getSupabase().auth.signOut()
    throw new AppError('NOT_ADMIN', 'This account does not have admin access.')
  }
  return { id: userId, email }
}

export const supabaseAdminApi: AdminApi = {
  async getUser() {
    const { data } = await getSupabase().auth.getSession()
    const user = data.session?.user
    if (!user) return null
    try {
      return await requireAdmin(user.id, user.email ?? '')
    } catch {
      return null
    }
  },

  async signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) throw new AppError('AUTH', error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message)
    return requireAdmin(data.user.id, data.user.email ?? email)
  },

  async signOut() {
    await getSupabase().auth.signOut()
  },

  async getStats() {
    const sb = getSupabase()
    const [participants, attempts] = await Promise.all([
      fetchAll((f, t) => sb.from('participants').select('event_day').range(f, t)),
      fetchAll((f, t) => sb.from('attempts').select('status, score, max_score, event_day, flagged, disqualified').range(f, t)),
    ])
    const done = attempts.filter((a) => a.status === 'submitted' && !a.disqualified)
    const scores = done.map((a) => Number(a.score))
    const stats: AdminStats = {
      totalRegistrations: participants.length,
      totalCompleted: done.length,
      inProgress: attempts.filter((a) => a.status === 'in_progress').length,
      averageScore: scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null,
      highestScore: scores.length ? Math.max(...scores) : null,
      maxScore: done.length ? Math.max(...done.map((a) => Number(a.max_score))) : null,
      byDay: ([1, 2] as const).map((day) => ({
        day,
        registrations: participants.filter((p) => p.event_day === day).length,
        completed: done.filter((a) => a.event_day === day).length,
      })),
      flagged: attempts.filter((a) => a.flagged && !a.disqualified).length,
    }
    return stats
  },

  async getQuiz() {
    const id = await activeQuizId()
    const { data, error } = await getSupabase().from('quizzes').select('*').eq('id', id).single()
    if (error) fail(error)
    return mapQuiz(data)
  },

  async updateQuiz(patch) {
    const id = await activeQuizId()
    const row: Row = {}
    if (patch.title !== undefined) row.title = patch.title
    if (patch.durationSeconds !== undefined) row.duration_seconds = patch.durationSeconds
    if (patch.questionCount !== undefined) row.question_count = patch.questionCount
    if (patch.marksPerQuestion !== undefined) row.marks_per_question = patch.marksPerQuestion
    if (patch.negativeMarking !== undefined) row.negative_marking = patch.negativeMarking
    if (patch.negativeMark !== undefined) row.negative_mark = patch.negativeMark
    if (patch.shuffleQuestions !== undefined) row.shuffle_questions = patch.shuffleQuestions
    if (patch.shuffleOptions !== undefined) row.shuffle_options = patch.shuffleOptions
    if (patch.maxViolations !== undefined) row.max_violations = patch.maxViolations
    const { data, error } = await getSupabase().from('quizzes').update(row).eq('id', id).select('*').single()
    if (error) fail(error)
    return mapQuiz(data)
  },

  async getSettings() {
    const { data, error } = await getSupabase().from('event_settings').select('*').eq('id', 1).single()
    if (error) fail(error)
    return mapSettings(data)
  },

  async updateSettings(patch) {
    const row: Row = {}
    if (patch.eventName !== undefined) row.event_name = patch.eventName
    if (patch.venue !== undefined) row.venue = patch.venue
    if (patch.day1Date !== undefined) row.day1_date = patch.day1Date
    if (patch.day2Date !== undefined) row.day2_date = patch.day2Date
    if (patch.activeDay !== undefined) row.active_day = patch.activeDay
    if (patch.quizEnabled !== undefined) row.quiz_enabled = patch.quizEnabled
    if (patch.registrationEnabled !== undefined) row.registration_enabled = patch.registrationEnabled
    if (patch.competitionInfo !== undefined) row.competition_info = patch.competitionInfo
    if (patch.rules !== undefined) row.rules = patch.rules
    if (patch.prizes !== undefined) row.prizes = patch.prizes
    const { data, error } = await getSupabase().from('event_settings').update(row).eq('id', 1).select('*').single()
    if (error) fail(error)
    return mapSettings(data)
  },

  async listQuestions() {
    const quizId = await activeQuizId()
    const rows = await fetchAll((f, t) =>
      getSupabase()
        .from('questions')
        .select('id, prompt, marks, is_active, position, created_at, question_options(id, position, text, is_correct)')
        .eq('quiz_id', quizId)
        .is('archived_at', null)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .range(f, t),
    )
    return rows.map(
      (q): AdminQuestion => ({
        id: q.id, prompt: q.prompt, marks: Number(q.marks), isActive: q.is_active, position: q.position,
        createdAt: q.created_at,
        options: (q.question_options ?? [])
          .sort((a: Row, b: Row) => a.position - b.position)
          .map((o: Row) => ({ id: o.id, position: o.position, text: o.text, isCorrect: o.is_correct })),
      }),
    )
  },

  async saveQuestion(d) {
    const quizId = await activeQuizId()
    const { data, error } = await getSupabase().rpc('admin_save_question', {
      p_id: d.id ?? null, p_quiz_id: quizId, p_prompt: d.prompt, p_marks: d.marks, p_is_active: d.isActive,
      p_options: d.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    })
    if (error) fail(error)
    return data as string
  },

  async deleteQuestion(id) {
    const { data, error } = await getSupabase().rpc('admin_delete_question', { p_id: id })
    if (error) fail(error)
    return data as 'deleted' | 'archived'
  },

  async setQuestionActive(id, active) {
    const { error } = await getSupabase().from('questions').update({ is_active: active }).eq('id', id)
    if (error) fail(error)
  },

  async listParticipants() {
    const rows = await fetchAll((f, t) =>
      getSupabase()
        .from('participants')
        .select('id, full_name, email, phone, university, department, event_day, created_at, attempts(*)')
        .order('created_at', { ascending: false })
        .range(f, t),
    )
    return rows.map(
      (p): AdminParticipant => ({
        id: p.id, fullName: p.full_name, email: p.email, phone: p.phone, university: p.university,
        department: p.department, eventDay: p.event_day, createdAt: p.created_at,
        attempt: mapAttempt(Array.isArray(p.attempts) ? p.attempts[0] : p.attempts),
      }),
    )
  },

  async getAttemptAnswers(attemptId) {
    const sb = getSupabase()
    const { data: a, error } = await sb.from('attempts').select('question_ids, option_order').eq('id', attemptId).single()
    if (error) fail(error)
    const ids: string[] = a.question_ids
    const [{ data: qs, error: e1 }, { data: ans, error: e2 }] = await Promise.all([
      sb.from('questions').select('id, prompt, marks, question_options(id, position, text, is_correct)').in('id', ids),
      sb.from('participant_answers').select('question_id, option_id, is_correct, answered_at').eq('attempt_id', attemptId),
    ])
    if (e1) fail(e1)
    if (e2) fail(e2)
    const qMap = new Map((qs ?? []).map((q: Row) => [q.id, q]))
    const aMap = new Map((ans ?? []).map((r: Row) => [r.question_id, r]))
    return ids
      .filter((id) => qMap.has(id))
      .map((id) => {
        const q = qMap.get(id)!
        const r = aMap.get(id)
        const opts = (q.question_options ?? []).sort((x: Row, y: Row) => x.position - y.position)
        return {
          questionId: id, prompt: q.prompt, marks: Number(q.marks),
          options: opts.map((o: Row) => ({ id: o.id, text: o.text, isCorrect: o.is_correct })),
          selectedOptionId: r?.option_id ?? null,
          isCorrect: r ? (r.is_correct ?? opts.find((o: Row) => o.id === r.option_id)?.is_correct ?? false) : null,
          answeredAt: r?.answered_at ?? null,
        }
      })
  },

  async deleteParticipant(id) {
    const { error } = await getSupabase().from('participants').delete().eq('id', id)
    if (error) fail(error)
  },

  async setDisqualified(attemptId, value) {
    const { error } = await getSupabase().from('attempts').update({ disqualified: value }).eq('id', attemptId)
    if (error) fail(error)
  },

  async getDrawPool(day) {
    const sb = getSupabase()
    const { data, error } = await sb.rpc('get_draw_pool', { p_day: day })
    if (error) fail(error)
    const rows = (data ?? []) as Row[]
    if (!rows.length) return []
    // contact details for winners (admin-only via RLS)
    const { data: contacts, error: ce } = await sb
      .from('attempts').select('id, participants(email, phone)').in('id', rows.map((r) => r.attempt_id))
    if (ce) fail(ce)
    const byId = new Map((contacts ?? []).map((c: Row) => [c.id, Array.isArray(c.participants) ? c.participants[0] : c.participants]))
    return rows.map((r): AdminPoolEntry => ({
      attemptId: r.attempt_id, name: r.display_name, email: byId.get(r.attempt_id)?.email ?? '',
      phone: byId.get(r.attempt_id)?.phone ?? null, university: r.university, department: r.department,
      score: Number(r.score), maxScore: Number(r.max_score), submittedAt: r.submitted_at,
    }))
  },

  async getDrawWinners(day) {
    const { data, error } = await getSupabase().rpc('get_draw_winners', { p_day: day })
    if (error) fail(error)
    return ((data ?? []) as Row[]).map(mapWinner)
  },

  async drawWinner(day, position) {
    const { data, error } = await getSupabase().rpc('admin_draw_winner', { p_day: day, p_position: position })
    if (error) fail(error)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new AppError('DRAW_FAILED', 'The draw did not return a winner.')
    return mapWinner(row)
  },

  async voidWinner(id) {
    const { error } = await getSupabase().rpc('admin_void_winner', { p_id: id })
    if (error) fail(error)
  },

  async resetData(confirm) {
    const { data, error } = await getSupabase().rpc('admin_reset_data', { p_confirm: confirm })
    if (error) fail(error)
    return Number(data)
  },
}
