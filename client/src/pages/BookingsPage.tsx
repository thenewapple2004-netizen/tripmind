import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CircleAlert, Plus, Search, SearchX, Ticket, X } from 'lucide-react'
import type { BookingScope, BookingSort } from '@/api/bookings'
import type { BookingStatus, BookingType } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { BookingCard } from '@/components/bookings/BookingCard'
import { TYPE_META } from '@/components/bookings/meta'
import { UpcomingBookings } from '@/components/bookings/UpcomingBookings'
import { useBookingDialogs } from '@/components/bookings/useBookingDialogs'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useBookingSummary, useOwnerBookings } from '@/hooks/useBookings'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTrips } from '@/hooks/useTrips'
import { BOOKING_STATUSES, BOOKING_TYPES, STATUS_LABEL, TYPE_LABEL, todayISO } from '@/lib/bookings'
import { formatMoneyIn } from '@/lib/money'

const PAGE_SIZE = 9
const SCOPES: Array<{ value: BookingScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]
const SORTS: Array<{ value: BookingSort; label: string }> = [
  { value: 'start_asc', label: 'Soonest first' },
  { value: 'start_desc', label: 'Latest first' },
  { value: 'cost_desc', label: 'Highest cost' },
  { value: 'cost_asc', label: 'Lowest cost' },
  { value: 'title_asc', label: 'Title (A–Z)' },
  { value: 'created_desc', label: 'Recently added' },
]

const isOneOf = <T extends string>(value: string | null, list: readonly T[]): value is T => list.includes(value as T)

