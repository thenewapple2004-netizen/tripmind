/**
 * owner.ts
 * ========
 * API client functions for the Owner Dashboard endpoints.
 */

import { request } from './http'
import type {
  OwnerDashboardResponse,
  PaginatedOwnerActivities,
  PaginatedOwnerExpenses,
  OwnerReportHistoryItem,
} from './ownerTypes'

export async function getOwnerDashboard(): Promise<OwnerDashboardResponse> {
  return request<OwnerDashboardResponse>('/owner/dashboard')
}

export async function getOwnerActivities(
  page = 1,
  pageSize = 10,
): Promise<PaginatedOwnerActivities> {
  return request<PaginatedOwnerActivities>(
    `/owner/activities?page=${page}&page_size=${pageSize}`,
  )
}

export async function getOwnerExpenses(
  page = 1,
  pageSize = 10,
  category?: string,
): Promise<PaginatedOwnerExpenses> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (category) params.set('category', category)
  return request<PaginatedOwnerExpenses>(`/owner/expenses?${params}`)
}

export async function getOwnerReports(): Promise<OwnerReportHistoryItem[]> {
  return request<OwnerReportHistoryItem[]>('/owner/reports')
}
