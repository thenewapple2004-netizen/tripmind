import { CalendarClock, ArrowRight } from 'lucide-react'
import type { OwnerBooking } from '@/api/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/components/ui/cn'
import { countdown, formatBookingWhen } from '@/lib/bookings'
import { formatMoneyIn } from '@/lib/money'
import { BookingStatusBadge, TypeTile } from './meta'

/** The next few reservations, always shown regardless of the filters below it. */
export function UpcomingBookings({
  items,
  today,
  onOpen,
  onShowAll,
}: {
  items: OwnerBooking[]
  today: string
  onOpen: (b: OwnerBooking) => void
  onShowAll: () => void
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader
        title="Coming up"
        description="Your next reservations, soonest first"
        icon={<CalendarClock className="size-4" aria-hidden />}
        action={
          <button type="button" onClick={onShowAll} className="group flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline">
            See all upcoming
            <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </button>
        }
      />
      <ul className="grid gap-2 @2xl:grid-cols-2">
        {items.map((b) => {
          const when = countdown(b, today)
          return (
            <li key={b.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(b)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <TypeTile type={b.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{b.title}</span>
                  <span className="block truncate text-xs text-fg-subtle tabular-nums">{formatBookingWhen(b)}</span>
                  <span className="block truncate text-xs text-fg-subtle">{b.trip_title}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', when === 'Today' || when === 'Tomorrow' || when === 'In progress' ? 'bg-primary text-primary-fg' : 'bg-primary-soft text-primary-soft-fg')}>
                    {when}
                  </span>
                  <BookingStatusBadge status={b.status} className="px-2 py-0.5 text-[10px]" />
                  <span className="text-[11px] font-semibold text-fg-muted tabular-nums">{formatMoneyIn(b.total_cost, b.currency)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
