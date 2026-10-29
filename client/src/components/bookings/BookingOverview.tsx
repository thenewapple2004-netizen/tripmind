import type { ReactNode } from 'react'
import { CircleCheck, Clock, MapPinned, Ticket, type LucideIcon } from 'lucide-react'
import type { BookingStatus, BookingSummary } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'

interface StatProps {
  icon: LucideIcon
  label: string
  value: number
  scope: ReactNode
  /** Present when the figure doubles as a filter. */
  onSelect?: () => void
  selected?: boolean
  filterLabel?: string
}

function Stat({ icon: Icon, label, value, scope, onSelect, selected, filterLabel }: StatProps) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm font-medium text-fg-muted">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">{label}</span>
      </span>
      <span className="mt-3 block truncate font-display text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</span>
      <span className="mt-0.5 block text-sm text-fg-subtle">{scope}</span>
    </>
  )
  const card = 'block w-full rounded-xl border bg-surface p-4 text-left shadow-card sm:p-5'
  if (!onSelect) return <div className={cn(card, 'border-line')}>{body}</div>
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${filterLabel ?? label}: ${value}. ${selected ? 'Showing these. Select to show everything again.' : 'Select to show only these.'}`}
      className={cn(
        card,
        'transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2',
        selected ? 'border-primary shadow-glow' : 'border-line',
      )}
    >
      {body}
    </button>
  )
}

/**
 * Four figures for the whole account (they don't change with the search or filters below). Total, Confirmed
 * and Pending are also filters; Trips is a plain count.
 */
export function BookingOverview({
  summary,
  loading,
  tripTotal,
  status,
  showingAll,
  onStatus,
  onShowAll,
}: {
  summary?: BookingSummary
  loading: boolean
  tripTotal?: number
  status?: BookingStatus
  /** True when no search, filter or tab narrows the list. */
  showingAll: boolean
  onStatus: (status: BookingStatus | undefined) => void
  onShowAll: () => void
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading booking overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[8.25rem] rounded-xl" />
        ))}
      </div>
    )
  }
  if (!summary) return null
  const toggle = (s: BookingStatus) => () => onStatus(status === s ? undefined : s)
  return (
    <section aria-label="Booking overview">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          icon={Ticket}
          label="Total bookings"
          value={summary.total}
          scope="All statuses"
          selected={showingAll}
          onSelect={onShowAll}
          filterLabel="Total bookings"
        />
        <Stat
          icon={CircleCheck}
          label="Confirmed"
          value={summary.by_status.confirmed}
          scope="Not yet completed"
          selected={status === 'confirmed'}
          onSelect={toggle('confirmed')}
        />
        <Stat
          icon={Clock}
          label="Pending"
          value={summary.by_status.pending}
          scope="Waiting to be confirmed"
          selected={status === 'pending'}
          onSelect={toggle('pending')}
        />
        <Stat
          icon={MapPinned}
          label="Trips with bookings"
          value={summary.trip_count}
          scope={tripTotal !== undefined ? `Out of ${tripTotal} ${tripTotal === 1 ? 'trip' : 'trips'}` : 'Trips with a reservation'}
        />
      </div>
    </section>
  )
}
