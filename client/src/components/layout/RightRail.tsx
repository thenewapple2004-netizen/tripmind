import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  AlarmClock,
  CalendarCheck2,
  CalendarX2,
  Clock,
  Compass,
  Luggage,
  MapPin,
  PartyPopper,
  Plane,
  Receipt,
  FileText,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Trip } from '@/api/types'
import type { OwnerRecentActivity, OwnerUpcomingTrip } from '@/api/ownerTypes'
import { MiniCalendar } from '@/components/portal/MiniCalendar'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader, EmptyNote } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { TripCover } from '@/components/TripCover'
import { useAuth } from '@/hooks/useAuth'
import { useOwnerActivities, useOwnerDashboard } from '@/hooks/useOwnerDashboard'
import { useTrips } from '@/hooks/useTrips'
import { useIdentity } from '@/hooks/useProfile'
import {
  formatDate,
  formatDateRange,
  formatLongDate,
  getTimingLabel,
  getTripDays,
  getTripStatus,
  parseISODate,
  pluralize,
  toISODate,
} from '@/lib/trips'
import { cn } from '@/components/ui/cn'

const isoDay = (value: string) => value.slice(0, 10)

interface Reminder {
  key: string
  icon: LucideIcon
  tone: 'info' | 'warn' | 'good'
  text: string
  to: string
}

const TONE: Record<Reminder['tone'], string> = {
  info: 'bg-info-soft text-info-soft-fg',
  warn: 'bg-warn-soft text-warn-soft-fg',
  good: 'bg-primary-soft text-primary-soft-fg',
}

/** Reminders are derived from the owner's real trips and budgets. Nothing is invented. */
function buildReminders(trips: Trip[], upcoming: OwnerUpcomingTrip[]): Reminder[] {
  const items: Reminder[] = []
  const today = new Date()

  for (const trip of trips) {
    if (getTripStatus(trip, today) === 'ongoing') {
      items.push({
        key: `now-${trip.id}`,
        icon: Plane,
        tone: 'good',
        text: `${trip.title} is happening now · ${getTimingLabel(trip, today)}`,
        to: `/trips/${trip.id}`,
      })
    }
  }
  for (const trip of upcoming) {
    if (trip.days_until_start >= 0 && trip.days_until_start <= 7) {
      items.push({
        key: `soon-${trip.id}`,
        icon: AlarmClock,
        tone: 'info',
        text:
          trip.days_until_start === 0
            ? `${trip.title} starts today`
            : `${trip.title} starts in ${pluralize(trip.days_until_start, 'day')}`,
        to: `/trips/${trip.id}`,
      })
    }
    if (trip.activity_count === 0) {
      items.push({
        key: `plan-${trip.id}`,
        icon: CalendarX2,
        tone: 'warn',
        text: `No activities planned for ${trip.title} yet`,
        to: `/trips/${trip.id}`,
      })
    }
    if (trip.percent_spent >= 80) {
      items.push({
        key: `budget-${trip.id}`,
        icon: Wallet,
        tone: 'warn',
        text: `${trip.title} has used ${Math.round(trip.percent_spent)}% of its budget`,
        to: `/trips/${trip.id}`,
      })
    }
  }
  return items.slice(0, 4)
}

/** "start" or "end" when the day is the trip's first or last day (a one-day trip counts as a start). */
function edgeOf(trip: Trip, day: string): 'start' | 'end' | null {
  if (trip.start_date === day) return 'start'
  if (trip.end_date === day) return 'end'
  return null
}

/** What this trip is doing on the given day: "Starts", "Ends", or "Day 3 of 7". */
function tripDayLabel(trip: Trip, day: string): string {
  const edge = edgeOf(trip, day)
  if (edge === 'start') return 'Starts'
  if (edge === 'end') return 'Ends'
  const dayNumber = Math.round((parseISODate(day).getTime() - parseISODate(trip.start_date).getTime()) / 86_400_000) + 1
  return `Day ${dayNumber} of ${getTripDays(trip)}`
}

