import { BedDouble, Compass, Car, Plane, type LucideIcon } from 'lucide-react'
import type { BookingStatus, BookingType } from '@/api/types'
import { cn } from '@/components/ui/cn'
import { STATUS_LABEL, TYPE_LABEL, type TimingTone } from '@/lib/bookings'

/**
 * The booking type is told apart by its icon and its label, not by a colour of its own. Colour is kept
 * for the one thing that really needs it: the reservation status.
 */
export const TYPE_META: Record<BookingType, { icon: LucideIcon; tile: string }> = {
  flight: { icon: Plane, tile: 'bg-surface-3 text-fg-muted' },
  hotel: { icon: BedDouble, tile: 'bg-surface-3 text-fg-muted' },
  transportation: { icon: Car, tile: 'bg-surface-3 text-fg-muted' },
  activity: { icon: Compass, tile: 'bg-surface-3 text-fg-muted' },
}

export function TypeTile({ type, className }: { type: BookingType; className?: string }) {
  const { icon: Icon, tile } = TYPE_META[type]
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tile, className)} title={TYPE_LABEL[type]}>
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{TYPE_LABEL[type]}</span>
    </span>
  )
}

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: 'bg-warn-soft text-warn-soft-fg',
  confirmed: 'bg-success-soft text-success-soft-fg',
  cancelled: 'bg-danger-soft text-danger-soft-fg',
  completed: 'bg-neutral-soft text-neutral-soft-fg',
}

/** The reservation status: the only badge on a booking row. Timing (Today, In 5 days) is plain text. */
export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_STYLE[status], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  )
}

const TIMING_STYLE: Record<TimingTone, string> = {
  live: 'font-semibold text-primary-ink',
  soon: 'font-medium text-fg',
  later: 'text-fg-muted',
  done: 'text-fg-subtle',
}

/** Today, Tomorrow, In progress, In 5 days: when it happens relative to now. Deliberately not a badge. */
export function Timing({ label, tone, className }: { label: string; tone: TimingTone; className?: string }) {
  return <span className={cn(TIMING_STYLE[tone], className)}>{label}</span>
}

const STATUS_TEXT: Record<BookingStatus, string> = {
  pending: 'text-warn-soft-fg',
  confirmed: 'text-success-soft-fg',
  cancelled: 'text-danger-soft-fg',
  completed: 'text-fg-subtle',
}

/** Status for dense lists: a dot and a word, no filled badge. The full badge is kept for the pass. */
export function StatusText({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', STATUS_TEXT[status], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  )
}
