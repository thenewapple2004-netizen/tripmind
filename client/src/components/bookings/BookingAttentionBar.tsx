import { CircleAlert } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { ATTENTION_WINDOW_DAYS, type AttentionIssue } from '@/lib/bookingAttention'

const CHIP_LABEL: Record<AttentionIssue, string> = {
  pending: 'not confirmed',
  no_reference: 'no reference',
  no_documents: 'no document',
}
const ORDER: AttentionIssue[] = ['pending', 'no_reference', 'no_documents']

/**
 * One slim line: how many reservations need attention and why. Each reason is a filter chip that narrows
 * the trip list below to just those reservations. Nothing is rendered when there is nothing to do.
 */
export function BookingAttentionBar({
  total,
  counts,
  active,
  onSelect,
}: {
  /** Reservations with at least one issue (one reservation can have two). */
  total: number
  counts: Record<AttentionIssue, number>
  active?: AttentionIssue
  onSelect: (issue: AttentionIssue | undefined) => void
}) {
  if (total === 0) return null
  return (
    <div role="group" aria-label="Reservations that need attention" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p
        className="flex items-center gap-1.5 text-sm font-medium text-fg"
        title={`Reservations starting within ${ATTENTION_WINDOW_DAYS} days or already under way. The Pending card above counts all pending bookings, however far off.`}
      >
        <CircleAlert className="size-4 shrink-0 text-warn-soft-fg" aria-hidden />
        <span className="tabular-nums">{total}</span> need attention
        <span className="font-normal text-fg-subtle">· next {ATTENTION_WINDOW_DAYS} days</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {ORDER.filter((issue) => counts[issue] > 0).map((issue) => (
          <button
            key={issue}
            type="button"
            aria-pressed={active === issue}
            onClick={() => onSelect(active === issue ? undefined : issue)}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
              active === issue
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <span className="tabular-nums">{counts[issue]}</span> {CHIP_LABEL[issue]}
          </button>
        ))}
      </div>
    </div>
  )
}
