import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expensesApi } from '@/api/expenses'
import type { Expense, ExpenseInput, ExpensePatch, Trip } from '@/api/types'
import { tripKeys } from './useTrips'

export const expenseKeys = {
  all: (tripId: string) => ['trips', tripId, 'expenses'] as const,
  list: (tripId: string, category?: string) =>
    [...expenseKeys.all(tripId), 'list', category ?? 'all'] as const,
  summary: (tripId: string) => [...expenseKeys.all(tripId), 'summary'] as const,
  detail: (tripId: string, expenseId: string) =>
    [...expenseKeys.all(tripId), 'detail', expenseId] as const,
}

export function useExpenses(tripId: string, category?: string) {
  return useQuery({
    queryKey: expenseKeys.list(tripId, category),
    queryFn: ({ signal }) => expensesApi.list(tripId, category, signal),
    placeholderData: keepPreviousData,
    enabled: Boolean(tripId),
  })
}

export function useBudgetSummary(tripId: string) {
  return useQuery({
    queryKey: expenseKeys.summary(tripId),
    queryFn: ({ signal }) => expensesApi.summary(tripId, signal),
    placeholderData: keepPreviousData,
    enabled: Boolean(tripId),
  })
}

export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ExpenseInput) => expensesApi.create(tripId, input),
    onSuccess: (expense) => {
      queryClient.setQueryData<Expense[]>(expenseKeys.list(tripId), (list) =>
        list ? [expense, ...list] : [expense],
      )
      queryClient.setQueryData<Trip>(tripKeys.detail(tripId), (trip) => {
        if (!trip) return trip
        const current = trip.expenses ?? []
        return {
          ...trip,
          expenses: [expense, ...current],
        }
      })
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
    },
  })
}

export function useUpdateExpense(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ expenseId, patch }: { expenseId: string; patch: ExpensePatch }) =>
      expensesApi.update(tripId, expenseId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<Expense[]>(expenseKeys.list(tripId), (list) =>
        list ? list.map((item) => (item.id === updated.id ? updated : item)) : [updated],
      )
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
    },
  })
}

export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (expenseId: string) => expensesApi.remove(tripId, expenseId),
    onSuccess: (_data, expenseId) => {
      queryClient.setQueryData<Expense[]>(expenseKeys.list(tripId), (list) =>
        list ? list.filter((item) => item.id !== expenseId) : [],
      )
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
    },
  })
}
