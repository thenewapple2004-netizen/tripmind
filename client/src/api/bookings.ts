import { request } from './http'
import type { Booking, BookingInput, BookingStatus, BookingSummary, BookingType, PaginatedBookings } from './types'

const base = (tripId: string) => `/trips/${encodeURIComponent(tripId)}/bookings`

export type BookingScope = 'upcoming' | 'past' | 'all'
export type BookingSort = 'start_asc' | 'start_desc' | 'cost_desc' | 'cost_asc' | 'created_desc' | 'title_asc'

export interface BookingQuery {
  q?: string
  type?: BookingType
  status?: BookingStatus
  trip_id?: string
  scope?: BookingScope
  sort?: BookingSort
  /** The caller's local date, so "upcoming" matches their calendar rather than the server's. */
  today?: string
  page?: number
  page_size?: number
}

function toQuery(params: BookingQuery): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const bookingsApi = {
  /** Bookings across all of the owner's trips: search, filters, sorting and paging happen on the server. */
  listAll: (params: BookingQuery, signal?: AbortSignal) =>
    request<PaginatedBookings>(`/owner/bookings${toQuery(params)}`, { signal }),

  summary: (today: string, signal?: AbortSignal) =>
    request<BookingSummary>(`/owner/bookings/summary${toQuery({ today })}`, { signal }),

  listForTrip: (tripId: string, signal?: AbortSignal) => request<Booking[]>(base(tripId), { signal }),

  create: (tripId: string, input: BookingInput) => request<Booking>(base(tripId), { method: 'POST', body: input }),

  update: (tripId: string, bookingId: string, patch: Partial<BookingInput>) =>
    request<Booking>(`${base(tripId)}/${encodeURIComponent(bookingId)}`, { method: 'PATCH', body: patch }),

  remove: (tripId: string, bookingId: string) =>
    request<void>(`${base(tripId)}/${encodeURIComponent(bookingId)}`, { method: 'DELETE' }),
}