function Stat({ label, value, helper, onClick, active }: { label: string; value: string; helper?: string; onClick?: () => void; active?: boolean }) {
  const body = (
    <>
      <p className="text-xs font-medium text-fg-subtle">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tracking-tight text-fg tabular-nums">{value}</p>
      {helper && <p className="mt-0.5 truncate text-xs text-fg-muted">{helper}</p>}
    </>
  )
  const cls = cn('rounded-3xl border p-4 text-left shadow-card transition', active ? 'border-primary bg-primary-soft/40' : 'border-line bg-surface')
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn(cls, 'hover:border-primary/40')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function BookingsPage() {
  useDocumentTitle('Bookings')
  const today = todayISO()
  const [params, setParams] = useSearchParams()
  const dialogs = useBookingDialogs()
  const trips = useTrips()

  // Filters live in the URL, so a filtered view can be reloaded, shared or reached with Back.
  const type = isOneOf(params.get('type'), BOOKING_TYPES) ? (params.get('type') as BookingType) : undefined
  const status = isOneOf(params.get('status'), BOOKING_STATUSES) ? (params.get('status') as BookingStatus) : undefined
  const scope = isOneOf(params.get('scope'), SCOPES.map((s) => s.value)) ? (params.get('scope') as BookingScope) : 'all'
  const sort = isOneOf(params.get('sort'), SORTS.map((s) => s.value)) ? (params.get('sort') as BookingSort) : 'start_asc'
  const tripId = params.get('trip') ?? undefined
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)

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
        if (key !== 'page') next.delete('page') // any change of filter starts again at page 1
        return next
      },
      { replace: true },
    )
  }
  useEffect(() => {
    // Only when the text really changed: re-applying it would reset the page on every reload.
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
    () => ({ q: debounced.trim() || undefined, type, status, trip_id: tripId, scope, sort, today, page, page_size: PAGE_SIZE }),
    [debounced, type, status, tripId, scope, sort, today, page],
  )
  const list = useOwnerBookings(query)
  const summary = useBookingSummary(today)
  const upcoming = useOwnerBookings({ scope: 'upcoming', sort: 'start_asc', today, page: 1, page_size: 4 })

  const filtered = Boolean(query.q || type || status || tripId || scope !== 'all')
  const clearFilters = () => {
    setSearch('')
    setDebounced('')
    setParams({}, { replace: true })
  }
  const items = list.data?.items ?? []
  const noBookingsAtAll = summary.data?.total === 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Every flight, hotel, transfer and reservation across your trips, in one place."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={dialogs.openCreate}>
            New booking
          </Button>
        }
      />

      {summary.data ? (
        <section aria-label="Booking summary" className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
          <Stat label="Upcoming" value={String(summary.data.upcoming_count)} active={scope === 'upcoming'} onClick={() => setParam('scope', scope === 'upcoming' ? undefined : 'upcoming', 'all')}
            helper={summary.data.upcoming_cost.length ? summary.data.upcoming_cost.map((c) => formatMoneyIn(c.total, c.currency)).join(' · ') : 'Nothing coming up'} />
          <Stat label="Confirmed" value={String(summary.data.by_status.confirmed)} active={status === 'confirmed'} onClick={() => setParam('status', status === 'confirmed' ? undefined : 'confirmed')} />
          <Stat label="Pending" value={String(summary.data.by_status.pending)} active={status === 'pending'} onClick={() => setParam('status', status === 'pending' ? undefined : 'pending')} helper={summary.data.by_status.pending ? 'Waiting to be confirmed' : undefined} />
          <Stat label="All bookings" value={String(summary.data.total)} helper={`${summary.data.by_status.completed} completed · ${summary.data.by_status.cancelled} cancelled`} />
        </section>
      ) : summary.isPending ? (
        <div role="status" aria-label="Loading summary" className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}
        </div>
      ) : null}

      <UpcomingBookings
        items={upcoming.data?.items ?? []}
        today={today}
        onOpen={dialogs.openDetails}
        onShowAll={() => setParams({ scope: 'upcoming' }, { replace: true })}
      />

      {!noBookingsAtAll && (
        <Card className="space-y-4">
          <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, provider, confirmation number, place or trip"
                aria-label="Search bookings"
                className={cn(inputStyles, 'pl-9 [&::-webkit-search-cancel-button]:hidden')}
              />
            </div>
            <div role="group" aria-label="Show" className="flex shrink-0 rounded-2xl border border-line bg-surface-2 p-1">
              {SCOPES.map((s) => (
                <button key={s.value} type="button" aria-pressed={scope === s.value} onClick={() => setParam('scope', s.value, 'all')}
                  className={cn('h-8 rounded-xl px-3 text-xs font-semibold transition', scope === s.value ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg')}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Type" className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!type} onClick={() => setParam('type', undefined)}
                className={cn('h-9 rounded-full border px-4 text-xs font-semibold transition', !type ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface-2 text-fg-muted hover:text-fg')}>
                All types
              </button>
              {BOOKING_TYPES.map((t) => {
                const Icon = TYPE_META[t].icon
                return (
                  <button key={t} type="button" aria-pressed={type === t} onClick={() => setParam('type', type === t ? undefined : t)}
                    className={cn('flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition', type === t ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface-2 text-fg-muted hover:text-fg')}>
                    <Icon className="size-3.5" aria-hidden />
                    {TYPE_LABEL[t]}
                    {summary.data && <span className="opacity-70 tabular-nums">{summary.data.by_type[t]}</span>}
                  </button>
                )
              })}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Each select sits in a fixed-width box: the shared input style is `w-full`, which would stretch it. */}
              <div className="w-36">
                <select aria-label="Status" value={status ?? ''} onChange={(e) => setParam('status', e.target.value || undefined)} className={cn(inputStyles, 'h-9 py-0 text-xs')}>
                  <option value="">Any status</option>
                  {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="w-44">
                <select aria-label="Trip" value={tripId ?? ''} onChange={(e) => setParam('trip', e.target.value || undefined)} className={cn(inputStyles, 'h-9 py-0 text-xs')}>
                  <option value="">All trips</option>
                  {(trips.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div className="w-40">
                <select aria-label="Sort by" value={sort} onChange={(e) => setParam('sort', e.target.value, 'start_asc')} className={cn(inputStyles, 'h-9 py-0 text-xs')}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {filtered && (
                <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={clearFilters}>Clear</Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {list.isPending ? (
        <div role="status" aria-label="Loading bookings" className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52 rounded-3xl" />)}
        </div>
      ) : list.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your bookings" description="Something went wrong while fetching them.">
          <Button variant="secondary" onClick={() => list.refetch()} loading={list.isFetching}>Try again</Button>
        </StateCard>
      ) : noBookingsAtAll ? (
        <StateCard icon={Ticket} title="No bookings yet" description="Record your flights, hotels, transfers and tours here, with confirmation numbers, costs and the documents that go with them.">
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={dialogs.openCreate}>Add your first booking</Button>
        </StateCard>
      ) : items.length === 0 ? (
        <StateCard icon={SearchX} title="No bookings match" description="Try a different search or filter, or clear them to see everything.">
          <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
        </StateCard>
      ) : (
        <>
          <p aria-live="polite" className="text-sm text-fg-subtle">
            {filtered ? `${list.data?.total} matching` : `${list.data?.total} ${list.data?.total === 1 ? 'booking' : 'bookings'}`}
          </p>
          <ul className={cn('grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3', list.isFetching && 'opacity-80 transition-opacity')}>
            {items.map((b) => (
              <li key={b.id} className="min-w-0">
                <BookingCard booking={b} today={today} onOpen={dialogs.openDetails} onEdit={dialogs.openEdit} onDelete={dialogs.askDelete} />
              </li>
            ))}
          </ul>
          <Pagination label="Booking pages" page={page} totalPages={list.data?.total_pages ?? 1} busy={list.isFetching}
            onChange={(p) => { setParam('page', String(p), '1'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </>
      )}

      {dialogs.element}
    </div>
  )
}
