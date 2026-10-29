import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'
import type { DocumentKind, DocumentPatch } from '@/api/types'

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

/** After any change: the trip's list, the owner-wide list, and bookings (which show their documents' names). */
function useRefreshDocuments() {
  const queryClient = useQueryClient()
  return (tripId: string) => {
    void queryClient.invalidateQueries({ queryKey: documentsKey(tripId) })
    void queryClient.invalidateQueries({ queryKey: OWNER_DOCUMENTS })
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }
}

export function useUploadDocument() {
  const refresh = useRefreshDocuments()
  return useMutation({
    mutationFn: ({ tripId, file, kind }: { tripId: string; file: File; kind: DocumentKind }) => documentsApi.upload(tripId, file, kind),
    onSuccess: (_doc, vars) => refresh(vars.tripId),
  })
}

export function useUpdateDocument() {
  const refresh = useRefreshDocuments()
  return useMutation({
    mutationFn: ({ tripId, id, patch }: { tripId: string; id: string; patch: DocumentPatch }) => documentsApi.update(tripId, id, patch),
    onSuccess: (_doc, vars) => refresh(vars.tripId),
  })
}

export function useDeleteDocument() {
  const refresh = useRefreshDocuments()
  return useMutation({
    mutationFn: ({ tripId, id }: { tripId: string; id: string }) => documentsApi.remove(tripId, id),
    onSuccess: (_void, vars) => refresh(vars.tripId),
  })
}
