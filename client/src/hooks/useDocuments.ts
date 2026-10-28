import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'
import type { DocumentKind } from '@/api/types'

export const documentsKey = (tripId: string) => ['trips', tripId, 'documents'] as const
const OWNER_DOCUMENTS = ['owner', 'documents'] as const

export function useDocuments(tripId: string) {
  return useQuery({
    queryKey: documentsKey(tripId),
    queryFn: ({ signal }) => documentsApi.list(tripId, signal),
    enabled: Boolean(tripId),
  })
}

export function useOwnerDocuments() {
  return useQuery({
    queryKey: OWNER_DOCUMENTS,
    queryFn: ({ signal }) => documentsApi.listAll(signal),
  })
}

function useRefreshDocuments(tripId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: documentsKey(tripId) })
    void queryClient.invalidateQueries({ queryKey: OWNER_DOCUMENTS })
  }
}

export function useUploadDocument(tripId: string) {
  const refresh = useRefreshDocuments(tripId)
  return useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: DocumentKind }) => documentsApi.upload(tripId, file, kind),
    onSuccess: refresh,
  })
}

export function useDeleteDocument(tripId: string) {
  const refresh = useRefreshDocuments(tripId)
  return useMutation({ mutationFn: (id: string) => documentsApi.remove(tripId, id), onSuccess: refresh })
}
