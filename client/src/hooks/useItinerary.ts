import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { itineraryApi } from '@/api/itinerary'
import type { ActivityMove, Itinerary } from '@/api/types'
import { applyMovesLocally } from '@/lib/itinerary'
import { activityKeys } from './useActivities'

/** Lives under the activities key, so every activity create/update/delete refreshes it too. */
export const itineraryKey = (tripId: string) => [...activityKeys.all(tripId), 'itinerary'] as const

export function useItinerary(tripId: string) {
  return useQuery({
    queryKey: itineraryKey(tripId),
    queryFn: ({ signal }) => itineraryApi.get(tripId, signal),
    enabled: Boolean(tripId),
  })
}

/**
 * Drag and drop. The cache is updated first so the card lands where it was dropped immediately,
 * the server answers with the authoritative itinerary (including conflicts), and a failure rolls
 * the board back.
 */
export function useArrangeActivities(tripId: string) {
  const queryClient = useQueryClient()
  const key = itineraryKey(tripId)
  return useMutation({
    mutationFn: (moves: ActivityMove[]) => itineraryApi.arrange(tripId, moves),
    onMutate: async (moves) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Itinerary>(key)
      if (previous) queryClient.setQueryData(key, applyMovesLocally(previous, moves))
      return { previous }
    },
    onError: (_error, _moves, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (itinerary) => queryClient.setQueryData(key, itinerary),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
      void queryClient.invalidateQueries({ queryKey: activityKeys.list(tripId) })
    },
  })
}
