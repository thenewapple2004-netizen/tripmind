import type { DocumentKind, Trip } from '@/api/types'
import type { DocumentSort } from '@/lib/documents'
import { DocumentToolbar, KindChips } from './DocumentFilters'

/** Category counts, then search, trip, type and sort, in the order you reach for them. */
export function DocumentFilterBar({
  counts, total, kind, onKind, ...toolbar
}: {
  counts: Array<{ kind: DocumentKind; label: string; count: number }>
  total: number
  search: string
  onSearch: (v: string) => void
  tripId?: string
  onTrip: (v?: string) => void
  kind?: DocumentKind
  onKind: (v?: DocumentKind) => void
  sort: DocumentSort
  onSort: (v: DocumentSort) => void
  trips: Trip[]
}) {
  return (
    <div className="space-y-3">
      <KindChips counts={counts} total={total} active={kind} onSelect={onKind} />
      <DocumentToolbar {...toolbar} kind={kind} onKind={onKind} />
    </div>
  )
}
