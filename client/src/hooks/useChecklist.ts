import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checklistApi } from '@/api/checklist'
import type { ChecklistCategory, ChecklistItem } from '@/api/types'

export const checklistKey = (tripId: string) => ['trips', tripId, 'checklist'] as const

export function useChecklist(tripId: string) {
  return useQuery({
    queryKey: checklistKey(tripId),
    queryFn: ({ signal }) => checklistApi.list(tripId, signal),
    enabled: Boolean(tripId),
  })
}

export function useAddChecklistItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { text: string; category: ChecklistCategory }) => checklistApi.create(tripId, input),
    onSuccess: (item) =>
      queryClient.setQueryData<ChecklistItem[]>(checklistKey(tripId), (list) => (list ? [...list, item] : [item])),
  })
}

/** Ticking a box is instant: the cache changes first and is rolled back if the server says no. */
export function useUpdateChecklistItem(tripId: string) {
  const queryClient = useQueryClient()
  const key = checklistKey(tripId)
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<ChecklistItem, 'text' | 'category' | 'is_done'>> }) =>
      checklistApi.update(tripId, id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ChecklistItem[]>(key)
      queryClient.setQueryData<ChecklistItem[]>(key, (list) => list?.map((i) => (i.id === id ? { ...i, ...patch } : i)))
      return { previous }
    },
    onError: (_e, _v, context) => context?.previous && queryClient.setQueryData(key, context.previous),
    onSuccess: (item) =>
      queryClient.setQueryData<ChecklistItem[]>(key, (list) => list?.map((i) => (i.id === item.id ? item : i))),
  })
}

export function useDeleteChecklistItem(tripId: string) {
  const queryClient = useQueryClient()
  const key = checklistKey(tripId)
  return useMutation({
    mutationFn: (id: string) => checklistApi.remove(tripId, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ChecklistItem[]>(key)
      queryClient.setQueryData<ChecklistItem[]>(key, (list) => list?.filter((i) => i.id !== id))
      return { previous }
    },
    onError: (_e, _v, context) => context?.previous && queryClient.setQueryData(key, context.previous),
  })
}
