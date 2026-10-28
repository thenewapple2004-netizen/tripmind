/**
 * ownerTypes.ts
 * =============
 * TypeScript types mirroring the backend Owner Dashboard schemas (Task 17).
 * Keep in sync with services/trip-service/app/models/schemas.py
 */

export interface OwnerDashboardOverview {
  total_trips: number
  upcoming_trips_count: number
  ongoing_trips_count: number
  completed_trips_count: number
  total_budget: number
  total_spent: number
  remaining_budget: number
  budget_utilization_pct: number
  is_over_budget: boolean
  total_activities: number
  total_expenses_count: number
  total_reports_count: number
}

export interface OwnerCategoryExpense {
  category: string
  total_amount: number  // ← backend uses total_amount
  count: number
  percentage: number
}

export interface OwnerSpendingTrend {
  period: string  // e.g. "2026-07"  ← backend uses period, not month
  total_spent: number
  count: number   // ← backend uses count, not expense_count
}

export interface OwnerTripStatusDistribution {
  status: 'upcoming' | 'ongoing' | 'completed'
  count: number
  percentage: number
}

export interface OwnerUpcomingTrip {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  budget: number
  total_spent: number
  remaining_budget: number
  percent_spent: number    // ← backend field name
  activity_count: number
  days_until_start: number
  status: string
}

export interface OwnerRecentActivity {
  id: string
  trip_id: string
  trip_title: string
  title: string
  location?: string | null
  activity_date: string
  cost: number
  description?: string | null
  start_time?: string | null
  duration_minutes?: number | null
}

export interface OwnerRecentExpense {
  id: string
  trip_id: string
  trip_title: string
  title: string
  amount: number
  category: string
  expense_date: string
  description?: string | null
}

export interface OwnerReportHistoryItem {
  task_id: string
  trip_id: string
  trip_title: string
  filename: string
  file_size: number
  generated_at: string
  download_url: string
}

export interface OwnerDashboardResponse {
  overview: OwnerDashboardOverview
  category_expenses: OwnerCategoryExpense[]
  spending_trends: OwnerSpendingTrend[]
  trip_status_distribution: OwnerTripStatusDistribution[]
  upcoming_trips: OwnerUpcomingTrip[]
  recent_activities: OwnerRecentActivity[]
  recent_expenses: OwnerRecentExpense[]
  reports_history: OwnerReportHistoryItem[]
}

export interface PaginatedOwnerActivities {
  items: OwnerRecentActivity[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PaginatedOwnerExpenses {
  items: OwnerRecentExpense[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
