import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CircleAlert, Plus, SearchX, Ticket } from 'lucide-react'
import type { BookingScope, BookingSort } from '@/api/bookings'
import type { BookingStatus, BookingType } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { BookingsToolbar, SORTS } from '@/components/bookings/BookingsToolbar'
import { TripGroup } from '@/components/bookings/TripGroup'
import { BookingAttentionBar } from '@/components/bookings/BookingAttentionBar'
import { BookingOverview } from '@/components/bookings/BookingOverview'
import { useBookingDialogs } from '@/components/bookings/useBookingDialogs'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { cn } from '@/components/ui/cn'
import { useAllOwnerBookings, useBookingSummary } from '@/hooks/useBookings'
import { useToday } from '@/hooks/useToday'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTrips } from '@/hooks/useTrips'
import { BOOKING_STATUSES, BOOKING_TYPES, STATUS_LABEL, TYPE_LABEL } from '@/lib/bookings'
import { bookingAttention, type AttentionIssue } from '@/lib/bookingAttention'
import { defaultOpenIds, groupBookingsByTrip } from '@/lib/bookingGroups'

const SCOPES: Array<{ value: BookingScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

const ATTENTION_ISSUES: AttentionIssue[] = ['pending', 'no_reference', 'no_documents']
const ATTENTION_FILTER_LABEL: Record<AttentionIssue, string> = { pending: 'not confirmed', no_reference: 'no reference', no_documents: 'no document' }

const isOneOf = <T extends string>(value: string | null, list: readonly T[]): value is T => list.includes(value as T)

export function BookingsPage() {
  useDocumentTitle('Bookings')
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const dialogs = useBookingDialogs()
  const trips = useTrips()

  // Filters live in the URL, so a filtered view can be reloaded, shared or reached with Back.
  const type = isOneOf(params.get('type'), BOOKING_TYPES) ? (params.get('type') as BookingType) : undefined
  const status = isOneOf(params.get('status'), BOOKING_STATUSES) ? (params.get('status') as BookingStatus) : undefined
  const scope = isOneOf(params.get('scope'), SCOPES.map((s) => s.value)) ? (params.get('scope') as BookingScope) : 'all'
  const sort = isOneOf(params.get('sort'), SORTS.map((s) => s.value)) ? (params.get('sort') as BookingSort) : 'start_asc'
  const tripId = params.get('trip') ?? undefined
  const attentionFilter = isOneOf(params.get('attention'), ATTENTION_ISSUES) ? (params.get('attention') as AttentionIssue) : undefined

  const [search, setSearch] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const setParam = (key: string, value: string | undefined, fallback = '') => {
    setParams(
      () => {
        // Start from the live URL: the router's own "current" is the value from the last render, which
        // is stale if another filter change landed in the same instant (e.g. Clear, then a sort).
        const next = new URLSearchParams(window.location.search)
        if (value && value !== fallback) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced.trim()) setParam('q', debounced.trim() || undefined)
  }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps

  // "New booking" from the Add menu arrives as ?new=1; open the form once and tidy the URL.
  useEffect(() => {
    if (params.get('new') === '1') {
      dialogs.openCreate()
      setParams(() => { const n = new URLSearchParams(window.location.search); n.delete('new'); return n }, { replace: true })
    }
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = useMemo(
    () => ({ q: debounced.trim() || undefined, type, status, trip_id: tripId, scope, sort, today }),
    [debounced, type, status, tripId, scope, sort, today],
  )
  const list = useAllOwnerBookings(query)
  const summary = useBookingSummary(today)
  // Every booking, whatever the filters, for the action list. With nothing filtered this is the same query as the list.
  const everything = useAllOwnerBookings({ scope: 'all', sort: 'start_asc', today })
  const attention = useMemo(() => bookingAttention(everything.data?.items ?? [], today), [everything.data, today])
  const issuesById = useMemo(() => new Map(attention.map((a) => [a.booking.id, a.issues])), [attention])
  const attentionCounts = useMemo(
    () => ({
      pending: attention.filter((a) => a.issues.includes('pending')).length,
      no_reference: attention.filter((a) => a.issues.includes('no_reference')).length,
      no_documents: attention.filter((a) => a.issues.includes('no_documents')).length,
    }),
    [attention],
  )

  const filtered = Boolean(query.q || type || status || tripId || attentionFilter)
  const anyNarrowing = filtered || scope !== 'all'
  const clearFilters = () => {
    setSearch('')
    setDebounced('')
    setParams(() => new URLSearchParams(scope !== 'all' ? { scope } : {}), { replace: true }) // keeps the Upcoming/Past tab
  }
  // Back to the whole list: no search, filters or Upcoming/Past tab.
  const showEverything = () => {
    setSearch('')
    setDebounced('')
    setParams(() => new URLSearchParams(), { replace: true })
  }
  const items = useMemo(() => {
    const all = list.data?.items ?? []
    return attentionFilter ? all.filter((b) => issuesById.get(b.id)?.includes(attentionFilter)) : all
  }, [list.data, attentionFilter, issuesById])
  const total = items.length
  const noBookingsAtAll = summary.data?.total === 0

  // Trips with their reservations, in trip order. Which ones are open: the user's own toggles win,
  // otherwise the trips that matter now (and everything while a search or filter is on).
  const tripList = trips.data
  const groups = useMemo(() => groupBookingsByTrip(items, tripList ?? [], today), [items, tripList, today])
  const viewKey = JSON.stringify({ ...query, attentionFilter })
  const [toggles, setToggles] = useState<{ key: string; map: Record<string, boolean> }>({ key: viewKey, map: {} })
  const defaults = useMemo(() => defaultOpenIds(groups, { openAll: anyNarrowing }), [groups, anyNarrowing])
  const isOpen = (id: string) => (toggles.key === viewKey ? toggles.map[id] : undefined) ?? defaults.has(id)
  const setOpen = (id: string, open: boolean) =>
    setToggles((t) => ({ key: viewKey, map: { ...(t.key === viewKey ? t.map : {}), [id]: open } }))
  const setAllOpen = (open: boolean) => setToggles({ key: viewKey, map: Object.fromEntries(groups.map((g) => [g.trip.id, open])) })
  const allOpen = groups.length > 0 && groups.every((g) => isOpen(g.trip.id))

  // The sentence shown when nothing matches, built from the filters that are actually on.
  const activeFilters = [
    query.q && `“${query.q}”`,
    type && TYPE_LABEL[type],
    status && STATUS_LABEL[status].toLowerCase(),
    tripId && (trips.data ?? []).find((t) => t.id === tripId)?.title,
    attentionFilter && ATTENTION_FILTER_LABEL[attentionFilter],
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Flights, hotels, transfers and reservations across all your trips."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={dialogs.openCreate}>
            Add booking
          </Button>
        }
      />

      {!noBookingsAtAll && (
        <>
          <BookingOverview
            summary={summary.data}
            loading={summary.isPending}
            tripTotal={trips.data?.length}
            status={status}
            showingAll={!anyNarrowing}
            onStatus={(v) => setParam('status', v)}
            onShowAll={showEverything}
          />
          <BookingAttentionBar
            total={attention.length}
            counts={attentionCounts}
            active={attentionFilter}
            onSelect={(v) => setParam('attention', v)}
          />
        </>
      )}

      <section aria-labelledby="all-bookings-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h2 id="all-bookings-heading" className="sr-only">All bookings</h2>
          <div role="tablist" aria-label="Which bookings to show" className="flex gap-1 border-b border-line">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={scope === s.value}
                onClick={() => setParam('scope', s.value, 'all')}
                className={cn(
                  '-mb-px h-10 border-b-2 px-3 text-sm font-medium transition-colors',
                  scope === s.value ? 'border-primary text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {!noBookingsAtAll && !list.isPending && !list.isError && (
            <p aria-live="polite" className="pb-2 text-sm text-fg-subtle">
              {groups.length} {groups.length === 1 ? 'trip' : 'trips'} · {total} {total === 1 ? 'reservation' : 'reservations'}
              {anyNarrowing && (
                <>
                  {' · '}
                  <button type="button" onClick={clearFilters} className="font-medium text-primary-ink hover:underline">Clear filters</button>
                </>
              )}
              {groups.length > 1 && (
                <>
                  {' · '}
                  <button type="button" onClick={() => setAllOpen(!allOpen)} className="font-medium text-primary-ink hover:underline">
                    {allOpen ? 'Collapse all' : 'Expand all'}
                  </button>
                </>
              )}
            </p>
          )}
        </div>

        {!noBookingsAtAll && (
          <BookingsToolbar
            search={search}
            onSearch={setSearch}
            type={type}
            onType={(v) => setParam('type', v)}
            status={status}
            onStatus={(v) => setParam('status', v)}
            tripId={tripId}
            onTrip={(v) => setParam('trip', v)}
            sort={sort}
            onSort={(v) => setParam('sort', v, 'start_asc')}
            trips={trips.data ?? []}
            typeCounts={summary.data?.by_type}
          />
        )}

        {list.isPending || trips.isPending ? (
          <div role="status" aria-label="Loading bookings" className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : list.isError ? (
          <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your bookings" description="Something went wrong while fetching them. Your bookings are safe.">
            <Button variant="secondary" onClick={() => list.refetch()} loading={list.isFetching}>Try again</Button>
          </StateCard>
        ) : noBookingsAtAll ? (
          <StateCard icon={Ticket} title="No bookings yet" description="Keep every flight, hotel, transfer and tour in one place, with confirmation numbers, costs and the documents that go with them.">
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={dialogs.openCreate}>Add your first booking</Button>
          </StateCard>
        ) : items.length === 0 ? (
          <StateCard
            icon={SearchX}
            title={activeFilters.length > 0 ? 'No bookings match' : scope === 'upcoming' ? 'Nothing coming up' : scope === 'past' ? 'No past bookings' : 'No bookings here'}
            description={
              activeFilters.length > 0
                ? `Nothing matches ${activeFilters.join(' · ')}${scope !== 'all' ? ` in ${scope} bookings` : ''}. Try fewer filters or a different search.`
                : scope === 'upcoming'
                  ? 'Pending and confirmed bookings that haven’t finished will appear here.'
                  : 'Bookings that have finished or been completed will appear here.'
            }
          >
            {activeFilters.length > 0 ? (
              <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Button variant="secondary" onClick={() => setParam('scope', 'all', 'all')}>Show all bookings</Button>
            )}
          </StateCard>
        ) : (
          <div className={cn('space-y-3', list.isFetching && 'opacity-70 transition-opacity')}>
            {groups.map((group) => (
              <TripGroup
                key={group.trip.id}
                group={group}
                today={today}
                open={isOpen(group.trip.id)}
                onToggle={() => setOpen(group.trip.id, !isOpen(group.trip.id))}
                onOpenBooking={dialogs.openDetails}
                onEdit={dialogs.openEdit}
                onDelete={dialogs.askDelete}
                issues={issuesById}
              />
            ))}
            {list.data?.truncated && (
              <p className="text-center text-xs text-fg-subtle">Showing the first {total} reservations. Narrow the search to see the rest.</p>
            )}
          </div>
        )}
      </section>

      {dialogs.element}
    </div>
  )
}
