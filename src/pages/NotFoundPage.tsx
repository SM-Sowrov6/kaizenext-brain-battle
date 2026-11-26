import { ArrowLeft, Compass } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { useTitle } from '@/hooks/misc'

export default function NotFoundPage() {
  useTitle('Page not found')
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <EmptyState
        icon={<Compass />}
        title="This page took a wrong turn"
        description="The link may be broken or the page may have moved. Let's get you back to the challenge."
        action={<LinkButton to="/" variant="secondary" icon={<ArrowLeft className="size-4" />}>Back to home</LinkButton>}
      />
    </div>
  )
}
