import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'
import { tripsApi } from '@/api/trips'
import type { Trip, TripInput, TripPatch } from '@/api/types'

export const tripKeys = {
  all: ['trips'] as const,
  list: () => [...tripKeys.all, 'list'] as const,
  detail: (id: string) => [...tripKeys.all, 'detail', id] as const,
}

/** Retry outages and 5xx a couple of times; never retry 4xx (they won't change). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return error instanceof ApiError && error.isTransient && failureCount < 2
}

export function useTrips() {
  return useQuery({
    queryKey: tripKeys.list(),
    queryFn: ({ signal }) => tripsApi.list(signal),
    placeholderData: keepPreviousData,
  })
}

export function useTrip(id: string, { usePlaceholder = true } = {}) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: ({ signal }) => tripsApi.get(id, signal),
    // Show what the dashboard already knows while the fresh copy loads.
    placeholderData: usePlaceholder
      ? () => queryClient.getQueryData<Trip[]>(tripKeys.list())?.find((trip) => trip.id === id)
      : undefined,
  })
}

// Each mutation writes its result straight into the cached list, then refetches to
// reconcile with the server. Without the direct write, the dashboard would briefly
// show the old list (a trip that was just deleted, or missing one just created).

export function useCreateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TripInput) => tripsApi.create(input),
    onSuccess: (trip) => {
      queryClient.setQueryData(tripKeys.detail(trip.id), trip)
      queryClient.setQueryData<Trip[]>(tripKeys.list(), (list) => list && [...list, trip])
      return queryClient.invalidateQueries({ queryKey: tripKeys.list() })
    },
  })
}

export function useUpdateTrip(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: TripPatch) => tripsApi.update(id, patch),
    onSuccess: (trip) => {
      queryClient.setQueryData(tripKeys.detail(id), trip)
      queryClient.setQueryData<Trip[]>(tripKeys.list(), (list) =>
        list?.map((existing) => (existing.id === id ? trip : existing)),
      )
      return queryClient.invalidateQueries({ queryKey: tripKeys.list() })
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tripsApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: tripKeys.detail(id) })
      queryClient.setQueryData<Trip[]>(tripKeys.list(), (list) =>
        list?.filter((existing) => existing.id !== id),
      )
      return queryClient.invalidateQueries({ queryKey: tripKeys.list() })
    },
  })
}
