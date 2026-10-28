import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CircleAlert, FolderLock, Luggage, ShieldCheck } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { OwnerDocument, TripDocument } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { DocumentItem } from '@/components/planner/DocumentsPanel'
import { DocumentUploader } from '@/components/planner/DocumentUploader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { inputStyles } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useDeleteDocument, useOwnerDocuments } from '@/hooks/useDocuments'
import { useTrips } from '@/hooks/useTrips'
import { formatDateRange, sortTrips } from '@/lib/trips'

function TripGroup({ tripId, title, documents }: { tripId: string; title: string; documents: OwnerDocument[] }) {
  const toast = useToast()
  const remove = useDeleteDocument(tripId)
  const [deleting, setDeleting] = useState<TripDocument | null>(null)

  const confirm = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`“${deleting.filename}” was deleted.`)
      setDeleting(null)
    } catch {
      // Shown inside the dialog.
    }
  }

  return (
    <Card className="p-3">
      <h3 className="flex items-center justify-between gap-3 px-2.5 pt-1.5 pb-1 font-display text-sm font-bold text-fg">
        <Link to={`/trips/${tripId}?tab=documents`} className="truncate hover:text-primary-ink">
          {title}
        </Link>
        <span className="text-xs font-medium text-fg-subtle tabular-nums">{documents.length}</span>
      </h3>
      <ul>
        {documents.map((doc) => (
          <DocumentItem key={doc.id} doc={doc} onDelete={setDeleting} />
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this document?"
        description={deleting ? `“${deleting.filename}” will be permanently removed. This can't be undone.` : ''}
        confirmLabel="Delete document"
        pending={remove.isPending}
        error={remove.error instanceof ApiError ? remove.error.message : remove.error ? 'Failed to delete the document. Please try again.' : null}
        onConfirm={confirm}
        onCancel={() => {
          setDeleting(null)
          remove.reset()
        }}
      />
    </Card>
  )
}

/** Every travel document across all trips, with upload to any trip. */
export function DocumentsPage() {
  useDocumentTitle('Documents')
  const trips = useTrips()
  const docs = useOwnerDocuments()
  const [tripId, setTripId] = useState('')

  const list = useMemo(() => sortTrips(trips.data ?? [], 'upcoming'), [trips.data])
  const selected = list.find((t) => t.id === tripId) ?? list[0]

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; documents: OwnerDocument[] }>()
    for (const d of docs.data ?? []) {
      const group = map.get(d.trip_id) ?? { title: d.trip_title, documents: [] }
      group.documents.push(d)
      map.set(d.trip_id, group)
    }
    return [...map.entries()]
  }, [docs.data])

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Passports, tickets and bookings for all your trips, in one private place." />

      {trips.isPending ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : trips.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your trips" description="We need your trips to attach documents to.">
          <Button variant="secondary" onClick={() => trips.refetch()} loading={trips.isFetching}>
            Try again
          </Button>
        </StateCard>
      ) : !selected ? (
        <StateCard icon={Luggage} title="No trips yet" description="Documents belong to a trip. Create one first.">
          <ButtonLink to="/trips/new" variant="primary">
            Plan a trip
          </ButtonLink>
        </StateCard>
      ) : (
        <Card>
          <CardHeader title="Add a document" description="Choose the trip it belongs to" icon={<FolderLock className="size-4" aria-hidden />} />
          <p className="-mt-2 mb-4 flex items-start gap-2 text-sm text-fg-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
            Only you can open these files, and only while you’re signed in.
          </p>
          <label className="mb-3 block max-w-md">
            <span className="mb-1.5 block text-sm font-medium text-fg">Trip</span>
            <select value={selected.id} onChange={(e) => setTripId(e.target.value)} className={inputStyles}>
              {list.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {formatDateRange(t.start_date, t.end_date)}
                </option>
              ))}
            </select>
          </label>
          <DocumentUploader key={selected.id} tripId={selected.id} />
        </Card>
      )}

      {docs.isPending ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : docs.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your documents" description="Something went wrong while fetching them.">
          <Button variant="secondary" onClick={() => docs.refetch()} loading={docs.isFetching}>
            Try again
          </Button>
        </StateCard>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-fg-muted">
          No documents yet. Upload a passport scan, ticket or booking above.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([id, group]) => (
            <TripGroup key={id} tripId={id} title={group.title} documents={group.documents} />
          ))}
        </div>
      )}
    </div>
  )
}
