/**
 * owner.ts
 * ========
 * API client functions for the Owner Dashboard endpoints.
 *
 * The backend serialises Decimal money fields as JSON strings, so every response is
 * normalised here and the rest of the app can rely on plain numbers.
 */

import { request } from './http'
import { toNumber } from '@/lib/owner'
import type {
  OwnerDashboardResponse,
  OwnerRecentActivity,
  OwnerRecentExpense,
  OwnerReportHistoryItem,
  OwnerUpcomingTrip,
  PaginatedOwnerActivities,
  PaginatedOwnerExpenses,
} from './ownerTypes'

const activity = (a: OwnerRecentActivity): OwnerRecentActivity => ({ ...a, cost: toNumber(a.cost) })
const expense = (e: OwnerRecentExpense): OwnerRecentExpense => ({ ...e, amount: toNumber(e.amount) })
const upcoming = (t: OwnerUpcomingTrip): OwnerUpcomingTrip => ({
  ...t,
  budget: toNumber(t.budget),
  total_spent: toNumber(t.total_spent),
  remaining_budget: toNumber(t.remaining_budget),
  percent_spent: toNumber(t.percent_spent),
})

export async function getOwnerDashboard(): Promise<OwnerDashboardResponse> {
  const d = await request<OwnerDashboardResponse>('/owner/dashboard')
  return {
    ...d,
    overview: {
      ...d.overview,
      total_budget: toNumber(d.overview.total_budget),
      total_spent: toNumber(d.overview.total_spent),
      remaining_budget: toNumber(d.overview.remaining_budget),
      budget_utilization_pct: toNumber(d.overview.budget_utilization_pct),
    },
    category_expenses: d.category_expenses.map((c) => ({
      ...c,
      total_amount: toNumber(c.total_amount),
      percentage: toNumber(c.percentage),
    })),
    spending_trends: d.spending_trends.map((t) => ({ ...t, total_spent: toNumber(t.total_spent) })),
    trip_status_distribution: d.trip_status_distribution.map((s) => ({
      ...s,
      percentage: toNumber(s.percentage),
    })),
    upcoming_trips: d.upcoming_trips.map(upcoming),
    recent_activities: d.recent_activities.map(activity),
    recent_expenses: d.recent_expenses.map(expense),
  }
}

export async function getOwnerActivities(
  page = 1,
  pageSize = 10,
): Promise<PaginatedOwnerActivities> {
  const d = await request<PaginatedOwnerActivities>(
    `/owner/activities?page=${page}&page_size=${pageSize}`,
  )
  return { ...d, items: d.items.map(activity) }
}

export async function getOwnerExpenses(
  page = 1,
  pageSize = 10,
  category?: string,
): Promise<PaginatedOwnerExpenses> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (category) params.set('category', category)
  const d = await request<PaginatedOwnerExpenses>(`/owner/expenses?${params}`)
  return { ...d, items: d.items.map(expense) }
}

export async function getOwnerReports(): Promise<OwnerReportHistoryItem[]> {
  return request<OwnerReportHistoryItem[]>('/owner/reports')
}
