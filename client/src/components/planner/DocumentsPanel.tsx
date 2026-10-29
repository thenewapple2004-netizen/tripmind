import { useMemo, useState } from 'react'
import { CircleAlert, FolderOpen, Upload } from 'lucide-react'
import type { Trip } from '@/api/types'
import { DocumentRow } from '@/components/documents/DocumentRow'
import { UploadDialog } from '@/components/documents/UploadDialog'
import { useDocumentDialogs } from '@/components/documents/useDocumentDialogs'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { useOwnerDocuments } from '@/hooks/useDocuments'
import { sortDocuments } from '@/lib/documents'

/** A trip's own documents, with the same rows, preview and dialogs as the Documents page. */
export function DocumentsPanel({ trip }: { trip: Trip }) {
  const { data, isPending, isError, refetch, isFetching } = useOwnerDocuments()
  const actions = useDocumentDialogs()
  const [uploading, setUploading] = useState(false)
  const documents = useMemo(() => sortDocuments((data ?? []).filter((d) => d.trip_id === trip.id), 'newest'), [data, trip.id])

  return (
    <section aria-label="Travel documents" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-fg">Travel documents</h2>
          <p className="mt-1 text-sm text-fg-muted">Only you can open these files, and only while you’re signed in.</p>
        </div>
        <Button variant="primary" icon={<Upload className="size-4" aria-hidden />} onClick={() => setUploading(true)}>
          Upload document
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your documents" description="Something went wrong while fetching this trip’s documents.">
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>Try again</Button>
        </StateCard>
      ) : documents.length === 0 ? (
        <StateCard icon={FolderOpen} title="No documents for this trip" description="Add your passport scan, tickets or booking confirmations so they’re ready when you need them.">
          <Button variant="primary" icon={<Upload className="size-4" aria-hidden />} onClick={() => setUploading(true)}>Upload a document</Button>
        </StateCard>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} actions={actions} />
          ))}
        </ul>
      )}

      <UploadDialog open={uploading} trips={[trip]} defaultTripId={trip.id} lockTrip onClose={() => setUploading(false)} />
      {actions.element}
    </section>
  )
}
