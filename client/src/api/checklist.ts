import { request } from './http'
import type { ChecklistCategory, ChecklistItem } from './types'

const base = (tripId: string) => `/trips/${encodeURIComponent(tripId)}/checklist`

export const checklistApi = {
  list: (tripId: string, signal?: AbortSignal) => request<ChecklistItem[]>(base(tripId), { signal }),

  create: (tripId: string, input: { text: string; category: ChecklistCategory }) =>
    request<ChecklistItem>(base(tripId), { method: 'POST', body: input }),

  update: (
    tripId: string,
    itemId: string,
    patch: Partial<{ text: string; category: ChecklistCategory; is_done: boolean }>,
  ) => request<ChecklistItem>(`${base(tripId)}/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: patch }),

  remove: (tripId: string, itemId: string) =>
    request<void>(`${base(tripId)}/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
}
