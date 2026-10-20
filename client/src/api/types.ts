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


