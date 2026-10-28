import { Link } from 'react-router'
import { CalendarDays, CircleAlert, MapPin, Settings } from 'lucide-react'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { TravelPreferencesForm } from '@/components/profile/TravelPreferencesForm'
import { PageHeader } from '@/components/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard'
import { useIdentity, useProfile } from '@/hooks/useProfile'
import { BUDGET_STYLES, TRAVEL_INTERESTS, TRAVEL_PACES } from '@/lib/profile'
import { formatDate } from '@/lib/trips'

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading your profile" className="space-y-6">
      <Skeleton className="h-52 rounded-3xl" />
      <div className="grid gap-6 @3xl:grid-cols-2">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  )
}

export function ProfilePage() {
  useDocumentTitle('Profile')
  const { data: profile, isPending, isError, refetch, isFetching } = useProfile()
  const identity = useIdentity()
  const dashboard = useOwnerDashboard()
  const overview = dashboard.data?.overview

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your details and travel style."
        actions={
          <ButtonLink to="/settings" variant="secondary" icon={<Settings className="size-4" aria-hidden />}>
            Settings
          </ButtonLink>
        }
      />

      {isPending ? (
        <ProfileSkeleton />
      ) : isError || !profile ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your profile" description="Something went wrong while contacting the account service.">
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            Try again
          </Button>
        </StateCard>
      ) : (
        <>
          <Card className="relative isolate overflow-hidden p-0">
            <div aria-hidden className="h-24 bg-[radial-gradient(40rem_14rem_at_20%_0%,var(--glow),transparent),linear-gradient(135deg,var(--surface-3),var(--surface-2))]" />
            <div className="flex flex-col gap-6 px-5 pb-6 sm:flex-row sm:px-8">
              <div className="-mt-14 sm:-mt-16">
                <AvatarUploader profile={profile} initials={identity.initials} />
              </div>
              <div className="min-w-0 flex-1 sm:pt-4">
                <h2 className="truncate font-display text-2xl font-extrabold tracking-tight text-fg">{identity.name}</h2>
                <p className="truncate text-sm text-fg-muted">{profile.email}</p>
                {profile.bio && <p className="mt-3 max-w-xl text-sm whitespace-pre-line text-fg-muted">{profile.bio}</p>}
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-subtle">
                  {profile.location && (
                    <li className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary-ink" aria-hidden />
                      {profile.location}
                    </li>
                  )}
                  <li className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-primary-ink" aria-hidden />
                    Exploring since {formatDate(profile.created_at.slice(0, 10))}
                  </li>
                </ul>

                {(
                  <ul aria-label="Travel style" className="mt-4 flex flex-wrap gap-2">
                    {profile.travel_interests.map((value) => (
                      <li key={value} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-fg">
                        {TRAVEL_INTERESTS.find((i) => i.value === value)?.label ?? value}
                      </li>
                    ))}
                    <li className="rounded-full border border-line px-3 py-1 text-xs text-fg-muted">
                      {TRAVEL_PACES.find((p) => p.value === profile.travel_pace)?.label} pace
                    </li>
                    <li className="rounded-full border border-line px-3 py-1 text-xs text-fg-muted">
                      {BUDGET_STYLES.find((b) => b.value === profile.budget_style)?.label} budget
                    </li>
                  </ul>
                )}
              </div>

              {overview && (
                <dl className="grid shrink-0 grid-cols-3 gap-2 sm:w-64 sm:self-end">
                  {(
                    [
                      ['Trips', overview.total_trips],
                      ['Activities', overview.total_activities],
                      ['Expenses', overview.total_expenses_count],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-surface-2 p-3 text-center">
                      <dd className="font-display text-xl font-extrabold tabular-nums text-fg">{value}</dd>
                      <dt className="text-[11px] text-fg-subtle">{label}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Card>

          <div className="grid items-start gap-6 @3xl:grid-cols-2">
            <ProfileForm profile={profile} />
            <TravelPreferencesForm profile={profile} />
          </div>

          <p className="text-center text-xs text-fg-subtle">
            Looking for currency, timezone, theme or password?{' '}
            <Link to="/settings" className="font-medium text-primary-ink hover:underline">
              Open settings
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
