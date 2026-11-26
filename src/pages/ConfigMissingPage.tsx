import { Settings2 } from 'lucide-react'
import { LogoMark } from '@/components/ui/Brand'
import { AmbientBackground } from '@/layouts/PublicLayout'

/** Shown only in production builds deployed without Supabase environment variables. */
export default function ConfigMissingPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <AmbientBackground />
      <div className="card-surface max-w-lg rounded-3xl p-8 text-center">
        <LogoMark className="mx-auto size-14" />
        <h1 className="font-headline mt-6 text-2xl">Brain Battle is almost ready</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This deployment is missing its backend configuration. Set <code className="font-mono text-fg">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono text-fg">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your hosting provider's environment variables, then redeploy.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-faint">
          <Settings2 className="size-3.5" /> See README → Deployment
        </div>
      </div>
    </div>
  )
}
