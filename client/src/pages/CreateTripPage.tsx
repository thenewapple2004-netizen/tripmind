import { useNavigate } from 'react-router'
import { BackLink, PageHeader } from '@/components/PageHeader'
import { TripForm } from '@/components/TripForm'
import { useToast } from '@/components/ui/Toast'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useCreateTrip } from '@/hooks/useTrips'
import { toTripInput } from '@/lib/schema'

export function CreateTripPage() {
  useDocumentTitle('New trip')
  const navigate = useNavigate()
  const toast = useToast()
  const createTrip = useCreateTrip()

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to="/">Back to trips</BackLink>
      <PageHeader title="Plan a new trip" description="Add the essentials now. You can edit everything later." />

      <div className="mt-8 rounded-lg border border-line bg-surface p-5 shadow-card sm:p-8">
        <TripForm
          showDemoButton
          submitLabel="Create trip"
          submittingLabel="Creating…"
          cancelTo="/"
          onSubmit={async (values) => {
            const trip = await createTrip.mutateAsync(toTripInput(values))
            toast.success(`“${trip.title}” was created.`)
            navigate(`/trips/${trip.id}`)
          }}
        />
      </div>
    </div>
  )
}
