const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
// Publishable key (sb_publishable_…). VITE_SUPABASE_ANON_KEY is accepted as a legacy fallback.
const publishableKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim()
const forceDemo = import.meta.env.VITE_FORCE_DEMO === 'true'

const looksReal = Boolean(
  url && publishableKey && !url.includes('your-project-ref') && !publishableKey.startsWith('your-'),
)

// Guard against someone pasting a secret / service-role key into a VITE_ variable.
if (publishableKey && (publishableKey.startsWith('sb_secret_') || publishableKey.includes('service_role'))) {
  throw new Error('A Supabase SECRET key was provided to the frontend. Use the publishable key only.')
}

export const env = {
  supabaseUrl: url ?? '',
  supabaseKey: publishableKey ?? '',
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() || '',
  /** Supabase keys are configured. */
  hasBackend: looksReal,
  /** Local in-browser backend — development builds only, never in production. */
  demoMode: import.meta.env.DEV && (!looksReal || forceDemo),
  /** Production build without a backend → show a configuration screen. */
  misconfigured: !import.meta.env.DEV && !looksReal,
}
