/**
 * ─────────────────────────────────────────────────────────────────
 *  DEVELOPMENT-ONLY demo backend.
 *  Persists to localStorage and mirrors the server rules (one attempt,
 *  server-side deadline, scoring, ranking) so every screen can be tested
 *  without Supabase. It is excluded from production bundles — see
 *  services/index.ts.
 * ─────────────────────────────────────────────────────────────────
 */
import type {
  AdminParticipant, AdminQuestion, AttemptResult, EventDay, EventSettings, LeaderboardEntry,
  PublicConfig, QuizSettings, SubmitReason,
} from '@/types'
import { AppError } from './errors'
import type { AdminApi, AnswerMap, ParticipantApi } from './types'

const DB_KEY = 'kbb.demo.db.v1'
const ADMIN_KEY = 'kbb.demo.admin'
const GRACE_MS = 15_000

interface DemoOption { id: string; position: number; text: string; isCorrect: boolean }
interface DemoQuestion { id: string; prompt: string; marks: number; isActive: boolean; position: number; createdAt: string; archived: boolean; options: DemoOption[] }
interface DemoParticipant { id: string; token: string; fullName: string; email: string; emailKey: string; phone: string | null; phoneKey: string | null; university: string; department: string; eventDay: EventDay; createdAt: string }
interface DemoAttempt {
  id: string; participantId: string; eventDay: EventDay; status: 'in_progress' | 'submitted'
  questionIds: string[]; optionOrder: Record<string, string[]>; negativeMark: number
  startedAt: string; deadlineAt: string; submittedAt: string | null; submitReason: SubmitReason | null
  durationMs: number | null; score: number | null; maxScore: number | null
  correct: number | null; incorrect: number | null; unanswered: number | null
  flagged: boolean; flagReasons: string[]; disqualified: boolean
  answers: Record<string, { optionId: string; answeredAt: string; isCorrect?: boolean }>
}
interface DemoDB { settings: EventSettings; quiz: QuizSettings; questions: DemoQuestion[]; participants: DemoParticipant[]; attempts: DemoAttempt[] }

const uid = () => crypto.randomUUID()
const delay = (ms = 120 + Math.random() * 220) => new Promise((r) => setTimeout(r, ms))

