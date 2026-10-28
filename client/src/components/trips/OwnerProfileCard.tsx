import { ExternalLink, RefreshCw, ShieldCheck, User2, Wifi } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOwnerProfile } from '@/hooks/useOwnerProfile'

interface OwnerProfileCardProps {
  tripId: string
}

/**
 * Displays the trip owner's profile, fetched live from the Auth Service
 * via the Trip Service's inter-service HTTP call.
 *
 * States:
 *   - Loading skeleton while the request is in-flight.
 *   - Rich profile card on success, annotated with the data source.
 *   - Graceful degraded state when Auth Service is unavailable.
 */
export function OwnerProfileCard({ tripId }: OwnerProfileCardProps) {
  const { profile, isLoading, error, isUnavailable } = useOwnerProfile(tripId)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section
        aria-label="Loading owner profile"
        className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="mt-2 h-3 w-3/4 rounded-md" />
      </section>
    )
  }

  // ── Unavailable / Error ────────────────────────────────────────────────────
  if (isUnavailable || error) {
    const isAuthError = error?.message?.includes('401') || error?.message?.includes('403')
    return (
      <section
        aria-label="Owner profile unavailable"
        className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
            <User2 className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-fg">Trip Owner</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              {isAuthError
                ? 'Session expired — please log in again to view profile.'
                : 'Auth Service is temporarily unavailable. Profile will load when the service recovers.'}
            </p>
          </div>
        </div>

        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/50 bg-amber-50/60 px-4 py-3 text-xs text-amber-800 dark:border-amber-700/30 dark:bg-amber-900/20 dark:text-amber-400"
        >
          <Wifi className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {isAuthError
              ? 'Authentication error — the token forwarded to the Auth Service was rejected.'
              : 'The Trip Service could not reach the Auth Service after retries with exponential back-off.'}
          </span>
        </div>
      </section>
    )
  }

  if (!profile) return null

  // ── Success ────────────────────────────────────────────────────────────────
  const joinedDate = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Derive avatar initials from email
  const initials = profile.email
    .split('@')[0]
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 2)
    .toUpperCase() || '?'

  return (
    <section
      aria-labelledby="owner-profile-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        {/* Avatar + identity */}
        <div className="flex items-center gap-4">
          {/* Gradient avatar */}
          <div
            aria-hidden
            className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/80 to-primary text-white text-sm font-bold shadow-sm select-none"
          >
            {initials}
            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-emerald-500" />
          </div>

          <div>
            <h2
              id="owner-profile-heading"
              className="text-sm font-semibold text-fg leading-tight"
            >
              {profile.email}
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Member since <span className="font-medium text-fg">{joinedDate}</span>
            </p>
            <p className="mt-1 font-mono text-[10px] text-fg-subtle tracking-tight">
              ID: {profile.id.slice(0, 8)}…
            </p>
          </div>
        </div>

        {/* Source badge */}
        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:flex-col sm:items-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/60 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-700/30 dark:bg-emerald-900/20 dark:text-emerald-400">
            <ShieldCheck className="size-3" aria-hidden />
            Verified
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-muted">
            <ExternalLink className="size-3" aria-hidden />
            {profile.source}
          </span>
        </div>
      </div>

      {/* Microservice annotation */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary-line/30 bg-primary-soft/30 px-3.5 py-2.5 text-xs text-fg-muted">
        <RefreshCw className="mt-0.5 size-3.5 shrink-0 text-primary-ink" aria-hidden />
        <p>
          Profile data retrieved live from the{' '}
          <strong className="font-semibold text-fg">Auth Service</strong> via HTTP
          using the Trip Service's inter-service HTTPX client with retries and
          exponential back-off — no database cross-access.
        </p>
      </div>
    </section>
  )
}
