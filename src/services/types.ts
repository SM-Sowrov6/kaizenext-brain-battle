import type {
  AdminParticipant, AdminQuestion, AdminStats, AttemptAnswerDetail, AttemptResult, DayScope,
  EventSettings, LeaderboardResponse, ParticipantSession, PublicConfig, QuestionDraft, QuizSettings,
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
  leaderboard(day: DayScope, limit?: number): Promise<LeaderboardResponse>
}

export interface AdminUser {
  id: string
  email: string
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
}
