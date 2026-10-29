import { Search, X } from 'lucide-react'
import type { DocumentKind, Trip } from '@/api/types'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { DOCUMENT_KINDS, DOCUMENT_SORTS, type DocumentSort } from '@/lib/documents'

/** Compact category counts that double as a filter. Categories with no documents aren't listed. */
export function KindChips({ counts, total, active, onSelect }: { counts: Array<{ kind: DocumentKind; label: string; count: number }>; total: number; active?: DocumentKind; onSelect: (kind?: DocumentKind) => void }) {
  const chip = (selected: boolean) =>
    cn(
      'h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
      selected ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg',
    )
  return (
    <div role="group" aria-label="Documents by category" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={!active} onClick={() => onSelect(undefined)} className={chip(!active)}>
        All <span className="tabular-nums">{total}</span>
      </button>
      {counts.map((c) => (
        <button key={c.kind} type="button" aria-pressed={active === c.kind} onClick={() => onSelect(active === c.kind ? undefined : c.kind)} className={chip(active === c.kind)}>
          {c.label} <span className="tabular-nums">{c.count}</span>
        </button>
      ))}
    </div>
  )
}

const select = cn(inputStyles, 'w-full')

export function DocumentToolbar({
  search, onSearch, tripId, onTrip, kind, onKind, sort, onSort, trips,
}: {
  search: string
  onSearch: (v: string) => void
  tripId?: string
  onTrip: (v?: string) => void
  kind?: DocumentKind
  onKind: (v?: DocumentKind) => void
  sort: DocumentSort
  onSort: (v: DocumentSort) => void
  trips: Array<Pick<Trip, 'id' | 'title'>>
}) {
  return (
    <div role="search" className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_10rem]">
      <div className="relative col-span-2 lg:col-span-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by file name"
          aria-label="Search documents by file name"
          className={cn(inputStyles, 'pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Clear search" className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <select aria-label="Trip" value={tripId ?? ''} onChange={(e) => onTrip(e.target.value || undefined)} className={select}>
        <option value="">All trips</option>
        {trips.map((t) => (
          <option key={t.id} value={t.id}>{t.title}</option>
        ))}
      </select>
      <select aria-label="Document type" value={kind ?? ''} onChange={(e) => onKind((e.target.value || undefined) as DocumentKind | undefined)} className={select}>
        <option value="">All types</option>
        {DOCUMENT_KINDS.map((k) => (
          <option key={k.value} value={k.value}>{k.label}</option>
        ))}
      </select>
      <select aria-label="Sort documents" value={sort} onChange={(e) => onSort(e.target.value as DocumentSort)} className={cn(select, 'col-span-2 lg:col-span-1')}>
        {DOCUMENT_SORTS.map((s) => (
          <option key={s.value} value={s.value}>Sort: {s.label}</option>
        ))}
      </select>
    </div>
  )
}