function RailSkeleton() {
  return (
    <div role="status" aria-label="Loading your travel summary" className="space-y-4">
      <Skeleton className="h-20 rounded-3xl" />
      <Skeleton className="h-72 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  )
}

function ProfileCard() {
  const { user } = useAuth()
  const { name, email, initials, avatarUrl, profile } = useIdentity()
  const created = profile?.created_at ?? user?.created_at
  const since = created ? formatDate(isoDay(created)) : null
  return (
    <Card className="p-0 transition hover:border-primary/40">
      <Link to="/profile" aria-label={`${name} — view your profile`} className="flex items-center gap-3 rounded-3xl p-4">
        <Avatar initials={initials} src={avatarUrl} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-fg">{name}</p>
          <p className="truncate text-xs text-fg-subtle">{email}</p>
          {since && <p className="mt-0.5 text-[11px] text-fg-subtle">Exploring since {since}</p>}
        </div>
      </Link>
    </Card>
  )
}

function ActivityRow({ activity }: { activity: OwnerRecentActivity }) {
  return (
    <li>
      <Link
        to={`/trips/${activity.trip_id}?tab=itinerary`}
        className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface-2"
      >
        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
          <span className="text-[9px] leading-none font-semibold uppercase">
            {parseISODate(isoDay(activity.activity_date)).toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-sm leading-tight font-bold tabular-nums">
            {parseISODate(isoDay(activity.activity_date)).getDate()}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{activity.title}</span>
          <span className="flex items-center gap-1 truncate text-xs text-fg-subtle">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {activity.location || activity.trip_title}
          </span>
        </span>
      </Link>
    </li>
  )
}

export function RightRail({ className }: { className?: string }) {
  const dashboard = useOwnerDashboard()
  const tripsQuery = useTrips()
  const activitiesQuery = useOwnerActivities(1, 50)
  const [selected, setSelected] = useState(() => toISODate(new Date()))

  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data])
  const activities = useMemo(() => activitiesQuery.data?.items ?? [], [activitiesQuery.data])
  const upcoming = dashboard.data?.upcoming_trips

  const activityDates = useMemo(() => new Set(activities.map((a) => isoDay(a.activity_date))), [activities])
  const reminders = useMemo(() => buildReminders(trips, upcoming ?? []), [trips, upcoming])

  const todayIso = toISODate(new Date())
  const nextActivities = useMemo(
    () =>
      activities
        .filter((a) => isoDay(a.activity_date) >= todayIso)
        .sort((a, b) => a.activity_date.localeCompare(b.activity_date))
        .slice(0, 4),
    [activities, todayIso],
  )
  const selectedActivities = activities.filter((a) => isoDay(a.activity_date) === selected)
  // Trips starting or ending on the chosen day come first; the rest are "under way" and capped so a
  // busy calendar doesn't push everything else off the screen.
  const selectedTrips = trips
    .filter((t) => t.start_date <= selected && t.end_date >= selected)
    .sort((a, b) => Number(edgeOf(b, selected) !== null) - Number(edgeOf(a, selected) !== null))
  const MAX_TRIPS_SHOWN = 3
  const shownTrips = selectedTrips.slice(0, MAX_TRIPS_SHOWN)
  const hiddenTrips = selectedTrips.length - shownTrips.length

  const loading = dashboard.isPending && tripsQuery.isPending

  return (
    <aside aria-label="Calendar and trip summary" className={cn('flex flex-col gap-4', className)}>
      <ProfileCard />

      {loading ? (
        <RailSkeleton />
      ) : (
        <>
          <Card>
            <CardHeader title="Calendar" description="Trips and activities by day" icon={<CalendarCheck2 className="size-4" aria-hidden />} />
            <MiniCalendar trips={trips} activityDates={activityDates} selected={selected} onSelect={setSelected} />

            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-xs font-semibold text-fg-muted">
                {formatLongDate(selected)}
                {selected === todayIso && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] text-primary-soft-fg">Today</span>}
              </p>
              {selectedTrips.length === 0 && selectedActivities.length === 0 ? (
                <p className="text-xs text-fg-subtle">Nothing planned for this day.</p>
              ) : (
                <ul className="space-y-1">
                  {shownTrips.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/trips/${t.id}`}
                        className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs transition hover:bg-surface-3"
                      >
                        <Luggage className="size-3.5 shrink-0 text-primary-ink" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-medium text-fg">{t.title}</span>
                        <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-soft-fg">
                          {tripDayLabel(t, selected)}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {hiddenTrips > 0 && (
                    <li className="px-3 pb-1 text-[11px] text-fg-subtle">
                      +{hiddenTrips} more {hiddenTrips === 1 ? 'trip' : 'trips'} under way.{' '}
                      <Link to="/" className="font-medium text-primary-ink hover:underline">
                        See all
                      </Link>
                    </li>
                  )}
                  {selectedActivities.map((a) => (
                    <ActivityRow key={a.id} activity={a} />
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Upcoming trips"
              icon={<Compass className="size-4" aria-hidden />}
              action={
                <Link to="/" className="text-xs font-medium text-primary-ink hover:underline">
                  All trips
                </Link>
              }
            />
            {dashboard.isError ? (
              <EmptyNote icon={<Compass className="size-6" aria-hidden />}>We couldn't load your upcoming trips.</EmptyNote>
            ) : !upcoming || upcoming.length === 0 ? (
              <EmptyNote icon={<Luggage className="size-6" aria-hidden />}>
                No upcoming trips.{' '}
                <Link to="/trips/new" className="font-medium text-primary-ink hover:underline">
                  Plan one
                </Link>
              </EmptyNote>
            ) : (
              <ul className="space-y-1">
                {upcoming.slice(0, 4).map((trip) => (
                  <li key={trip.id}>
                    <Link
                      to={`/trips/${trip.id}`}
                      className="group flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface-2"
                    >
                      <TripCover destination={trip.destination} className="size-12 shrink-0 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg group-hover:text-primary-ink">
                          {trip.title}
                        </span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {formatDateRange(trip.start_date, trip.end_date)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-primary-soft px-2 py-1 text-[11px] font-semibold text-primary-soft-fg tabular-nums">
                        {trip.days_until_start <= 0 ? 'Now' : `${trip.days_until_start}d`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Scheduled activities"
              icon={<Clock className="size-4" aria-hidden />}
              action={
                <Link to="/itinerary" className="text-xs font-medium text-primary-ink hover:underline">
                  Itinerary
                </Link>
              }
            />
            {nextActivities.length === 0 ? (
              <EmptyNote icon={<CalendarX2 className="size-6" aria-hidden />}>
                No upcoming activities. Add some from a trip's page.
              </EmptyNote>
            ) : (
              <ul className="space-y-1">
                {nextActivities.map((a) => (
                  <ActivityRow key={a.id} activity={a} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Reminders" icon={<AlarmClock className="size-4" aria-hidden />} />
            {reminders.length === 0 ? (
              <EmptyNote icon={<PartyPopper className="size-6" aria-hidden />}>You're all caught up.</EmptyNote>
            ) : (
              <ul className="space-y-2">
                {reminders.map((r) => (
                  <li key={r.key}>
                    <Link
                      to={r.to}
                      className="flex items-start gap-3 rounded-2xl p-2 text-xs text-fg-muted transition hover:bg-surface-2 hover:text-fg"
                    >
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', TONE[r.tone])}>
                        <r.icon className="size-4" aria-hidden />
                      </span>
                      <span className="pt-1.5 leading-snug">{r.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {dashboard.data && (
            <Card>
              <CardHeader title="Travel overview" icon={<Sparkles className="size-4" aria-hidden />} />
              <dl className="grid grid-cols-2 gap-2">
                {(
                  [
                    [Luggage, 'Trips', dashboard.data.overview.total_trips],
                    [CalendarCheck2, 'Activities', dashboard.data.overview.total_activities],
                    [Receipt, 'Expenses', dashboard.data.overview.total_expenses_count],
                    [FileText, 'Reports', dashboard.data.overview.total_reports_count],
                  ] as const
                ).map(([Icon, label, value]) => (
                  <div key={label} className="rounded-2xl bg-surface-2 p-3">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-fg-subtle">
                      <Icon className="size-3.5 text-primary-ink" aria-hidden />
                      {label}
                    </dt>
                    <dd className="mt-1 font-display text-xl font-bold tabular-nums text-fg">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </>
      )}
    </aside>
  )
}