const SAMPLE: [string, string[], number][] = [
  ['What does "AI" stand for in technology?', ['Automated Interface', 'Artificial Intelligence', 'Advanced Internet', 'Algorithmic Integration'], 1],
  ['Which company developed the Android operating system (acquired in 2005)?', ['Apple', 'Microsoft', 'Google', 'Samsung'], 2],
  ['Which language is primarily used to style web pages?', ['HTML', 'Python', 'CSS', 'SQL'], 2],
  ['What does "SQL" stand for?', ['Structured Query Language', 'Simple Question Logic', 'Sequential Query Layer', 'System Query Link'], 0],
  ['Which data structure works on the First-In, First-Out (FIFO) principle?', ['Stack', 'Queue', 'Tree', 'Graph'], 1],
  ['In machine learning, what is "overfitting"?', ['A model that is too small to learn', 'A model that memorises training data and generalises poorly', 'A model that trains too fast', 'A model with no parameters'], 1],
  ['What is the binary representation of the decimal number 10?', ['1010', '1100', '1001', '0110'], 0],
  ['Which of these is NOT a programming language?', ['Rust', 'Kotlin', 'Figma', 'Go'], 2],
  ['What does "HTTP" stand for?', ['HyperText Transfer Protocol', 'High Transfer Text Process', 'Hyperlink Text Transmission Program', 'Host Transfer Type Protocol'], 0],
  ['What is the capital of Bangladesh?', ['Chattogram', 'Khulna', 'Sylhet', 'Dhaka'], 3],
  ['What is the best first step when preparing for a job interview?', ['Memorise random facts', 'Research the company and the role', 'Skip reading the job description', 'Arrive without a CV'], 1],
  ['Which of these is a version control system?', ['Docker', 'Git', 'Nginx', 'Redis'], 1],
  ['Which number comes next: 2, 6, 12, 20, 30, ?', ['40', '42', '36', '44'], 1],
  ['Which time complexity describes binary search on a sorted array?', ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'], 2],
  ['If a task takes 3 people 6 days, how long does it take 6 people (same pace)?', ['12 days', '3 days', '2 days', '9 days'], 1],
]

const DEMO_PEOPLE: [string, string, string, EventDay][] = [
  ['Nusrat Jahan', 'Daffodil International University', 'CSE', 1],
  ['Tanvir Ahmed', 'Daffodil International University', 'SWE', 1],
  ['Farhana Akter', 'Daffodil International University', 'EEE', 1],
  ['Rakib Hasan', 'Daffodil International University', 'CSE', 1],
  ['Sadia Islam', 'Daffodil International University', 'BBA', 1],
  ['Mehedi Hasan', 'Daffodil International University', 'MCT', 2],
  ['Anika Rahman', 'Daffodil International University', 'CSE', 2],
  ['Imran Hossain', 'Daffodil International University', 'Textile Engineering', 2],
]

function seed(): DemoDB {
  const now = Date.now()
  const quiz: QuizSettings = {
    id: uid(), title: 'Brain Battle', durationSeconds: 300, questionCount: 10, marksPerQuestion: 1,
    negativeMarking: false, negativeMark: 0.25, shuffleQuestions: true, shuffleOptions: true,
  }
  const questions: DemoQuestion[] = SAMPLE.map(([prompt, opts, c], i) => ({
    id: uid(), prompt, marks: 1, isActive: true, position: i, archived: false,
    createdAt: new Date(now - (SAMPLE.length - i) * 60_000).toISOString(),
    options: opts.map((text, p) => ({ id: uid(), position: p, text, isCorrect: p === c })),
  }))
  const db: DemoDB = {
    quiz, questions, participants: [], attempts: [],
    settings: {
      eventName: 'DIU Job Utsob 2026', venue: 'Daffodil International University',
      day1Date: '2026-11-28', day2Date: '2026-11-29', activeDay: 1, quizEnabled: true, registrationEnabled: true,
      competitionInfo: 'Answer quick-fire questions on technology, AI, careers and general knowledge. The highest score wins — if scores tie, the fastest finisher takes the lead.',
      rules: [
        'One attempt per participant. Your email can only be used once.',
        'The timer starts as soon as you press Start Quiz and cannot be paused.',
        'Your quiz is submitted automatically when the timer reaches zero.',
        'Ties are broken by completion time, then by earliest submission.',
        'Use of other people, devices or AI tools during the quiz leads to disqualification.',
        'Winners must show their registered email at the Kaizenext booth to claim prizes.',
      ],
      prizes: [
        { place: 'Champion', title: 'Grand Prize', description: 'Top scorer of each day. Prize revealed at the Kaizenext booth.' },
        { place: '2nd Place', title: 'Runner-up Prize', description: 'Second highest score of each day.' },
        { place: '3rd Place', title: 'Third Place Prize', description: 'Third highest score of each day.' },
      ],
      defaultTheme: 'midnight',
    },
  }
  // Demo finishers so the leaderboard is not empty in development.
  DEMO_PEOPLE.forEach(([name, uni, dept, day], i) => {
    const p: DemoParticipant = {
      id: uid(), token: uid(), fullName: name, email: `demo${i + 1}@example.com`, emailKey: `demo${i + 1}@example.com`,
      phone: null, phoneKey: null, university: uni, department: dept, eventDay: day,
      createdAt: new Date(now - (20 - i) * 300_000).toISOString(),
    }
    db.participants.push(p)
    const picked = shuffle(questions).slice(0, quiz.questionCount)
    const started = Date.parse(p.createdAt) + 60_000
    const a: DemoAttempt = {
      id: uid(), participantId: p.id, eventDay: day, status: 'in_progress',
      questionIds: picked.map((q) => q.id), optionOrder: Object.fromEntries(picked.map((q) => [q.id, q.options.map((o) => o.id)])),
      negativeMark: 0, startedAt: new Date(started).toISOString(), deadlineAt: new Date(started + quiz.durationSeconds * 1000).toISOString(),
      submittedAt: null, submitReason: null, durationMs: null, score: null, maxScore: null, correct: null, incorrect: null,
      unanswered: null, flagged: false, flagReasons: [], disqualified: false, answers: {},
    }
    const skill = 0.55 + Math.random() * 0.4
    picked.forEach((q) => {
      if (Math.random() < 0.08) return
      const right = Math.random() < skill
      const opt = right ? q.options.find((o) => o.isCorrect)! : q.options.filter((o) => !o.isCorrect)[Math.floor(Math.random() * 3)]
      a.answers[q.id] = { optionId: opt.id, answeredAt: new Date(started + 20_000).toISOString() }
    })
    db.attempts.push(a)
    finalize(db, a, 'manual', started + (70 + Math.random() * 200) * 1000)
  })
  return db
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function load(): DemoDB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as DemoDB
  } catch { /* reseed */ }
  const db = seed()
  save(db)
  return db
}
function save(db: DemoDB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function finalize(db: DemoDB, a: DemoAttempt, reason: SubmitReason, at = Date.now()) {
  if (a.status === 'submitted') return a
  const deadline = Date.parse(a.deadlineAt)
  if (reason === 'manual' && at > deadline) reason = 'timeout'
  const end = Math.min(at, deadline)
  let correct = 0, incorrect = 0, unanswered = 0, earned = 0, max = 0
  for (const qid of a.questionIds) {
    const q = db.questions.find((x) => x.id === qid)
    if (!q) continue
    max += q.marks
    const ans = a.answers[qid]
    if (!ans) { unanswered++; continue }
    const ok = q.options.find((o) => o.id === ans.optionId)?.isCorrect ?? false
    ans.isCorrect = ok
    if (ok) { correct++; earned += q.marks } else incorrect++
  }
  const duration = Math.max(0, end - Date.parse(a.startedAt))
  const reasons: string[] = []
  const total = a.questionIds.length
  if (correct + incorrect > 0 && duration < (correct + incorrect) * 2500 && correct / total >= 0.7) reasons.push('Very fast completion with high accuracy')
  if (correct === total && duration < total * 4000) reasons.push('Perfect score in under 4s per question')
  Object.assign(a, {
    status: 'submitted', submittedAt: new Date(at).toISOString(), submitReason: reason, durationMs: duration,
    score: earned - incorrect * a.negativeMark, maxScore: max, correct, incorrect, unanswered,
    flagged: reasons.length > 0, flagReasons: reasons,
  })
  return a
}

function sweepExpired(db: DemoDB) {
  let changed = false
  for (const a of db.attempts) {
    if (a.status === 'in_progress' && Date.parse(a.deadlineAt) + GRACE_MS < Date.now()) {
      finalize(db, a, 'expired')
      changed = true
    }
  }
  if (changed) save(db)
}

const better = (x: DemoAttempt, y: DemoAttempt) =>
  x.score! - y.score! || y.durationMs! - x.durationMs! || Date.parse(y.submittedAt!) - Date.parse(x.submittedAt!)

function ranked(db: DemoDB, day: EventDay | null) {
  return db.attempts
    .filter((a) => a.status === 'submitted' && !a.disqualified && (day == null || a.eventDay === day))
    .sort((x, y) => better(y, x))
}

function auth(db: DemoDB, token: string) {
  const p = db.participants.find((x) => x.token === token)
  if (!p) throw new AppError('INVALID_SESSION', 'Your session has expired or was reset. Please register again.')
  return p
}

function activePool(db: DemoDB) {
  return db.questions.filter((q) => q.isActive && !q.archived)
}

function publicConfig(db: DemoDB): PublicConfig {
  const s = db.settings
  const count = Math.min(db.quiz.questionCount, activePool(db).length)
  return {
    event: {
      name: s.eventName, venue: s.venue, day1Date: s.day1Date, day2Date: s.day2Date, activeDay: s.activeDay,
      quizEnabled: s.quizEnabled && count > 0, registrationEnabled: s.registrationEnabled,
      competitionInfo: s.competitionInfo, rules: s.rules, prizes: s.prizes, defaultTheme: s.defaultTheme,
    },
    quiz: {
      title: db.quiz.title, questionCount: count, durationSeconds: db.quiz.durationSeconds,
      marksPerQuestion: db.quiz.marksPerQuestion, totalMarks: count * db.quiz.marksPerQuestion,
      negativeMarking: db.quiz.negativeMarking, negativeMark: db.quiz.negativeMark,
    },
  }
}

function attemptState(db: DemoDB, a: DemoAttempt) {
  return {
    status: 'in_progress' as const,
    attemptId: a.id,
    questions: a.questionIds
      .map((qid) => db.questions.find((q) => q.id === qid))
      .filter((q): q is DemoQuestion => Boolean(q))
      .map((q) => ({
        id: q.id, prompt: q.prompt, marks: q.marks,
        options: (a.optionOrder[q.id] ?? q.options.map((o) => o.id))
          .map((oid) => q.options.find((o) => o.id === oid))
          .filter((o): o is DemoOption => Boolean(o))
          .map((o) => ({ id: o.id, text: o.text })),
      })),
    answers: Object.fromEntries(Object.entries(a.answers).map(([k, v]) => [k, v.optionId])),
    startedAt: a.startedAt, deadlineAt: a.deadlineAt, serverNow: new Date().toISOString(),
    durationSeconds: db.quiz.durationSeconds, negativeMarking: a.negativeMark > 0, negativeMark: a.negativeMark,
  }
}

function applyAnswers(a: DemoAttempt, answers: AnswerMap) {
  for (const [qid, oid] of Object.entries(answers ?? {})) {
    const allowed = a.optionOrder[qid]
    if (!allowed) continue
    if (oid === null) delete a.answers[qid]
    else if (allowed.includes(oid)) a.answers[qid] = { optionId: oid, answeredAt: new Date().toISOString() }
  }
}

function result(db: DemoDB, a: DemoAttempt): AttemptResult {
  const p = db.participants.find((x) => x.id === a.participantId)!
  const dayPool = ranked(db, a.eventDay)
  const allPool = ranked(db, null)
  const rankIn = (pool: DemoAttempt[]) => pool.filter((x) => better(x, a) > 0).length + 1
  return {
    attemptId: a.id, fullName: p.fullName, score: a.score!, maxScore: a.maxScore!, correct: a.correct!,
    incorrect: a.incorrect!, unanswered: a.unanswered!, totalQuestions: a.questionIds.length, durationMs: a.durationMs!,
    submittedAt: a.submittedAt!, eventDay: a.eventDay, submitReason: a.submitReason!,
    rankDay: rankIn(dayPool), finishersDay: dayPool.length, rankOverall: rankIn(allPool), finishersOverall: allPool.length,
  }
}

const emailKey = (e: string) => {
  const [l, d] = e.trim().toLowerCase().split('@')
  const local = l.split('+')[0]
  return `${d === 'gmail.com' ? local.replace(/\./g, '') : local}@${d}`
}

export const demoParticipantApi: ParticipantApi = {
  async getConfig() {
    await delay(80)
    return publicConfig(load())
  },

  async register(input) {
    await delay()
    const db = load()
    if (!db.settings.registrationEnabled) throw new AppError('REGISTRATION_CLOSED', 'Registration is closed right now. Please check with the Kaizenext booth.')
    const fields: Record<string, string> = {}
    if (input.fullName.trim().length < 2) fields.fullName = 'Please enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) fields.email = 'Please enter a valid email address.'
    if (input.university.trim().length < 2) fields.university = 'Please enter your university.'
    if (input.department.trim().length < 2) fields.department = 'Please enter your department.'
    if (!input.consent) fields.consent = 'Please accept the data notice to continue.'
    if (Object.keys(fields).length) throw new AppError('VALIDATION', 'Please check the highlighted fields.', fields, 422)
    const key = emailKey(input.email)
    if (db.participants.some((p) => p.emailKey === key)) {
      throw new AppError('EMAIL_TAKEN', 'This email has already been used. Each participant can play once — if you were interrupted, please visit the Kaizenext booth.', { email: 'Already registered.' }, 409)
    }
    const phoneKey = input.phone ? input.phone.replace(/\D/g, '').replace(/^01(\d{9})$/, '8801$1') : null
    if (phoneKey && db.participants.some((p) => p.phoneKey === phoneKey)) {
      throw new AppError('PHONE_TAKEN', 'This phone number has already been used to participate.', { phone: 'Already registered.' }, 409)
    }
    const p: DemoParticipant = {
      id: uid(), token: `${uid()}${uid()}`, fullName: input.fullName.trim(), email: input.email.trim(), emailKey: key,
      phone: input.phone?.trim() || null, phoneKey, university: input.university.trim(), department: input.department.trim(),
      eventDay: db.settings.activeDay, createdAt: new Date().toISOString(),
    }
    db.participants.push(p)
    save(db)
    return { token: p.token, participantId: p.id, fullName: p.fullName }
  },

  async getSession(token) {
    await delay(80)
    const db = load()
    sweepExpired(db)
    const p = auth(db, token)
    const a = db.attempts.find((x) => x.participantId === p.id)
    return {
      participant: { id: p.id, fullName: p.fullName, university: p.university, department: p.department, eventDay: p.eventDay },
      attemptStatus: a ? a.status : 'none',
    }
  },

  async start(token) {
    await delay()
    const db = load()
    sweepExpired(db)
    const p = auth(db, token)
    const existing = db.attempts.find((x) => x.participantId === p.id)
    if (existing) return existing.status === 'submitted' ? { status: 'submitted', attemptId: existing.id } : attemptState(db, existing)
    if (!db.settings.quizEnabled) throw new AppError('QUIZ_CLOSED', 'The quiz is not live right now. Please check back shortly.')
    const pool = activePool(db).sort((a, b) => a.position - b.position)
    if (!pool.length) throw new AppError('QUIZ_NOT_READY', 'Questions are not ready yet. Please check back shortly.')
    const picked = (db.quiz.shuffleQuestions ? shuffle(pool) : pool).slice(0, db.quiz.questionCount)
    const now = Date.now()
    const a: DemoAttempt = {
      id: uid(), participantId: p.id, eventDay: db.settings.activeDay, status: 'in_progress',
      questionIds: picked.map((q) => q.id),
      optionOrder: Object.fromEntries(picked.map((q) => { const ids = q.options.map((o) => o.id); return [q.id, db.quiz.shuffleOptions ? shuffle(ids) : ids] })),
      negativeMark: db.quiz.negativeMarking ? db.quiz.negativeMark : 0,
      startedAt: new Date(now).toISOString(), deadlineAt: new Date(now + db.quiz.durationSeconds * 1000).toISOString(),
      submittedAt: null, submitReason: null, durationMs: null, score: null, maxScore: null, correct: null, incorrect: null,
      unanswered: null, flagged: false, flagReasons: [], disqualified: false, answers: {},
    }
    db.attempts.push(a)
    save(db)
    return attemptState(db, a)
  },

  async save(token, attemptId, answers) {
    await delay(90)
    const db = load()
    const p = auth(db, token)
    const a = db.attempts.find((x) => x.id === attemptId && x.participantId === p.id)
    if (!a) throw new AppError('ATTEMPT_NOT_FOUND', 'Quiz attempt not found.')
    if (a.status !== 'in_progress') throw new AppError('ATTEMPT_CLOSED', 'This quiz has already been submitted.')
    if (Date.now() > Date.parse(a.deadlineAt) + GRACE_MS) {
      finalize(db, a, 'expired'); save(db)
      throw new AppError('ATTEMPT_CLOSED', 'Time is up — your quiz has been submitted.')
    }
    applyAnswers(a, answers)
    save(db)
    return { serverNow: new Date().toISOString() }
  },

  async submit(token, attemptId, answers, reason) {
    await delay(400)
    const db = load()
    const p = auth(db, token)
    const a = db.attempts.find((x) => x.id === attemptId && x.participantId === p.id)
    if (!a) throw new AppError('ATTEMPT_NOT_FOUND', 'Quiz attempt not found.')
    if (a.status === 'in_progress') {
      if (Date.now() <= Date.parse(a.deadlineAt) + GRACE_MS) applyAnswers(a, answers)
      finalize(db, a, reason === 'timeout' ? 'timeout' : 'manual')
      save(db)
    }
    return result(db, a)
  },

  async result(token) {
    await delay()
    const db = load()
    sweepExpired(db)
    const p = auth(db, token)
    const a = db.attempts.find((x) => x.participantId === p.id)
    if (!a) throw new AppError('NO_ATTEMPT', 'You have not taken the quiz yet.')
    if (a.status !== 'submitted') throw new AppError('ATTEMPT_IN_PROGRESS', 'Your quiz is still in progress.')
    return result(db, a)
  },

  async leaderboard(day, limit = 10) {
    await delay(100)
    const db = load()
    sweepExpired(db)
    const d = day === 'all' ? null : day
    const entries: LeaderboardEntry[] = ranked(db, d).slice(0, limit).map((a, i) => {
      const p = db.participants.find((x) => x.id === a.participantId)!
      return {
        rank: i + 1, attemptId: a.id, name: p.fullName, university: p.university, department: p.department,
        score: a.score!, maxScore: a.maxScore!, correct: a.correct!, durationMs: a.durationMs!, submittedAt: a.submittedAt!,
      }
    })
    return {
      scope: day, entries, activeDay: db.settings.activeDay, updatedAt: new Date().toISOString(),
      stats: {
        participants: db.participants.filter((p) => d == null || p.eventDay === d).length,
        completed: ranked(db, d).length,
      },
    }
  },
}

/* ── Admin ─────────────────────────────────────────────────────── */

function requireDemoAdmin() {
  if (!localStorage.getItem(ADMIN_KEY)) throw new AppError('NOT_AUTHORIZED', 'Please sign in.')
}

export const demoAdminApi: AdminApi = {
  async getUser() {
    const email = localStorage.getItem(ADMIN_KEY)
    return email ? { id: 'demo-admin', email } : null
  },
  async signIn(email, password) {
    await delay(300)
    if (password !== 'demo1234') throw new AppError('AUTH', 'Demo mode: use any email with password "demo1234".')
    localStorage.setItem(ADMIN_KEY, email)
    return { id: 'demo-admin', email }
  },
  async signOut() {
    localStorage.removeItem(ADMIN_KEY)
  },
  async getStats() {
    requireDemoAdmin(); await delay(100)
    const db = load(); sweepExpired(db)
    const done = db.attempts.filter((a) => a.status === 'submitted' && !a.disqualified)
    const scores = done.map((a) => a.score!)
    return {
      totalRegistrations: db.participants.length, totalCompleted: done.length,
      inProgress: db.attempts.filter((a) => a.status === 'in_progress').length,
      averageScore: scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null,
      highestScore: scores.length ? Math.max(...scores) : null,
      maxScore: done.length ? Math.max(...done.map((a) => a.maxScore!)) : null,
      byDay: ([1, 2] as const).map((day) => ({
        day, registrations: db.participants.filter((p) => p.eventDay === day).length,
        completed: done.filter((a) => a.eventDay === day).length,
      })),
      flagged: db.attempts.filter((a) => a.flagged && !a.disqualified).length,
    }
  },
  async getQuiz() { requireDemoAdmin(); await delay(60); return load().quiz },
  async updateQuiz(patch) {
    requireDemoAdmin(); await delay()
    const db = load(); db.quiz = { ...db.quiz, ...patch }; save(db); return db.quiz
  },
  async getSettings() { requireDemoAdmin(); await delay(60); return load().settings },
  async updateSettings(patch) {
    requireDemoAdmin(); await delay()
    const db = load(); db.settings = { ...db.settings, ...patch }; save(db); return db.settings
  },
  async listQuestions() {
    requireDemoAdmin(); await delay(100)
    return load().questions.filter((q) => !q.archived).sort((a, b) => a.position - b.position)
      .map(({ archived: _a, ...q }): AdminQuestion => q)
  },
  async saveQuestion(d) {
    requireDemoAdmin(); await delay()
    if (d.options.length !== 4) throw new AppError('VALIDATION', 'Exactly four options are required')
    if (d.options.filter((o) => o.isCorrect).length !== 1) throw new AppError('VALIDATION', 'Exactly one option must be marked correct')
    const db = load()
    let q = d.id ? db.questions.find((x) => x.id === d.id) : undefined
    if (d.id && !q) throw new AppError('NOT_FOUND', 'Question not found')
    if (!q) {
      q = { id: uid(), prompt: '', marks: 1, isActive: true, archived: false, createdAt: new Date().toISOString(),
        position: Math.max(-1, ...db.questions.map((x) => x.position)) + 1, options: [] }
      db.questions.push(q)
    }
    q.prompt = d.prompt.trim(); q.marks = d.marks; q.isActive = d.isActive
    q.options = d.options.map((o, i) => ({ id: q!.options[i]?.id ?? uid(), position: i, text: o.text.trim(), isCorrect: o.isCorrect }))
    save(db)
    return q.id
  },
  async deleteQuestion(id) {
    requireDemoAdmin(); await delay()
    const db = load()
    const used = db.attempts.some((a) => a.questionIds.includes(id))
    if (used) { const q = db.questions.find((x) => x.id === id); if (q) { q.archived = true; q.isActive = false } }
    else db.questions = db.questions.filter((x) => x.id !== id)
    save(db)
    return used ? 'archived' : 'deleted'
  },
  async setQuestionActive(id, active) {
    requireDemoAdmin(); await delay(80)
    const db = load(); const q = db.questions.find((x) => x.id === id); if (q) q.isActive = active; save(db)
  },
  async listParticipants() {
    requireDemoAdmin(); await delay(120)
    const db = load(); sweepExpired(db)
    return db.participants.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p): AdminParticipant => {
      const a = db.attempts.find((x) => x.participantId === p.id)
      return {
        id: p.id, fullName: p.fullName, email: p.email, phone: p.phone, university: p.university, department: p.department,
        eventDay: p.eventDay, createdAt: p.createdAt,
        attempt: a ? {
          id: a.id, status: a.status, eventDay: a.eventDay, score: a.score, maxScore: a.maxScore, correct: a.correct,
          incorrect: a.incorrect, unanswered: a.unanswered, durationMs: a.durationMs, startedAt: a.startedAt,
          submittedAt: a.submittedAt, submitReason: a.submitReason, flagged: a.flagged, flagReasons: a.flagReasons,
          disqualified: a.disqualified,
        } : null,
      }
    })
  },
  async getAttemptAnswers(attemptId) {
    requireDemoAdmin(); await delay(100)
    const db = load()
    const a = db.attempts.find((x) => x.id === attemptId)
    if (!a) throw new AppError('NOT_FOUND', 'Attempt not found')
    return a.questionIds.map((qid) => db.questions.find((q) => q.id === qid)).filter((q): q is DemoQuestion => Boolean(q)).map((q) => {
      const ans = a.answers[q.id]
      return {
        questionId: q.id, prompt: q.prompt, marks: q.marks,
        options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        selectedOptionId: ans?.optionId ?? null,
        isCorrect: ans ? (q.options.find((o) => o.id === ans.optionId)?.isCorrect ?? false) : null,
        answeredAt: ans?.answeredAt ?? null,
      }
    })
  },
  async deleteParticipant(id) {
    requireDemoAdmin(); await delay()
    const db = load()
    db.participants = db.participants.filter((p) => p.id !== id)
    db.attempts = db.attempts.filter((a) => a.participantId !== id)
    save(db)
  },
  async setDisqualified(attemptId, value) {
    requireDemoAdmin(); await delay(80)
    const db = load(); const a = db.attempts.find((x) => x.id === attemptId); if (a) a.disqualified = value; save(db)
  },
  async resetData(confirm) {
    requireDemoAdmin(); await delay(300)
    if (confirm !== 'RESET') throw new AppError('VALIDATION', 'Confirmation text mismatch')
    const db = load()
    const n = db.participants.length
    db.participants = []; db.attempts = []
    db.questions = db.questions.filter((q) => !q.archived)
    save(db)
    return n
  },
}
