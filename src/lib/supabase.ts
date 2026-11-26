import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

let client: SupabaseClient | null = null

/** Browser Supabase client (public anon key only — never the service role). */
export function getSupabase(): SupabaseClient {
  if (!env.hasBackend) throw new Error('Supabase is not configured')
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kbb.admin.auth' },
    })
  }
  return client
}
