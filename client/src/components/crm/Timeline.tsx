import { ArrowRight, CalendarCheck, CalendarPlus, FilePenLine, MessageSquareText, PlaneTakeoff, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import type { CrmEvent } from '@/api/crmTypes'
import { ago, exactTime } from '@/lib/crm'

const ICONS: Record<string, LucideIcon> = {
  customer_created: UserRound,
  customer_updated: FilePenLine,
  customer_archived: UserRound,
  customer_restored: UserRound,
  note: MessageSquareText,
  inquiry_created: Sparkles,
  inquiry_updated: FilePenLine,
  brief_updated: FilePenLine,
  stage_changed: ArrowRight,
  follow_up_created: CalendarPlus,
  follow_up_completed: CalendarCheck,
  follow_up_reopened: CalendarPlus,
  converted_to_trip: PlaneTakeoff,
}

/** The history of a customer or an inquiry, newest first. Every line is a recorded event. */
export function Timeline({ events }: { events: CrmEvent[] }) {
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[0.9375rem] before:w-px before:bg-line">
      {events.map((event) => {
        const Icon = ICONS[event.kind] ?? Sparkles
        return (
          <li key={event.id} className="relative flex gap-3">
            <span
              aria-hidden
              className="z-10 flex size-[1.875rem] shrink-0 items-center justify-center rounded-full border border-line bg-surface text-fg-subtle"
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm break-words text-fg">{event.summary}</p>
              <time dateTime={event.created_at} title={exactTime(event.created_at)} className="text-xs text-fg-subtle">
                {ago(event.created_at)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
