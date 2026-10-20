import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { activitiesApi } from '@/api/activities'
import type { Activity, ActivityInput, ActivityPatch, Trip } from '@/api/types'
import { tripKeys } from './useTrips'

export const activityKeys = {
  all: (tripId: string) => ['trips', tripId, 'activities'] as const,
  list: (tripId: string) => [...activityKeys.all(tripId), 'list'] as const,
  detail: (tripId: string, activityId: string) =>
    [...activityKeys.all(tripId), 'detail', activityId] as const,
}

export function useActivities(tripId: string) {
  return useQuery({
    queryKey: activityKeys.list(tripId),
    queryFn: ({ signal }) => activitiesApi.list(tripId, signal),
    placeholderData: keepPreviousData,
    enabled: Boolean(tripId),
  })
}

export function useCreateActivity(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ActivityInput) => activitiesApi.create(tripId, input),
    onSuccess: (activity) => {
      queryClient.setQueryData<Activity[]>(activityKeys.list(tripId), (list) =>
        list ? [...list, activity].sort((a, b) => a.activity_date.localeCompare(b.activity_date)) : [activity],
      )
      // Also update the cached trip if activities are embedded
      queryClient.setQueryData<Trip>(tripKeys.detail(tripId), (trip) => {
        if (!trip) return trip
        const current = trip.activities ?? []
        return {
          ...trip,
          activities: [...current, activity].sort((a, b) => a.activity_date.localeCompare(b.activity_date)),
        }
      })
      void queryClient.invalidateQueries({ queryKey: activityKeys.list(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}

export function useUpdateActivity(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, patch }: { activityId: string; patch: ActivityPatch }) =>
      activitiesApi.update(tripId, activityId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<Activity[]>(activityKeys.list(tripId), (list) =>
        list
          ? list
              .map((item) => (item.id === updated.id ? updated : item))
              .sort((a, b) => a.activity_date.localeCompare(b.activity_date))
          : [updated],
      )
      queryClient.setQueryData<Trip>(tripKeys.detail(tripId), (trip) => {
        if (!trip) return trip
        const current = trip.activities ?? []
        return {
          ...trip,
          activities: current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.activity_date.localeCompare(b.activity_date)),
        }
      })
      void queryClient.invalidateQueries({ queryKey: activityKeys.list(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}

export function useDeleteActivity(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (activityId: string) => activitiesApi.remove(tripId, activityId),
    onSuccess: (_data, activityId) => {
      queryClient.setQueryData<Activity[]>(activityKeys.list(tripId), (list) =>
        list ? list.filter((item) => item.id !== activityId) : [],
      )
      queryClient.setQueryData<Trip>(tripKeys.detail(tripId), (trip) => {
        if (!trip) return trip
        const current = trip.activities ?? []
        return {
          ...trip,
          activities: current.filter((item) => item.id !== activityId),
        }
      })
      void queryClient.invalidateQueries({ queryKey: activityKeys.list(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}
