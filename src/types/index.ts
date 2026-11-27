export type EventDay = 1 | 2
export type DayScope = EventDay | 'all'

export interface Prize {
  place: string
  title: string
  description: string
}

/** Public, non-sensitive configuration shown to participants. */
export interface PublicConfig {
  event: {
    name: string
    venue: string
    day1Date: string // ISO date (YYYY-MM-DD)
    day2Date: string
    activeDay: EventDay
    quizEnabled: boolean
    registrationEnabled: boolean
    competitionInfo: string
    rules: string[]
    prizes: Prize[]
  }
  quiz: {
    title: string
    questionCount: number
    durationSeconds: number
    marksPerQuestion: number
    totalMarks: number
    negativeMarking: boolean
    negativeMark: number
  }
}

export interface RegistrationInput {
  fullName: string
  email: string
  university: string
  department: string
  phone?: string
  consent: boolean
}

export interface ParticipantSession {
  token: string
  participantId: string
  fullName: string
}

export type AttemptStatus = 'none' | 'in_progress' | 'submitted'

export interface SessionInfo {
  participant: { id: string; fullName: string; university: string; department: string; eventDay: EventDay }
  attemptStatus: AttemptStatus
}

export interface QuizQuestion {
  id: string
  prompt: string
  marks: number
  options: { id: string; text: string }[]
}

export interface AttemptState {
  status: 'in_progress'
  attemptId: string
  questions: QuizQuestion[]
  answers: Record<string, string>
  startedAt: string
  deadlineAt: string
  serverNow: string
  durationSeconds: number
  negativeMarking: boolean
  negativeMark: number
}

export type StartResponse = AttemptState | { status: 'submitted'; attemptId: string }

export interface AttemptResult {
  attemptId: string
  fullName: string
  score: number
  maxScore: number
  correct: number
  incorrect: number
  unanswered: number
  totalQuestions: number
  durationMs: number
  submittedAt: string
  eventDay: EventDay
  submitReason: SubmitReason
  /** Lucky-draw status for the participant's own day (no public ranks). */
  draw: {
    inPool: boolean
    /** Current highest score of the day (null when nobody has finished). */
    topScore: number | null
    poolSize: number
    /** Prize position if this participant has already been drawn as a winner. */
    wonPosition: number | null
  }
}

export type SubmitReason = 'manual' | 'timeout' | 'expired'

/** A name in the day's lucky-draw pool (everyone tied on the highest score). Names only. */
export interface PoolEntry {
  attemptId: string
  name: string
  university: string
  department: string
}

export interface DrawWinner extends PoolEntry {
  id?: string
  position: number
  drawnAt: string
}

/** Public booth board: draw pool + drawn winners. Deliberately no ranks, times or per-person scores. */
export interface BoardResponse {
  day: EventDay
  topScore: number | null
  maxScore: number | null
  poolTotal: number
  pool: PoolEntry[]
  winners: DrawWinner[]
  stats: { participants: number; completed: number }
  activeDay: EventDay
  updatedAt: string
}

/* ── Admin types ─────────────────────────────────────────────── */

export interface AdminQuestionOption {
  id?: string
  position: number
  text: string
  isCorrect: boolean
}

export interface AdminQuestion {
  id: string
  prompt: string
  marks: number
  isActive: boolean
  position: number
  createdAt: string
  options: AdminQuestionOption[]
}

export interface QuestionDraft {
  id?: string
  prompt: string
  marks: number
  isActive: boolean
  options: { text: string; isCorrect: boolean }[]
}

export interface EventSettings {
  eventName: string
  venue: string
  day1Date: string
  day2Date: string
  activeDay: EventDay
  quizEnabled: boolean
  registrationEnabled: boolean
  competitionInfo: string
  rules: string[]
  prizes: Prize[]
}

export interface QuizSettings {
  id: string
  title: string
  durationSeconds: number
  questionCount: number
  marksPerQuestion: number
  negativeMarking: boolean
  negativeMark: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
}

export interface AdminParticipant {
  id: string
  fullName: string
  email: string
  phone: string | null
  university: string
  department: string
  eventDay: EventDay
  createdAt: string
  attempt: AdminAttemptSummary | null
}

export interface AdminAttemptSummary {
  id: string
  status: 'in_progress' | 'submitted'
  eventDay: EventDay
  score: number | null
  maxScore: number | null
  correct: number | null
  incorrect: number | null
  unanswered: number | null
  durationMs: number | null
  startedAt: string
  submittedAt: string | null
  submitReason: SubmitReason | null
  flagged: boolean
  flagReasons: string[]
  disqualified: boolean
}

export interface AttemptAnswerDetail {
  questionId: string
  prompt: string
  marks: number
  options: { id: string; text: string; isCorrect: boolean }[]
  selectedOptionId: string | null
  isCorrect: boolean | null
  answeredAt: string | null
}

export interface AdminStats {
  totalRegistrations: number
  totalCompleted: number
  inProgress: number
  averageScore: number | null
  highestScore: number | null
  maxScore: number | null
  byDay: { day: EventDay; registrations: number; completed: number }[]
  flagged: number
}
