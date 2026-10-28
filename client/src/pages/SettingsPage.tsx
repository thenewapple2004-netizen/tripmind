import { Link, useNavigate } from 'react-router'
import { CircleAlert, LogOut, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { PasswordForm } from '@/components/settings/PasswordForm'
import { RegionalForm } from '@/components/settings/RegionalForm'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { Avatar } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useIdentity, useProfile } from '@/hooks/useProfile'

const SECTIONS = [
  ['regional', 'Currency & timezone'],
  ['appearance', 'Appearance'],
  ['security', 'Password'],
  ['session', 'Session'],
] as const

export function SettingsPage() {
  useDocumentTitle('Settings')
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { data: profile, isPending, isError, refetch, isFetching } = useProfile()
  const identity = useIdentity()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Preferences, appearance and security for your account."
        actions={
          <ButtonLink to="/profile" variant="secondary" icon={<UserRound className="size-4" aria-hidden />}>
            Edit profile
          </ButtonLink>
        }
      />

      {isPending ? (
        <div role="status" aria-label="Loading settings" className="space-y-4">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      ) : isError || !profile ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your settings" description="Something went wrong while contacting the account service.">
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            Try again
          </Button>
        </StateCard>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap text-fg-muted transition hover:bg-surface-2 hover:text-fg"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="min-w-0 space-y-6">
            <RegionalForm profile={profile} />
            <AppearanceCard />
            <PasswordForm />

            <SettingsCard id="session" icon={<LogOut className="size-4" aria-hidden />} title="Session" description="You’re signed in on this device">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={identity.initials} src={identity.avatarUrl} className="size-11" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{identity.name}</p>
                    <p className="truncate text-xs text-fg-subtle">{profile.email}</p>
                  </div>
                </div>
                <Button
                  variant="danger-outline"
                  icon={<LogOut className="size-4" aria-hidden />}
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                >
                  Log out
                </Button>
              </div>
              <p className="mt-4 text-xs text-fg-subtle">
                Your travel style and display name live on your{' '}
                <Link to="/profile" className="font-medium text-primary-ink hover:underline">
                  profile
                </Link>
                .
              </p>
            </SettingsCard>
          </div>
        </div>
      )}
    </div>
  )
}
