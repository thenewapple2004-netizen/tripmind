import type { Inquiry } from '@/api/crmTypes'
import { cn } from '@/components/ui/cn'
import {
  accommodationLabel, comfortLabel, groupLabel, paceLabel, styleLabel, datesLabel, budgetLabel, briefIsEmpty, SOURCE_LABEL,
} from '@/lib/crm'
import { formatDate } from '@/lib/trips'
import { Fact } from './bits'

const Chips = ({ items }: { items: string[] }) => (
  <ul className="flex flex-wrap gap-1.5">
    {items.map((item) => (
      <li key={item} className="rounded-md bg-surface-3 px-2 py-0.5 text-xs font-medium text-fg-muted">
        {item}
      </li>
    ))}
  </ul>
)

/** A read-only view of the inquiry's facts and its travel brief. Editing happens in the guided form. */
export function BriefSummary({ inquiry, className }: { inquiry: Inquiry; className?: string }) {
  const b = inquiry.brief
  const budget = budgetLabel(inquiry)
  const flexibility = b.flexible_dates
    ? b.flexibility_days
      ? `Flexible by ${b.flexibility_days} days either way`
      : 'Flexible'
    : null

  return (
    <div className={cn('space-y-5', className)}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Fact label="Preferred dates">
          {datesLabel(inquiry)}
          {flexibility && <span className="block text-fg-muted">{flexibility}</span>}
          {b.trip_length_nights && <span className="block text-fg-muted">{b.trip_length_nights} nights</span>}
        </Fact>
        <Fact label="Travelers">{groupLabel(inquiry)}</Fact>
        <Fact label="Budget">{budget ?? <span className="text-fg-subtle">Not given</span>}</Fact>
        <Fact label="Source">{SOURCE_LABEL[inquiry.source]}</Fact>
      </dl>

      {briefIsEmpty(b) ? (
        <p className="text-sm text-fg-subtle">No further requirements recorded yet.</p>
      ) : (
        <dl className="space-y-3.5">
          {(b.accommodation_types.length > 0 || b.comfort_level || b.room_preferences) && (
            <Fact label="Stay">
              <div className="space-y-1.5">
                {b.accommodation_types.length > 0 && <Chips items={b.accommodation_types.map(accommodationLabel)} />}
                {b.comfort_level && <p>{comfortLabel(b.comfort_level)} comfort</p>}
                {b.room_preferences && <p className="text-fg-muted">{b.room_preferences}</p>}
              </div>
            </Fact>
          )}
          {(b.travel_styles.length > 0 || b.pace || b.transport_preferences) && (
            <Fact label="Style">
              <div className="space-y-1.5">
                {b.travel_styles.length > 0 && <Chips items={b.travel_styles.map(styleLabel)} />}
                {b.pace && <p>{paceLabel(b.pace)} pace</p>}
                {b.transport_preferences && <p className="text-fg-muted">{b.transport_preferences}</p>}
              </div>
            </Fact>
          )}
          {b.special_requests && <Fact label="Special requests"><p className="whitespace-pre-line">{b.special_requests}</p></Fact>}
          {b.additional_notes && <Fact label="From the customer"><p className="whitespace-pre-line">{b.additional_notes}</p></Fact>}
        </dl>
      )}

      <p className="text-xs text-fg-subtle">
        Added {formatDate(inquiry.created_at.slice(0, 10))}
      </p>
    </div>
  )
}
