import { CircleAlert, RefreshCw, SearchX } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { Button, ButtonLink } from '@/components/ui/Button'
import { StateCard } from '@/components/ui/StateCard'

/** Full-page error for a trip that couldn't be loaded: "not found" gets its own wording. */
export function TripLoadError({
  error,
  onRetry,
  retrying,
}: {
  error: Error
  onRetry: () => void
  retrying: boolean
}) {
  const notFound = error instanceof ApiError && error.isNotFound
  // A malformed ID in the URL comes back as 422; to the user it's the same as "not found".
  const invalidId = error instanceof ApiError && error.status === 422

  if (notFound || invalidId) {
    return (
      <StateCard
        icon={SearchX}
        title="Trip not found"
        description="This trip doesn't exist or has been deleted. Head back to your trips to pick another one."
      >
        <ButtonLink to="/" variant="primary">
          Back to trips
        </ButtonLink>
      </StateCard>
    )
  }

  return (
    <StateCard tone="danger" icon={CircleAlert} title="We couldn't load this trip" description={error.message}>
      <Button variant="primary" onClick={onRetry} loading={retrying} icon={<RefreshCw className="size-4" aria-hidden />}>
        {retrying ? 'Retrying…' : 'Try again'}
      </Button>
      <ButtonLink to="/" variant="secondary">
        Back to trips
      </ButtonLink>
    </StateCard>
  )
}
