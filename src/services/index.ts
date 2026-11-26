import { env } from '@/lib/env'
import type { AdminApi, ParticipantApi } from './types'
import { supabaseParticipantApi } from './participantApi'
import { supabaseAdminApi } from './adminApi'
import { demoAdminApi, demoParticipantApi } from './demoBackend'

/**
 * Single switch between the real Supabase backend and the dev-only demo
 * backend. `import.meta.env.DEV` is statically `false` in production builds,
 * so Rollup constant-folds these ternaries and drops the demo backend (and its
 * sample answer keys) from the production bundle entirely.
 */
const useDemo = import.meta.env.DEV && env.demoMode

export const api: ParticipantApi = import.meta.env.DEV && useDemo ? demoParticipantApi : supabaseParticipantApi
export const adminApi: AdminApi = import.meta.env.DEV && useDemo ? demoAdminApi : supabaseAdminApi

export * from './errors'
export type * from './types'
