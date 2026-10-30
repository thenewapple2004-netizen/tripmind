import type { Trip } from './types'

// These mirror services/trip-service/app/models/crm_schemas.py. Dates are ISO `YYYY-MM-DD` strings.

export type InquiryStage = 'new' | 'contacted' | 'planning' | 'quoted' | 'confirmed' | 'closed_lost'
export type InquirySource = 'referral' | 'website' | 'phone' | 'walk_in' | 'social' | 'repeat' | 'other'
export type ContactMethod = 'any' | 'email' | 'phone' | 'whatsapp'
export type AccommodationType = 'hotel' | 'guesthouse' | 'resort' | 'lodge' | 'apartment' | 'hostel' | 'camping' | 'homestay'
export type ComfortLevel = 'budget' | 'midrange' | 'upscale' | 'luxury'
export type TravelStyle =
  | 'adventure' | 'relaxation' | 'culture' | 'nature' | 'family' | 'romantic' | 'luxury' | 'budget' | 'photography' | 'food'
export type Pace = 'relaxed' | 'balanced' | 'fast'
export type FollowUpView = 'today' | 'upcoming' | 'overdue' | 'open' | 'completed' | 'all'
export type FollowUpStatus = 'overdue' | 'today' | 'upcoming' | 'completed'

export interface CustomerRef {
  id: string
  name: string
}

export interface CustomerSummary {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  preferred_contact: ContactMethod
  is_archived: boolean
  created_at: string
  last_activity_at: string
  open_inquiries: number
  total_inquiries: number
  trip_count: number
  next_follow_up_on: string | null
}

export interface CustomerTripItem {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  budget: number
  booking_count: number
  inquiry_id: string | null
}

export interface CustomerBookingItem {
  id: string
  trip_id: string
  trip_title: string
  type: string
  title: string
  status: string
  start_date: string
  total_cost: number
  currency: string
}

export interface CustomerDetail extends Omit<CustomerSummary, 'open_inquiries' | 'total_inquiries' | 'trip_count' | 'next_follow_up_on'> {
  preferences: string | null
  notes: string | null
  updated_at: string
  inquiries: Inquiry[]
  trips: CustomerTripItem[]
  bookings: CustomerBookingItem[]
  follow_ups: FollowUp[]
}

export interface CustomerInput {
  name: string
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  preferred_contact: ContactMethod
  preferences: string | null
  notes: string | null
}

export type CustomerPatch = Partial<CustomerInput> & { is_archived?: boolean }

export interface TravelBrief {
  flexible_dates: boolean
  flexibility_days: number | null
  trip_length_nights: number | null
  children: number
  accommodation_types: AccommodationType[]
  comfort_level: ComfortLevel | null
  room_preferences: string | null
  travel_styles: TravelStyle[]
  pace: Pace | null
  transport_preferences: string | null
  special_requests: string | null
  additional_notes: string | null
}

export interface Inquiry {
  id: string
  customer: CustomerRef
  destination: string
  date_from: string | null
  date_to: string | null
  travelers: number
  budget_min: number | null
  budget_max: number | null
  currency: string
  source: InquirySource
  notes: string | null
  stage: InquiryStage
  stage_changed_at: string
  closed_reason: string | null
  brief: TravelBrief
  next_follow_up_on: string | null
  open_follow_ups: number
  allowed_stages: InquiryStage[]
  converted_trip_id: string | null
  converted_at: string | null
  created_at: string
  updated_at: string
}

export interface CrmEvent {
  id: string
  kind: string
  summary: string
  from_stage: InquiryStage | null
  to_stage: InquiryStage | null
  inquiry_id: string | null
  created_at: string
}

export interface InquiryDetail extends Inquiry {
  customer_email: string | null
  customer_phone: string | null
  follow_ups: FollowUp[]
  events: CrmEvent[]
}

export interface InquiryInput {
  destination: string
  date_from: string | null
  date_to: string | null
  travelers: number
  budget_min: number | null
  budget_max: number | null
  currency: string
  source: InquirySource
  notes: string | null
}

export interface InquiryCreateInput extends InquiryInput {
  customer_id: string
  brief?: TravelBrief
  follow_up_on?: string | null
}

export type InquiryPatch = Partial<InquiryInput> & { brief?: TravelBrief }

export interface TripConversionInput {
  title: string
  destination: string
  start_date: string
  end_date: string
  budget: number
  confirm: true
}

export interface ConversionResult {
  inquiry: InquiryDetail
  trip: Trip
}

export interface FollowUp {
  id: string
  customer: CustomerRef
  inquiry_id: string | null
  inquiry_destination: string | null
  title: string
  notes: string | null
  due_date: string
  completed_at: string | null
  is_completed: boolean
  status: FollowUpStatus
  created_at: string
}

export interface FollowUpInput {
  title: string
  notes: string | null
  due_date: string
  customer_id?: string
  inquiry_id?: string
}

export type FollowUpPatch = Partial<Pick<FollowUpInput, 'title' | 'notes' | 'due_date'>> & { completed?: boolean }

export interface FollowUpSummary {
  overdue: number
  today: number
  upcoming: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
