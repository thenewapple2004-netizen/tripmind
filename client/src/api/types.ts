export interface Activity {
  id: string
  trip_id: string
  title: string
  description?: string | null
  location?: string | null
  activity_date: string
  cost: number
}

export type ActivityInput = Omit<Activity, 'id' | 'trip_id'>
export type ActivityPatch = Partial<ActivityInput>

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
}

export type TripInput = Omit<Trip, 'id' | 'user_id' | 'activities'>
export type TripPatch = Partial<TripInput>
