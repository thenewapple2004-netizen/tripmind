/**
 * useOwnerDashboard.ts
 * ====================
 * React Query hooks for the Owner Dashboard (Task 17).
 */

import { useQuery } from '@tanstack/react-query'
import { getOwnerDashboard, getOwnerActivities, getOwnerExpenses, getOwnerReports } from '@/api/owner'

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ['owner', 'dashboard'],
    queryFn: getOwnerDashboard,
    staleTime: 60_000,
  })
}

export function useOwnerActivities(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: ['owner', 'activities', page, pageSize],
    queryFn: () => getOwnerActivities(page, pageSize),
    staleTime: 30_000,
  })
}

export function useOwnerExpenses(page = 1, pageSize = 10, category?: string) {
  return useQuery({
    queryKey: ['owner', 'expenses', page, pageSize, category],
    queryFn: () => getOwnerExpenses(page, pageSize, category),
    staleTime: 30_000,
  })
}

export function useOwnerReports() {
  return useQuery({
    queryKey: ['owner', 'reports'],
    queryFn: getOwnerReports,
    staleTime: 60_000,
  })
}
