import { useMemo, useState } from 'react'
import { CircleAlert, FileSearch, FolderOpen, Luggage, Upload } from 'lucide-react'
import type { DocumentKind } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { DocumentFilterBar } from '@/components/documents/DocumentFilterBar'
import { DocumentGroup } from '@/components/documents/DocumentGroup'
import { UploadDialog } from '@/components/documents/UploadDialog'
import { useDocumentDialogs } from '@/components/documents/useDocumentDialogs'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOwnerDocuments } from '@/hooks/useDocuments'
import { useTrips } from '@/hooks/useTrips'
import { filterDocuments, groupDocumentsByTrip, kindCounts, type DocumentSort } from '@/lib/documents'

/** The Travel Document Hub: every document across all trips, grouped by trip, with preview and management. */
export function DocumentsPage() {
  useDocumentTitle('Documents')
  const trips = useTrips()
  const docs = useOwnerDocuments()
  const actions = useDocumentDialogs()
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [tripId, setTripId] = useState<string>()
  const [kind, setKind] = useState<DocumentKind>()
  const [sort, setSort] = useState<DocumentSort>('newest')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const all = useMemo(() => docs.data ?? [], [docs.data])
  const filtered = useMemo(() => filterDocuments(all, { q: search, tripId, kind }), [all, search, tripId, kind])
  const groups = useMemo(() => groupDocumentsByTrip(filtered, sort), [filtered, sort])
  // Category counts follow the search and trip, so each chip says how many you would get by choosing it.
  const counts = useMemo(() => kindCounts(filterDocuments(all, { q: search, tripId })), [all, search, tripId])
  const narrowed = Boolean(search.trim() || tripId || kind)
  const hasTrips = (trips.data?.length ?? 0) > 0
  const clear = () => {
    setSearch('')
    setTripId(undefined)
    setKind(undefined)
  }
  const toggle = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const allOpen = groups.every((g) => !collapsed.has(g.tripId))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Passports, tickets and bookings for all your trips. Only you can open them, and only while you’re signed in."
        actions={
          <Button variant="primary" icon={<Upload className="size-4" aria-hidden />} onClick={() => setUploading(true)} disabled={!hasTrips}>
            Upload document
          </Button>
        }
      />

      {docs.isPending || trips.isPending ? (
        <div role="status" aria-label="Loading documents" className="space-y-3">
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-10" />
          {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : docs.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your documents" description="Something went wrong while fetching them. Your files are safe.">
          <Button variant="secondary" onClick={() => docs.refetch()} loading={docs.isFetching}>Try again</Button>
        </StateCard>
      ) : !hasTrips ? (
        <StateCard icon={Luggage} title="No trips yet" description="Documents belong to a trip. Create one first.">
          <ButtonLink to="/trips/new" variant="primary">Plan a trip</ButtonLink>
        </StateCard>
      ) : all.length === 0 ? (
        <StateCard icon={FolderOpen} title="No documents yet" description="Keep your passport scan, tickets and booking confirmations in one place, ready when you need them.">
          <Button variant="primary" icon={<Upload className="size-4" aria-hidden />} onClick={() => setUploading(true)}>Upload your first document</Button>
        </StateCard>
      ) : (
        <>
          <DocumentFilterBar
            counts={counts}
            total={filterDocuments(all, { q: search, tripId }).length}
            search={search}
            onSearch={setSearch}
            tripId={tripId}
            onTrip={setTripId}
            kind={kind}
            onKind={setKind}
            sort={sort}
            onSort={setSort}
            trips={trips.data ?? []}
          />

          <p aria-live="polite" className="text-sm text-fg-subtle">
            {narrowed ? `Showing ${filtered.length} of ${all.length}` : filtered.length} {filtered.length === 1 && !narrowed ? 'document' : 'documents'}
            {groups.length > 0 && ` · ${groups.length} ${groups.length === 1 ? 'trip' : 'trips'}`}
            {narrowed && (
              <>
                {' · '}
                <button type="button" onClick={clear} className="font-medium text-primary-ink hover:underline">Clear filters</button>
              </>
            )}
            {groups.length > 1 && (
              <>
                {' · '}
                <button type="button" onClick={() => setCollapsed(allOpen ? new Set(groups.map((g) => g.tripId)) : new Set())} className="font-medium text-primary-ink hover:underline">
                  {allOpen ? 'Collapse all' : 'Expand all'}
                </button>
              </>
            )}
          </p>

          {groups.length === 0 ? (
            <StateCard icon={FileSearch} title="No documents match" description="Try a different search, or clear the filters to see everything.">
              <Button variant="secondary" onClick={clear}>Clear filters</Button>
            </StateCard>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <DocumentGroup key={group.tripId} group={group} open={!collapsed.has(group.tripId)} onToggle={() => toggle(group.tripId)} actions={actions} />
              ))}
            </div>
          )}
        </>
      )}

      <UploadDialog open={uploading} trips={trips.data ?? []} defaultTripId={tripId} onClose={() => setUploading(false)} />
      {actions.element}
    </div>
  )
}
