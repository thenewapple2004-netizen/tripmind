/** A trip as returned by the Trip Service. Dates are ISO `YYYY-MM-DD` strings. */
export interface Trip {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  budget: number
}

export type TripInput = Omit<Trip, 'id'>
export type TripPatch = Partial<TripInput>
