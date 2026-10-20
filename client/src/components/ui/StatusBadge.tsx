import { CircleCheck, Hourglass, Plane } from 'lucide-react'
import { STATUS_LABEL, type TripStatus } from '@/lib/trips'
import { cn } from './cn'

const styles: Record<TripStatus, string> = {
  upcoming: 'bg-info-soft text-info-soft-fg',
  ongoing: 'bg-success-soft text-success-soft-fg',
  completed: 'bg-neutral-soft text-neutral-soft-fg',
}

const icons = {
  upcoming: Hourglass,
  ongoing: Plane,
  completed: CircleCheck,
} satisfies Record<TripStatus, unknown>

export function StatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  const Icon = icons[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        styles[status],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}
