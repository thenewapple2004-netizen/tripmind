import { useId, useState } from 'react'
import { ListFilter, Search, X } from 'lucide-react'
import type { BookingSort } from '@/api/bookings'
import type { BookingStatus, BookingType, Trip } from '@/api/types'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { BOOKING_STATUSES, BOOKING_TYPES, STATUS_LABEL, TYPE_LABEL } from '@/lib/bookings'

export const SORTS: Array<{ value: BookingSort; label: string }> = [
  { value: 'start_asc', label: 'Soonest first' },
  { value: 'start_desc', label: 'Latest first' },
  { value: 'cost_desc', label: 'Highest cost' },
  { value: 'cost_asc', label: 'Lowest cost' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'created_desc', label: 'Recently added' },
]

interface ToolbarProps {
  search: string
  onSearch: (value: string) => void
  type?: BookingType
  onType: (value: BookingType | undefined) => void
  status?: BookingStatus
  onStatus: (value: BookingStatus | undefined) => void
  tripId?: string
  onTrip: (value: string | undefined) => void
  sort: BookingSort
  onSort: (value: BookingSort) => void
  trips: Trip[]
  typeCounts?: Record<BookingType, number>
}

const select = cn(inputStyles, 'w-full')

/**
 * One toolbar for everything that narrows or orders the list: search, type, status, trip and sort.
 * On a phone only the search box shows; the rest open from a single Filters button.
 */
export function BookingsToolbar({ search, onSearch, type, onType, status, onStatus, tripId, onTrip, sort, onSort, trips, typeCounts }: ToolbarProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const active = [type, status, tripId].filter(Boolean).length

  return (
    <div className="flex flex-wrap items-center gap-2" role="search">
      <div className="relative min-w-0 flex-1 basis-60 @max-4xl:basis-full">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search bookings"
          aria-label="Search bookings by title, provider, confirmation number, place or trip"
          className={cn(inputStyles, 'pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Clear search" className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2 sm:hidden"
      >
        <ListFilter className="size-4" aria-hidden />
        Filters
        {active > 0 && <span className="rounded bg-primary px-1.5 text-xs font-semibold text-primary-fg">{active}</span>}
      </button>

      {/* Phone: a Filters panel under the search. Tablet: an even four-column grid under it. Wide: the same row as the search. */}
      <div id={panelId} className={cn('basis-full grid-cols-2 gap-2 sm:grid sm:grid-cols-4 @4xl:contents', open ? 'grid' : 'hidden sm:grid @4xl:contents')}>
        <div className="@4xl:w-40">
          <select aria-label="Booking type" value={type ?? ''} onChange={(e) => onType((e.target.value || undefined) as BookingType | undefined)} className={select}>
            <option value="">All types</option>
            {BOOKING_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}{typeCounts ? ` (${typeCounts[t]})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="@4xl:w-36">
          <select aria-label="Reservation status" value={status ?? ''} onChange={(e) => onStatus((e.target.value || undefined) as BookingStatus | undefined)} className={select}>
            <option value="">Any status</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="@4xl:w-48">
          <select aria-label="Trip" value={tripId ?? ''} onChange={(e) => onTrip(e.target.value || undefined)} className={select}>
            <option value="">All trips</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        <div className="@4xl:w-48">
          <select aria-label="Sort by" value={sort} onChange={(e) => onSort(e.target.value as BookingSort)} className={select}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>Sort: {s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
