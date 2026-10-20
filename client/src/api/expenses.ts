import { request } from './http'
import type { BudgetSummary, Expense, ExpenseInput, ExpensePatch } from './types'

export const expensesApi = {
  list: (tripId: string, category?: string, signal?: AbortSignal) => {
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    return request<Expense[]>(`/trips/${encodeURIComponent(tripId)}/expenses${query}`, { signal })
  },

  get: (tripId: string, expenseId: string, signal?: AbortSignal) =>
    request<Expense>(
      `/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,
      { signal },
    ),

  summary: (tripId: string, signal?: AbortSignal) =>
    request<BudgetSummary>(`/trips/${encodeURIComponent(tripId)}/expenses/summary`, { signal }),

  create: (tripId: string, input: ExpenseInput) =>
    request<Expense>(`/trips/${encodeURIComponent(tripId)}/expenses`, {
      method: 'POST',
      body: input,
    }),

  update: (tripId: string, expenseId: string, patch: ExpensePatch) =>
    request<Expense>(
      `/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,
      {
        method: 'PATCH',
        body: patch,
      },
    ),

  remove: (tripId: string, expenseId: string) =>
    request<void>(
      `/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,
      { method: 'DELETE' },
    ),
}
