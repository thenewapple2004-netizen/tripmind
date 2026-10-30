import { CalendarClock, PlaneTakeoff, Users } from 'lucide-react'
import type { Inquiry } from '@/api/crmTypes'
import { cn } from '@/components/ui/cn'
import { budgetLabel, datesLabel, dueLabel, SOURCE_LABEL } from '@/lib/crm'
import { MoveMenu } from './MoveMenu'
import { useWorkspace } from './Workspace'

/** The next follow-up as a small line: red when overdue, green-ink when due today. */
export function NextFollowUp({ inquiry, today, className }: { inquiry: Inquiry; today: string; className?: string }) {
  if (!inquiry.next_follow_up_on) return null
  const due = inquiry.next_follow_up_on
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        due < today ? 'font-semibold text-danger' : due === today ? 'font-semibold text-primary-ink' : 'text-fg-muted',
        className,
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      <span className="sr-only">Next follow-up: </span>
      {dueLabel(due, today)}
    </span>
  )
}

/**
 * A card on the board. The whole card opens the inquiry (the title is the real button, stretched over the
 * card); the move menu sits above it. The card itself is draggable.
 */
export function InquiryCard({
  inquiry,
  today,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  inquiry: Inquiry
  today: string
  dragging: boolean
  onDragStart: (inquiry: Inquiry, event: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const workspace = useWorkspace()
  const budget = budgetLabel(inquiry)
  const locked = inquiry.allowed_stages.length === 0

  return (
    <article
      draggable={!locked}
      onDragStart={(e) => onDragStart(inquiry, e)}
      onDragEnd={onDragEnd}
      aria-label={`${inquiry.destination} for ${inquiry.customer.name}`}
      className={cn(
        'relative rounded-lg border border-line bg-surface p-3 shadow-card transition-[border-color,opacity,box-shadow] hover:border-line-strong has-focus-visible:ring-3 has-focus-visible:ring-primary/30',
        !locked && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-fg-muted">{inquiry.customer.name}</p>
          <h3 className="mt-0.5 text-sm leading-snug font-semibold break-words text-fg">
            <button
              type="button"
              onClick={() => workspace.openInquiry(inquiry.id)}
              className="text-left after:absolute after:inset-0 after:rounded-lg focus:outline-none"
            >
              {inquiry.destination}
            </button>
          </h3>
        </div>
        <MoveMenu inquiry={inquiry} className="relative z-10 -mt-1 -mr-1 shrink-0" />
      </div>

      <p className="mt-2 text-xs text-fg-muted">{datesLabel(inquiry)}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5 text-fg-subtle" aria-hidden />
          {inquiry.travelers}
          <span className="sr-only"> travelers</span>
        </span>
        {budget && <span className="tabular-nums">{budget}</span>}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <NextFollowUp inquiry={inquiry} today={today} />
        {inquiry.converted_trip_id ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-soft-fg">
            <PlaneTakeoff className="size-3.5" aria-hidden />
            Trip created
          </span>
        ) : (
          <span className="text-xs text-fg-subtle">{SOURCE_LABEL[inquiry.source]}</span>
        )}
      </div>
    </article>
  )
}
