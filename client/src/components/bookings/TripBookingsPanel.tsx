import { CircleAlert, Plus, Ticket } from 'lucide-react'
import type { Trip } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { useTripBookings } from '@/hooks/useBookings'
import { useToday } from '@/hooks/useToday'
import { formatMoneyIn } from '@/lib/money'
import { BookingItem } from './BookingItem'
import { useBookingDialogs } from './useBookingDialogs'

/** A trip's own bookings, with the same cards and dialogs as the Bookings page. */
export function TripBookingsPanel({ trip }: { trip: Trip }) {
  const { data: bookings = [], isPending, isError, refetch, isFetching } = useTripBookings(trip.id)
  const dialogs = useBookingDialogs({ tripId: trip.id })
  const today = useToday()

  // Cancelled bookings aren't a cost; amounts in different currencies are listed, never added together.
  const costs = new Map<string, number>()
  for (const b of bookings) if (b.status !== 'cancelled') costs.set(b.currency, (costs.get(b.currency) ?? 0) + b.total_cost)
  const chronological = [...bookings].sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  const count = (s: string) => bookings.filter((b) => b.status === s).length

  return (
    <section aria-label="Trip bookings" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-fg">Bookings</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {bookings.length === 0
              ? 'Flights, hotels, transfers and reservations for this trip.'
              : `${count('confirmed')} confirmed · ${count('pending')} pending${costs.size ? ' · ' + [...costs].map(([c, t]) => formatMoneyIn(t, c)).join(' + ') : ''}`}
          </p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={dialogs.openCreate}>
          Add booking
        </Button>
      </div>

      {isPending ? (
        <div role="status" aria-label="Loading bookings" className="space-y-px overflow-hidden rounded-xl border border-line">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[4.25rem] rounded-none" />)}
        </div>
      ) : isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load the bookings" description="Something went wrong while fetching this trip’s bookings.">
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>Try again</Button>
        </StateCard>
      ) : bookings.length === 0 ? (
        <StateCard icon={Ticket} title="No bookings for this trip" description="Add your flight, hotel or a tour reservation. Confirmed ones also show up on the itinerary.">
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={dialogs.openCreate}>Add a booking</Button>
        </StateCard>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {chronological.map((b) => (
            <BookingItem key={b.id} booking={b} today={today} onOpen={dialogs.openDetails} onEdit={dialogs.openEdit} onDelete={dialogs.askDelete} />
          ))}
        </ul>
      )}

      {dialogs.element}
    </section>
  )
}
