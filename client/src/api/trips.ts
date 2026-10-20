import { request } from './http'
import type { Trip, TripInput, TripPatch } from './types'

export const tripsApi = {
  list: (signal?: AbortSignal) => request<Trip[]>('/trips', { signal }),

  get: (id: string, signal?: AbortSignal) =>
    request<Trip>(`/trips/${encodeURIComponent(id)}`, { signal }),

  create: (input: TripInput) => request<Trip>('/trips', { method: 'POST', body: input }),

  update: (id: string, patch: TripPatch) =>
    request<Trip>(`/trips/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),

  remove: (id: string) =>
    request<void>(`/trips/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
