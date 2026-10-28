import { request } from './http'
import type { ActivityMove, Itinerary } from './types'

export const itineraryApi = {
  get: (tripId: string, signal?: AbortSignal) =>
    request<Itinerary>(`/trips/${encodeURIComponent(tripId)}/itinerary`, { signal }),

  /** Applies a drag-and-drop result atomically and returns the fresh itinerary. */
  arrange: (tripId: string, moves: ActivityMove[]) =>
    request<Itinerary>(`/trips/${encodeURIComponent(tripId)}/activities/arrange`, {
      method: 'PUT',
      body: { moves },
    }),
}
