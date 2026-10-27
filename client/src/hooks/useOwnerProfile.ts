import { useQuery } from '@tanstack/react-query'
import { tripsApi } from '@/api/trips'
import type { OwnerProfile } from '@/api/types'

/**
 * Fetches the trip owner's profile from the Auth Service via the Trip Service.
 *
 * The query:
 * - Fires only when `tripId` is non-empty.
 * - Caches for 5 minutes (stale time = 300 s) — profiles rarely change.
 * - Returns the profile, loading state, and any error.
 * - On 401 / 503, the `error` field is populated but the app continues to work.
 */
export function useOwnerProfile(tripId: string) {
  const query = useQuery<OwnerProfile, Error>({
    queryKey: ['trip', tripId, 'owner-profile'],
    queryFn: ({ signal }) => tripsApi.getOwnerProfile(tripId, signal),
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,                  // one retry on transient errors
  })

  return {
    profile: query.data ?? null,
    isLoading: query.isPending,
    error: query.error,
    isUnavailable: query.isError,
  }
}
