import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CircleAlert, Luggage, Plus, RefreshCw, Search, SearchX, X } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { inputStyles } from '@/components/ui/TextField'
import { StateCard } from '@/components/ui/StateCard'
import { cn } from '@/components/ui/cn'
import { PageHeader } from '@/components/PageHeader'
import { StatsRow, StatsRowSkeleton } from '@/components/StatsRow'
import { TripCard, TripCardSkeleton } from '@/components/TripCard'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTrips } from '@/hooks/useTrips'
import {
  SORT_OPTIONS,
  STATUS_LABEL,
  filterTrips,
  getTripStatus,
  pluralize,
  sortTrips,
  type SortKey,
  type StatusFilter,
} from '@/lib/trips'

const STATUS_FILTERS: StatusFilter[] = ['all', 'upcoming', 'ongoing', 'completed']

function isStatusFilter(value: string | null): value is StatusFilter {
  return STATUS_FILTERS.includes(value as StatusFilter)
}
function isSortKey(value: string | null): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value)
}

export function DashboardPage() {
  useDocumentTitle('Trips')
  const { data: trips, isPending, isError, error, refetch, isFetching } = useTrips()

  // Filters live in the URL so a filtered view can be bookmarked, shared, and survives Back.
  const [params, setParams] = useSearchParams()
  // The text box owns its value locally. Binding it straight to the URL makes fast typing
  // drop characters, because router updates land a render later than the keystrokes.
  // The URL is a one-way mirror of the text, read once on load.
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const status: StatusFilter = isStatusFilter(params.get('status')) ? (params.get('status') as StatusFilter) : 'all'
  const sort: SortKey = isSortKey(params.get('sort')) ? (params.get('sort') as SortKey) : 'upcoming'

  const updateQuery = (value: string) => {
    setQuery(value)
    setParam('q', value, '')
  }

  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value && value !== fallback) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const header = (
    <PageHeader title="Your trips" description="Plan, budget and keep track of every journey in one place." />
  )

  if (isPending) {
    return (
      <div className="space-y-8">
        {header}
        <div role="status" aria-label="Loading trips" className="space-y-8">
          <StatsRowSkeleton />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isError && !trips) {
    return (
      <div className="space-y-8">
        {header}
        <StateCard
          tone="danger"
          icon={CircleAlert}
          title="We couldn't load your trips"
          description={error.message}
        >
          <Button variant="primary" onClick={() => refetch()} loading={isFetching} icon={<RefreshCw className="size-4" aria-hidden />}>
            {isFetching ? 'Retrying…' : 'Try again'}
          </Button>
        </StateCard>
      </div>
    )
  }

  const allTrips = trips ?? []

  if (allTrips.length === 0) {
    return (
      <div className="space-y-8">
        {header}
        <StateCard
          icon={Luggage}
          title="No trips yet"
          description="Start by adding your first trip. You can set the dates and budget, and edit them any time."
        >
          <ButtonLink to="/trips/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
            Plan your first trip
          </ButtonLink>
        </StateCard>
      </div>
    )
  }

  const counts = allTrips.reduce<Record<StatusFilter, number>>(
    (acc, trip) => {
      acc.all += 1
      acc[getTripStatus(trip)] += 1
      return acc
    },
    { all: 0, upcoming: 0, ongoing: 0, completed: 0 },
  )
  const visible = sortTrips(filterTrips(allTrips, { query, status }), sort)
  const isFiltered = query.trim() !== '' || status !== 'all'
  const clearFilters = () => {
    setQuery('')
    setParams({}, { replace: true })
  }

  return (
    <div className="space-y-8">
      {header}

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-soft-fg"
        >
          <p className="flex items-center gap-2">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            We couldn't refresh your trips, so this may be out of date. {error.message}
          </p>
          <Button size="sm" variant="secondary" onClick={() => refetch()} loading={isFetching}>
            Retry
          </Button>
        </div>
      )}

      <StatsRow trips={allTrips} />

      <section aria-labelledby="trips-heading" className="space-y-5">
        <h2 id="trips-heading" className="sr-only">
          All trips
        </h2>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search trips or destinations"
              aria-label="Search trips or destinations"
              className={cn(inputStyles, 'pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden')}
            />
            {query && (
              <button
                type="button"
                onClick={() => updateQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
              {STATUS_FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setParam('status', value, 'all')}
                  className={cn(
                    'flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                    status === value
                      ? 'bg-primary-soft text-primary-soft-fg'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {value === 'all' ? 'All' : STATUS_LABEL[value]}
                  <span className="text-xs tabular-nums opacity-75">{counts[value]}</span>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={sort}
                onChange={(event) => setParam('sort', event.target.value, 'upcoming')}
                className={cn(inputStyles, 'w-full sm:w-48')}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p aria-live="polite" className="text-sm text-fg-subtle">
          {isFiltered
            ? `Showing ${visible.length} of ${pluralize(allTrips.length, 'trip')}`
            : pluralize(allTrips.length, 'trip')}
        </p>

        {visible.length === 0 ? (
          <StateCard
            icon={SearchX}
            title="No trips match your filters"
            description="Try a different search term or status, or clear the filters to see everything."
          >
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          </StateCard>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
