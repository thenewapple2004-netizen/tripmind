import { PlaneTakeoff } from 'lucide-react'
import type { Inquiry } from '@/api/crmTypes'
import { budgetLabel, datesLabel, groupLabel } from '@/lib/crm'
import { MoveMenu } from './MoveMenu'
import { NextFollowUp } from './InquiryCard'
import { StageBadge } from './StageBadge'
import { useWorkspace } from './Workspace'

/** The compact alternative to the board: one line per inquiry, in the order chosen. */
export function InquiryList({ inquiries, today }: { inquiries: Inquiry[]; today: string }) {
  const workspace = useWorkspace()
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {inquiries.map((i) => {
        const budget = budgetLabel(i)
        return (
          <li key={i.id} className="relative flex items-start gap-3 px-3.5 py-3 hover:bg-surface-2/70">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="min-w-0 text-sm font-semibold break-words text-fg">
                  <button type="button" onClick={() => workspace.openInquiry(i.id)} className="text-left after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-3 focus-visible:after:ring-primary/30">
                    {i.destination}
                  </button>
                </h3>
                <StageBadge stage={i.stage} />
                {i.converted_trip_id && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success-soft-fg">
                    <PlaneTakeoff className="size-3.5" aria-hidden />
                    Trip created
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-fg-muted">
                {i.customer.name} · {datesLabel(i)} · {groupLabel(i)}
                {budget && <span className="tabular-nums"> · {budget}</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <NextFollowUp inquiry={i} today={today} className="hidden sm:inline-flex" />
              <MoveMenu inquiry={i} className="relative z-10" />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
