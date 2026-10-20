import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { StateCard } from '@/components/ui/StateCard'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <StateCard
      icon={Compass}
      title="This page doesn't exist"
      description="The link may be broken or the page may have moved. Let's get you back on track."
    >
      <ButtonLink to="/" variant="primary">
        Go to your trips
      </ButtonLink>
    </StateCard>
  )
}
