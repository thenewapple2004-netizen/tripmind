import { request } from './http'
import type { DocumentKind, DocumentPatch, OwnerDocument, TripDocument } from './types'

const base = (tripId: string) => `/trips/${encodeURIComponent(tripId)}/documents`

export const documentsApi = {
  list: (tripId: string, signal?: AbortSignal) => request<TripDocument[]>(base(tripId), { signal }),

  /** The file is the raw request body; the name and kind travel in the query string. */
  upload: (tripId: string, file: File, kind: DocumentKind) =>
    request<TripDocument>(`${base(tripId)}?${new URLSearchParams({ filename: file.name, kind })}`, {
      method: 'POST',
      body: file,
    }),

  /** Needs the owner's token, so it goes through `request` rather than a plain link. */
  download: (tripId: string, documentId: string) =>
    request<Blob>(`${base(tripId)}/${encodeURIComponent(documentId)}/download`, { parseAs: 'blob' }),

  /** Rename and/or recategorise. Only metadata changes; the stored file is untouched. */
  update: (tripId: string, documentId: string, patch: DocumentPatch) =>
    request<TripDocument>(`${base(tripId)}/${encodeURIComponent(documentId)}`, { method: 'PATCH', body: patch }),

  remove: (tripId: string, documentId: string) =>
    request<void>(`${base(tripId)}/${encodeURIComponent(documentId)}`, { method: 'DELETE' }),

  listAll: (signal?: AbortSignal) => request<OwnerDocument[]>('/owner/documents', { signal }),
}
