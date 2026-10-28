/**
 * OwnerPortalPage.tsx
 * ===================
 * The Overview of the TripMind Owner Portal. Everything on this page is read from the
 * existing APIs (owner dashboard, trips, owner activities); empty accounts get empty states.
 */

import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, CircleAlert, Luggage, Plus, RefreshCw } from 'lucide-react'
import { DestinationCard, DestinationCardSkeleton } from '@/components/portal/DestinationCard'
import { BudgetSummaryCard, TripStatusCard } from '@/components/portal/BudgetSummary'
import { BudgetWatch } from '@/components/portal/BudgetWatch'
import { QuickAddButton } from '@/components/portal/QuickAdd'
import { QuickTiles } from '@/components/portal/QuickTiles'
import { RecentTabs } from '@/components/portal/RecentTabs'
import { TripSearchBar } from '@/components/portal/SearchBar'
import { CategoryCard, SpendingTrendCard } from '@/components/portal/SpendingCharts'
import { WeekAgenda } from '@/components/portal/WeekAgenda'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOwnerActivities, useOwnerDashboard } from '@/hooks/useOwnerDashboard'
import { useTrips } from '@/hooks/useTrips'
import { useIdentity } from '@/hooks/useProfile'
import { greeting } from '@/lib/owner'
import { sortTrips } from '@/lib/trips'

function SectionTitle({ title, to, cta }: { title: string; to?: string; cta?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-lg font-bold tracking-tight text-fg">{title}</h2>
      {to && (
        <Link to={to} className="group flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline">
          {cta}
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  )
}

export function OwnerPortalPage() {
  useDocumentTitle('Overview')
  const { firstName, profile } = useIdentity()
  const dashboard = useOwnerDashboard()
  const tripsQuery = useTrips()
  const activitiesQuery = useOwnerActivities(1, 50)

  const featured = useMemo(() => sortTrips(tripsQuery.data ?? [], 'upcoming').slice(0, 3), [tripsQuery.data])
  const data = dashboard.data

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {greeting(new Date(), profile?.timezone)}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">Here's where your travels stand today.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/trips/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
            New trip
          </ButtonLink>
          <QuickAddButton kind="activity" />
          <QuickAddButton kind="expense" />
        </div>
        <TripSearchBar />
      </header>

      {dashboard.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-soft-fg"
        >
          <p className="flex items-center gap-2">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            We couldn't load your dashboard figures.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => dashboard.refetch()}
            loading={dashboard.isFetching}
            icon={<RefreshCw className="size-4" aria-hidden />}
          >
            Retry
          </Button>
        </div>
      )}

      <section aria-labelledby="trips-heading" className="animate-rise">
        <SectionTitle title="Your trips" to="/" cta="See all" />
        <h2 id="trips-heading" className="sr-only">
          Your trips
        </h2>
        {tripsQuery.isPending ? (
          <div className="grid gap-4 @lg:grid-cols-2 @2xl:grid-cols-3" role="status" aria-label="Loading trips">
            {Array.from({ length: 3 }, (_, i) => (
              <DestinationCardSkeleton key={i} />
            ))}
          </div>
        ) : tripsQuery.isError ? (
          <Card className="flex items-center justify-between gap-3 text-sm text-fg-muted">
            We couldn't load your trips.
            <Button size="sm" variant="secondary" onClick={() => tripsQuery.refetch()}>
              Retry
            </Button>
          </Card>
        ) : featured.length === 0 ? (
          <Card className="flex flex-col items-center gap-4 border-dashed py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink">
              <Luggage className="size-7" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-fg">Your first adventure starts here</p>
              <p className="mt-1 max-w-sm text-sm text-fg-muted">
                Add a trip with its dates and budget, then fill it with activities and expenses.
              </p>
            </div>
            <ButtonLink to="/trips/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
              Plan your first trip
            </ButtonLink>
          </Card>
        ) : (
          <ul className="grid gap-4 @lg:grid-cols-2 @2xl:grid-cols-3">
            {featured.map((trip) => (
              <li key={trip.id}>
                <DestinationCard trip={trip} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Quick actions" className="animate-rise [animation-delay:80ms]">
        <QuickTiles overview={data?.overview} />
      </section>

      <section aria-label="Activities and budget" className="grid gap-4 @2xl:grid-cols-2 animate-rise [animation-delay:140ms]">
        <div>
          <WeekAgenda
            activities={activitiesQuery.data?.items ?? []}
            loading={activitiesQuery.isPending}
            error={activitiesQuery.isError}
          />
        </div>
        <div>
          {data ? <BudgetWatch trips={data.upcoming_trips} /> : <Skeleton className="h-72 rounded-3xl" />}
        </div>
      </section>

      <section aria-label="Spending insights" className="space-y-4 animate-rise [animation-delay:200ms]">
        <SectionTitle title="Spending insights" to="/expenses" cta="All expenses" />
        {data ? (
          <>
            <div className="grid gap-4 @2xl:grid-cols-5">
              <div className="@2xl:col-span-3">
                <SpendingTrendCard trends={data.spending_trends} />
              </div>
              <div className="@2xl:col-span-2">
                <CategoryCard categories={data.category_expenses} />
              </div>
            </div>
            <div className="grid gap-4 @2xl:grid-cols-2">
              <BudgetSummaryCard overview={data.overview} />
              <TripStatusCard distribution={data.trip_status_distribution} />
            </div>
          </>
        ) : dashboard.isPending ? (
          <div className="grid gap-4 @2xl:grid-cols-5" role="status" aria-label="Loading insights">
            <Skeleton className="h-72 rounded-3xl @2xl:col-span-3" />
            <Skeleton className="h-72 rounded-3xl @2xl:col-span-2" />
          </div>
        ) : null}
      </section>

      {data && (
        <section aria-label="Recent changes" className="animate-rise [animation-delay:260ms]">
          <RecentTabs
            activities={data.recent_activities}
            expenses={data.recent_expenses}
            reports={data.reports_history}
          />
        </section>
      )}
    </div>
  )
}
