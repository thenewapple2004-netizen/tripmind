import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingsApi, type BookingQuery } from '@/api/bookings'
import type { BookingInput, OwnerBooking } from '@/api/types'
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

const ALL_PAGE_SIZE = 50 // the API's maximum
const ALL_MAX_PAGES = 20 // a safety stop at 1,000 bookings

/**
 * Every booking that matches the filters. The Booking Hub groups bookings under their trips, and a group
 * built from half a page would be wrong, so this reads the existing paginated endpoint to the end.
 */
export function useAllOwnerBookings(params: Omit<BookingQuery, 'page' | 'page_size'>) {
  return useQuery({
    queryKey: ['bookings', 'all', params] as const,
    queryFn: async ({ signal }) => {
      const items: OwnerBooking[] = []
      let page = 1
      let totalPages = 1
      do {
        const result = await bookingsApi.listAll({ ...params, page, page_size: ALL_PAGE_SIZE }, signal)
        items.push(...result.items)
        totalPages = result.total_pages
        page += 1
      } while (page <= totalPages && page <= ALL_MAX_PAGES)
      return { items, truncated: page - 1 < totalPages }
    },
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
