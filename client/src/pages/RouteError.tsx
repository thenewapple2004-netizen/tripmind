import { useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StateCard } from '@/components/ui/StateCard'

/** Last-resort screen for unexpected rendering errors, so users never see a blank page. */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl items-center px-4">
      <div className="w-full">
        <StateCard
          tone="danger"
          icon={TriangleAlert}
          title="Something went wrong"
          description="An unexpected error occurred. Reloading the page usually fixes it."
        >
          <Button variant="primary" onClick={() => window.location.assign('/')}>
            Reload TripMind
          </Button>
        </StateCard>
      </div>
    </div>
  )
}
