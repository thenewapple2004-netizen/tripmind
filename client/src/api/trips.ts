import { request } from './http'
import type { PaginatedTrips, Trip, TripFilterParams, TripInput, TripPatch } from './types'

export const tripsApi = {
  list: (params?: TripFilterParams, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status && params.status !== 'all') searchParams.set('status', params.status)
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by)
    if (params?.order) searchParams.set('order', params.order)
    if (params?.page !== undefined) searchParams.set('page', String(params.page))
    if (params?.page_size !== undefined) searchParams.set('page_size', String(params.page_size))
    if (params?.min_budget !== undefined) searchParams.set('min_budget', String(params.min_budget))
    if (params?.max_budget !== undefined) searchParams.set('max_budget', String(params.max_budget))

    const query = searchParams.toString()
    const path = `/trips${query ? `?${query}` : ''}`
    if (params?.page !== undefined || params?.page_size !== undefined) {
      return request<PaginatedTrips>(path, { signal })
    }
    return request<Trip[]>(path, { signal })
  },

  get: (id: string, signal?: AbortSignal) =>
    request<Trip>(`/trips/${encodeURIComponent(id)}`, { signal }),

  create: (input: TripInput) => request<Trip>('/trips', { method: 'POST', body: input }),

  update: (id: string, patch: TripPatch) =>
    request<Trip>(`/trips/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),

  remove: (id: string) =>
    request<void>(`/trips/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
