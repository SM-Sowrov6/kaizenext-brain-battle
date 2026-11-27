import type {
  AdminParticipant, AdminQuestion, AdminStats, AttemptAnswerDetail, AttemptResult, BoardResponse,
  DrawWinner, EventDay, EventSettings, ParticipantSession, PublicConfig, QuestionDraft, QuizSettings,
  RegistrationInput, SessionInfo, StartResponse, SubmitReason,
} from '@/types'

export type AnswerMap = Record<string, string | null>

export interface ParticipantApi {
  getConfig(): Promise<PublicConfig>
  register(input: RegistrationInput): Promise<ParticipantSession>
  getSession(token: string): Promise<SessionInfo>
  start(token: string): Promise<StartResponse>
  save(token: string, attemptId: string, answers: AnswerMap): Promise<{ serverNow: string }>
  submit(token: string, attemptId: string, answers: AnswerMap, reason: SubmitReason): Promise<AttemptResult>
  result(token: string): Promise<AttemptResult>
  /** Booth board for a day (defaults to the active day): draw pool + winners, no ranks. */
  leaderboard(day?: EventDay): Promise<BoardResponse>
}

export interface AdminUser {
  id: string
  email: string
}

/** Admin view of a pool entry — includes contact details for prize winners. */
export interface AdminPoolEntry {
  attemptId: string
  name: string
  email: string
  phone: string | null
  university: string
  department: string
  score: number
  maxScore: number
  submittedAt: string
}

export interface AdminApi {
  getUser(): Promise<AdminUser | null>
  signIn(email: string, password: string): Promise<AdminUser>
  signOut(): Promise<void>
  getStats(): Promise<AdminStats>
  getQuiz(): Promise<QuizSettings>
  updateQuiz(patch: Partial<Omit<QuizSettings, 'id'>>): Promise<QuizSettings>
  getSettings(): Promise<EventSettings>
  updateSettings(patch: Partial<EventSettings>): Promise<EventSettings>
  listQuestions(): Promise<AdminQuestion[]>
  saveQuestion(draft: QuestionDraft): Promise<string>
  deleteQuestion(id: string): Promise<'deleted' | 'archived'>
  setQuestionActive(id: string, active: boolean): Promise<void>
  listParticipants(): Promise<AdminParticipant[]>
  getAttemptAnswers(attemptId: string): Promise<AttemptAnswerDetail[]>
  deleteParticipant(id: string): Promise<void>
  setDisqualified(attemptId: string, value: boolean): Promise<void>
  resetData(confirm: string): Promise<number>
  getDrawPool(day: EventDay): Promise<AdminPoolEntry[]>
  getDrawWinners(day: EventDay): Promise<DrawWinner[]>
  /** Server picks a random winner for the prize position from the current pool. */
  drawWinner(day: EventDay, position: number): Promise<DrawWinner>
  /** Marks a winner as voided (kept for audit) so the position can be redrawn. */
  voidWinner(id: string): Promise<void>
}
