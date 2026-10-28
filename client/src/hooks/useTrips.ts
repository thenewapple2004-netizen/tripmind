import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'
import { tripsApi } from '@/api/trips'
import type { PaginatedTrips, Trip, TripFilterParams, TripInput, TripPatch } from '@/api/types'

export const tripKeys = {
  all: ['trips'] as const,
  list: (params?: TripFilterParams) => [...tripKeys.all, 'list', params ?? {}] as const,
  detail: (id: string) => [...tripKeys.all, 'detail', id] as const,
}

/** Retry outages and 5xx a couple of times; never retry 4xx (they won't change). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return error instanceof ApiError && error.isTransient && failureCount < 2
}

export function useTrips(params?: TripFilterParams) {
  return useQuery({
    queryKey: tripKeys.list(params),
    queryFn: ({ signal }) => tripsApi.list(params, signal) as Promise<Trip[]>,
    placeholderData: keepPreviousData,
  })
}

export function usePaginatedTrips(params: TripFilterParams) {
  return useQuery({
    queryKey: tripKeys.list(params),
    queryFn: ({ signal }) => tripsApi.list(params, signal) as Promise<PaginatedTrips>,
    placeholderData: keepPreviousData,
  })
}

export function useTrip(id: string, { usePlaceholder = true } = {}) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: ({ signal }) => tripsApi.get(id, signal),
    placeholderData: usePlaceholder
      ? () => queryClient.getQueryData<Trip[]>(tripKeys.list())?.find((trip) => trip.id === id)
      : undefined,
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TripInput) => tripsApi.create(input),
    onSuccess: (trip) => {
      queryClient.setQueryData(tripKeys.detail(trip.id), trip)
      void queryClient.invalidateQueries({ queryKey: tripKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
    },
  })
}

export function useUpdateTrip(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: TripPatch) => tripsApi.update(id, patch),
    onSuccess: (trip) => {
      queryClient.setQueryData(tripKeys.detail(id), trip)
      void queryClient.invalidateQueries({ queryKey: tripKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tripsApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: tripKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
    },
  })
}
