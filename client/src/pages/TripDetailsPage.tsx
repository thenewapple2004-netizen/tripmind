import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CalendarDays, Hash, MapPin, Pencil, Trash2, Wallet } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { BackLink } from '@/components/PageHeader'
import { TripCover } from '@/components/TripCover'
import { TripLoadError } from '@/components/TripLoadError'
import { ButtonLink, Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDeleteTrip, useTrip } from '@/hooks/useTrips'
import {
  formatCurrency,
  formatDateRange,
  formatLongDate,
  getTimingLabel,
  getTripDays,
  getTripProgress,
  getTripStatus,
  pluralize,
} from '@/lib/trips'

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium text-fg">{value}</dd>
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading trip" className="space-y-6">
      <Skeleton className="h-52 rounded-2xl sm:h-60" />
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
  )
}

export function TripDetailsPage() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: trip, isPending, error, refetch, isFetching } = useTrip(tripId)
  const deleteTrip = useDeleteTrip()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useDocumentTitle(trip?.title ?? 'Trip')

  const closeDialog = () => {
    setConfirmingDelete(false)
    deleteTrip.reset()
  }

  const handleDelete = () => {
    if (!trip) return
    deleteTrip.mutate(trip.id, {
      onSuccess: () => {
        toast.success(`“${trip.title}” was deleted.`)
        navigate('/', { replace: true })
      },
    })
  }

  if (error && !trip) {
    return (
      <div>
        <BackLink to="/">Back to trips</BackLink>
        <TripLoadError error={error} onRetry={() => refetch()} retrying={isFetching} />
      </div>
    )
  }

  if (isPending || !trip) {
    return (
      <div>
        <BackLink to="/">Back to trips</BackLink>
        <DetailsSkeleton />
      </div>
    )
  }

  const status = getTripStatus(trip)
  const days = getTripDays(trip)
  const perDay = trip.budget / days
  const progress = Math.round(getTripProgress(trip) * 100)

  return (
    <div className="animate-fade-in">
      <BackLink to="/">Back to trips</BackLink>

      <article className="space-y-5 sm:space-y-6">
        <header className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <TripCover destination={trip.destination} className="flex min-h-48 flex-col justify-between gap-8 p-5 sm:min-h-56 sm:p-8">
            <StatusBadge status={status} className="self-start shadow-sm" />
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-white/90">
                <MapPin className="size-4" aria-hidden />
                {trip.destination}
              </p>
              <h1 className="mt-1.5 text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
                {trip.title}
              </h1>
            </div>
          </TripCover>

          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm font-medium text-fg-muted">
              {formatDateRange(trip.start_date, trip.end_date)}
              <span aria-hidden className="mx-2 text-fg-subtle">
                ·
              </span>
              {getTimingLabel(trip)}
            </p>
            <div className="flex gap-3">
              <ButtonLink
                to={`/trips/${trip.id}/edit`}
                variant="secondary"
                icon={<Pencil className="size-4" aria-hidden />}
                className="flex-1 sm:flex-none"
              >
                Edit
              </ButtonLink>
              <Button
                variant="danger-outline"
                icon={<Trash2 className="size-4" aria-hidden />}
                onClick={() => setConfirmingDelete(true)}
                className="flex-1 sm:flex-none"
              >
                Delete
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
          <InfoCard icon={<CalendarDays className="size-4" aria-hidden />} title="Schedule">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Fact label="Departs" value={formatLongDate(trip.start_date)} />
              <Fact label="Returns" value={formatLongDate(trip.end_date)} />
              <Fact label="Length" value={pluralize(days, 'day')} />
            </dl>

            {status === 'ongoing' && (
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs font-medium text-fg-subtle">
                  <span>Trip progress</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Trip progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-2 overflow-hidden rounded-full bg-surface-2"
                >
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </InfoCard>

          <InfoCard icon={<Wallet className="size-4" aria-hidden />} title="Budget">
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-fg">{formatCurrency(trip.budget)}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
              <Fact label="Per day" value={formatCurrency(Math.round(perDay * 100) / 100)} />
              <Fact label="Currency" value="US dollars" />
            </dl>
          </InfoCard>
        </div>

        <p className="flex items-center gap-1.5 px-1 text-xs text-fg-subtle">
          <Hash className="size-3.5" aria-hidden />
          Trip ID <span className="font-mono">{trip.id}</span>
        </p>
      </article>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this trip?"
        description={`“${trip.title}” will be permanently removed, along with its dates and budget. This can't be undone.`}
        confirmLabel="Delete trip"
        pending={deleteTrip.isPending}
        error={deleteTrip.error instanceof ApiError ? deleteTrip.error.message : deleteTrip.error ? 'Something went wrong. Please try again.' : null}
        onConfirm={handleDelete}
        onCancel={closeDialog}
      />
    </div>
  )
}
