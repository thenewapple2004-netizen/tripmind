import { BedDouble, Compass, Car, Plane, type LucideIcon } from 'lucide-react'
import type { BookingStatus, BookingType } from '@/api/types'
import { cn } from '@/components/ui/cn'
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/bookings'

export const TYPE_META: Record<BookingType, { icon: LucideIcon; tile: string; bar: string }> = {
  flight: { icon: Plane, tile: 'bg-info-soft text-info-soft-fg', bar: 'bg-[#79c0e8]' },
  hotel: { icon: BedDouble, tile: 'bg-primary-soft text-primary-soft-fg', bar: 'bg-primary' },
  transportation: { icon: Car, tile: 'bg-warn-soft text-warn-soft-fg', bar: 'bg-[#f0c35a]' },
  activity: { icon: Compass, tile: 'bg-teal-500/15 text-teal-700 dark:text-teal-300', bar: 'bg-[#4fd1b5]' },
}

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: 'bg-warn-soft text-warn-soft-fg',
  confirmed: 'bg-success-soft text-success-soft-fg',
  cancelled: 'bg-danger-soft text-danger-soft-fg',
  completed: 'bg-neutral-soft text-neutral-soft-fg',
}

export function TypeTile({ type, className }: { type: BookingType; className?: string }) {
  const { icon: Icon, tile } = TYPE_META[type]
  return (
    <span
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', tile, className)}
      title={TYPE_LABEL[type]}
    >
      <Icon className="size-5" aria-hidden />
      <span className="sr-only">{TYPE_LABEL[type]}</span>
    </span>
  )
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  )
}
