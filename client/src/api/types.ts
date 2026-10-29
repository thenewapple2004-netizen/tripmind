export interface Activity {
  id: string
  trip_id: string
  title: string
  description?: string | null
  location?: string | null
  activity_date: string
  cost: number
  /** Local start time, "HH:MM:SS" from the API (null when the activity has no set time). */
  start_time?: string | null
  duration_minutes?: number | null
  /** Manual order within the day, for activities without a start time. */
  position?: number
}

export type ActivityInput = Omit<Activity, 'id' | 'trip_id' | 'position'>
export type ActivityPatch = Partial<ActivityInput>

export type ExpenseCategory =
  | 'Food'
  | 'Transportation'
  | 'Accommodation'
  | 'Activities'
  | 'Shopping'
  | 'Other'

export interface Expense {
  id: string
  trip_id: string
  title: string
  amount: number
  category: ExpenseCategory
  expense_date: string
  description?: string | null
}

export type ExpenseInput = Omit<Expense, 'id' | 'trip_id'>
export type ExpensePatch = Partial<ExpenseInput>

export interface CategorySummary {
  category: string
  total: number
  count: number
  percentage: number
}

export interface BudgetSummary {
  budget: number
  total_spent: number
  remaining_budget: number
  percent_spent: number
  is_over_budget: boolean
  expense_count: number
  by_category: CategorySummary[]
}

/** A trip as returned by the Trip Service. Dates are ISO `YYYY-MM-DD` strings. */
export interface Trip {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  budget: number
  user_id?: string | null
  activities?: Activity[]
  expenses?: Expense[]
}

export type TripInput = Omit<Trip, 'id' | 'user_id' | 'activities' | 'expenses'>
export type TripPatch = Partial<TripInput>

export interface PaginatedTrips {
  items: Trip[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface TripFilterParams {
  search?: string
  status?: string
  sort_by?: string
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
  min_budget?: number
  max_budget?: number
}

/** Owner profile returned by the Trip Service owner-profile endpoint (sourced from Auth Service). */
export interface OwnerProfile {
  id: string
  email: string
  created_at: string
  source: string
}

// ─── Itinerary planner ──────────────────────────────────────────────────────

/** A confirmed booking's moment on a day (departure, check-in...). Shown read-only beside activities. */
export interface ItineraryReservation {
  booking_id: string
  type: BookingType
  status: BookingStatus
  title: string
  provider?: string | null
  confirmation_number?: string | null
  location?: string | null
  label: string
  date: string
  time?: string | null
}

export interface ItineraryDay {
  date: string
  day_number: number
  activities: Activity[]
  total_cost: number
  scheduled_minutes: number
  reservations: ItineraryReservation[]
}

export interface ItineraryConflict {
  activity_date: string
  activity_ids: string[]
  overlap_minutes: number
}

export interface Itinerary {
  trip_id: string
  start_date: string
  end_date: string
  total_activities: number
  unscheduled_count: number
  days: ItineraryDay[]
  conflicts: ItineraryConflict[]
  /** Confirmed reservations that fall on a date outside the trip's days (e.g. a flight the night before). */
  off_calendar_reservations: ItineraryReservation[]
}

/** Where an activity should end up after a drag and drop. */
export interface ActivityMove {
  id: string
  activity_date: string
  position: number
}

// ─── Checklist & documents ──────────────────────────────────────────────────

export type ChecklistCategory = 'documents' | 'packing' | 'bookings' | 'health' | 'other'

export interface ChecklistItem {
  id: string
  trip_id: string
  text: string
  category: ChecklistCategory
  is_done: boolean
  position: number
}

export type DocumentKind = 'passport' | 'visa' | 'ticket' | 'booking' | 'insurance' | 'other'

export interface TripDocument {
  id: string
  trip_id: string
  filename: string
  content_type: string
  size_bytes: number
  kind: DocumentKind
  uploaded_at: string
}

export interface OwnerDocument extends TripDocument {
  trip_title: string
}

// ─── Bookings ───────────────────────────────────────────────────────────────

export type BookingType = 'flight' | 'hotel' | 'transportation' | 'activity'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

/** Type-specific fields (flight number, pickup location...). Which keys exist depends on the type. */
export type BookingDetails = Record<string, string | number>

export interface Booking {
  id: string
  trip_id: string
  type: BookingType
  status: BookingStatus
  title: string
  provider: string | null
  confirmation_number: string | null
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  location: string | null
  total_cost: number
  currency: string
  notes: string | null
  cancellation_policy: string | null
  free_cancellation_until: string | null
  details: BookingDetails
  /** Existing documents linked to this booking (metadata only; files are stored once, on the trip). */
  documents: TripDocument[]
  created_at: string
  updated_at: string
  outside_trip_dates: boolean
}

export interface OwnerBooking extends Booking {
  trip_title: string
  trip_destination: string
}

export interface PaginatedBookings {
  items: OwnerBooking[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface BookingSummary {
  total: number
  /** Trips that have at least one booking. */
  trip_count: number
  upcoming_count: number
  by_status: Record<BookingStatus, number>
  by_type: Record<BookingType, number>
  upcoming_cost: Array<{ currency: string; total: number }>
}

/** What the booking form sends. Optional fields use null to mean "none". */
export interface BookingInput {
  type: BookingType
  status: BookingStatus
  title: string
  provider: string | null
  confirmation_number: string | null
  start_date: string
  start_time: string | null
  end_date: string | null
  end_time: string | null
  location: string | null
  total_cost: number
  currency: string
  notes: string | null
  cancellation_policy: string | null
  free_cancellation_until: string | null
  details: BookingDetails
  document_ids: string[]
}
