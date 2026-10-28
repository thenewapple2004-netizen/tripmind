import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingsApi, type BookingQuery } from '@/api/bookings'
import type { BookingInput } from '@/api/types'
import { itineraryKey } from './useItinerary'

export const bookingKeys = {
  all: ['bookings'] as const,
  owner: (params: BookingQuery) => ['bookings', 'owner', params] as const,
  summary: (today: string) => ['bookings', 'summary', today] as const,
  trip: (tripId: string) => ['trips', tripId, 'bookings'] as const,
}

/** The Bookings page list. The previous page stays on screen while the next one loads. */
export function useOwnerBookings(params: BookingQuery) {
  return useQuery({
    queryKey: bookingKeys.owner(params),
    queryFn: ({ signal }) => bookingsApi.listAll(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useBookingSummary(today: string) {
  return useQuery({
    queryKey: bookingKeys.summary(today),
    queryFn: ({ signal }) => bookingsApi.summary(today, signal),
  })
}

export function useTripBookings(tripId: string) {
  return useQuery({
    queryKey: bookingKeys.trip(tripId),
    queryFn: ({ signal }) => bookingsApi.listForTrip(tripId, signal),
    enabled: Boolean(tripId),
  })
}

/** A booking changes the lists, the counts, and (when confirmed) the trip's itinerary. */
function useRefreshBookings() {
  const queryClient = useQueryClient()
  return (tripId: string) => {
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all })
    void queryClient.invalidateQueries({ queryKey: bookingKeys.trip(tripId) })
    void queryClient.invalidateQueries({ queryKey: itineraryKey(tripId) })
  }
}

export function useCreateBooking() {
  const refresh = useRefreshBookings()
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: BookingInput }) => bookingsApi.create(tripId, input),
    onSuccess: (booking) => refresh(booking.trip_id),
  })
}

export function useUpdateBooking() {
  const refresh = useRefreshBookings()
  return useMutation({
    mutationFn: ({ tripId, id, patch }: { tripId: string; id: string; patch: Partial<BookingInput> }) =>
      bookingsApi.update(tripId, id, patch),
    onSuccess: (booking) => refresh(booking.trip_id),
  })
}

export function useDeleteBooking() {
  const refresh = useRefreshBookings()
  return useMutation({
    mutationFn: ({ tripId, id }: { tripId: string; id: string }) => bookingsApi.remove(tripId, id),
    onSuccess: (_data, { tripId }) => refresh(tripId),
  })
}
