import { useNavigate, useParams } from 'react-router'
import type { TripPatch } from '@/api/types'
import { BackLink, PageHeader } from '@/components/PageHeader'
import { TripForm } from '@/components/TripForm'
import { TripLoadError } from '@/components/TripLoadError'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTrip, useUpdateTrip } from '@/hooks/useTrips'
import { toTripInput } from '@/lib/schema'

export function EditTripPage() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  // No placeholder here: the form must start from the server's copy, not a cached list row.
  const { data: trip, isPending, error, refetch, isFetching } = useTrip(tripId, { usePlaceholder: false })
  const updateTrip = useUpdateTrip(tripId)
  useDocumentTitle(trip ? `Edit ${trip.title}` : 'Edit trip')

  const detailsPath = `/trips/${tripId}`

  if (error) {
    return <TripLoadError error={error} onRetry={() => refetch()} retrying={isFetching} />
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to={detailsPath}>Back to trip</BackLink>
      <PageHeader title="Edit trip" description={trip ? `Update the details for “${trip.title}”.` : undefined} />

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-8">
        {isPending || !trip ? (
          <div role="status" aria-label="Loading trip" className="space-y-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <TripForm
            defaultValues={{
              title: trip.title,
              destination: trip.destination,
              start_date: trip.start_date,
              end_date: trip.end_date,
              budget: String(trip.budget),
            }}
            submitLabel="Save changes"
            submittingLabel="Saving…"
            cancelTo={detailsPath}
            onSubmit={async (values, dirty) => {
              // PATCH only what changed, so we never overwrite fields edited elsewhere.
              const full = toTripInput(values)
              const patch = Object.fromEntries(
                Object.entries(full).filter(([field]) => dirty[field as keyof typeof dirty]),
              ) as TripPatch

              if (Object.keys(patch).length === 0) {
                toast.info('No changes to save.')
              } else {
                await updateTrip.mutateAsync(patch)
                toast.success('Your changes were saved.')
              }
              navigate(detailsPath)
            }}
          />
        )}
      </div>
    </div>
  )
}
