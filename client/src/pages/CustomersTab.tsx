import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CircleAlert, ListFilter, Plus, Search, SearchX, UsersRound, X } from 'lucide-react'
import type { CustomerQuery, CustomerSort } from '@/api/crm'
import type { ContactMethod, CustomerSummary } from '@/api/crmTypes'
import { useFilterParams, oneOf, useSearchParam } from '@/components/crm/useFilterParams'
import { useWorkspace } from '@/components/crm/Workspace'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useCustomers } from '@/hooks/useCrm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToday } from '@/hooks/useToday'
import { ago, CONTACT_METHODS, dueLabel, initials } from '@/lib/crm'
import { pluralize } from '@/lib/trips'

const SORTS: Array<{ value: CustomerSort; label: string }> = [
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'activity_desc', label: 'Recent activity' },
  { value: 'newest', label: 'Newest first' },
  { value: 'inquiries_desc', label: 'Most open inquiries' },
]
const STATUSES = ['active', 'archived', 'all'] as const
const PIPELINE = ['open', 'none'] as const
const TRIPS = ['yes', 'no'] as const
const PAGE_SIZE = 20

const select = cn(inputStyles, 'w-full')

/** A column header that sorts when it can. `aria-sort` tells assistive tech which column is in force. */
function SortHeader({
  label,
  ascending,
  descending,
  sort,
  onSort,
  className,
}: {
  label: string
  ascending?: CustomerSort
  descending?: CustomerSort
  sort: CustomerSort
  onSort: (sort: CustomerSort) => void
  className?: string
}) {
  const active = sort === ascending || sort === descending
  const direction = sort === ascending ? 'ascending' : sort === descending ? 'descending' : 'none'
  // Names sort both ways; the other columns have one useful order.
  const next = ascending && descending ? (sort === ascending ? descending : ascending) : (ascending ?? (descending as CustomerSort))
  const Icon = !active ? ArrowUpDown : direction === 'ascending' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={direction} className={cn('px-4 py-2.5 text-left text-xs font-semibold text-fg-muted', className)}>
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cn('-mx-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-surface-3 hover:text-fg', active && 'text-fg')}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </th>
  )
}

function Contact({ customer }: { customer: CustomerSummary }) {
  return (
    <div className="min-w-0 text-sm">
      {customer.email && <p className="truncate text-fg">{customer.email}</p>}
      {customer.phone && <p className={cn('truncate', customer.email ? 'text-fg-muted' : 'text-fg')}>{customer.phone}</p>}
    </div>
  )
}

function FollowUpCell({ customer, today }: { customer: CustomerSummary; today: string }) {
  if (!customer.next_follow_up_on) return <span className="text-fg-subtle">None</span>
  const overdue = customer.next_follow_up_on < today
  return (
    <span className={cn(overdue ? 'font-semibold text-danger' : customer.next_follow_up_on === today ? 'font-semibold text-primary-ink' : 'text-fg-muted')}>
      {dueLabel(customer.next_follow_up_on, today)}
    </span>
  )
}

export function CustomersTab() {
  useDocumentTitle('Customers')
  const workspace = useWorkspace()
  const today = useToday()
  const { params, set, clear } = useFilterParams()
  const search = useSearchParam()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const status = oneOf(params.get('status'), STATUSES) ?? 'active'
  const pipeline = oneOf(params.get('pipeline'), PIPELINE)
  const trips = oneOf(params.get('trips'), TRIPS)
  const contact = oneOf(params.get('contact'), CONTACT_METHODS.map((c) => c.value)) as ContactMethod | undefined
  const sort = oneOf(params.get('sort'), SORTS.map((s) => s.value)) ?? 'name_asc'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const query: CustomerQuery = {
    q: search.query || undefined,
    status,
    has_open_inquiry: pipeline === 'open' ? true : pipeline === 'none' ? false : undefined,
    has_trips: trips === 'yes' ? true : trips === 'no' ? false : undefined,
    preferred_contact: contact,
    sort,
    page,
    page_size: PAGE_SIZE,
  }
  const list = useCustomers(query)
  // Whether the owner has any customers at all, whatever is filtered: decides between "nothing yet" and "nothing matches".
  const everyone = useCustomers({ status: 'all', page_size: 1 })

  const narrowing = [search.query, pipeline, trips, contact, status !== 'active' ? status : undefined].filter(Boolean).length
  const resetFilters = () => {
    search.clear()
    clear('q', 'status', 'pipeline', 'trips', 'contact')
  }

  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const noCustomersAtAll = everyone.data?.total === 0

  return (
    <section aria-label="Customer directory" className="space-y-4">
      {!noCustomersAtAll && (
        <div className="flex flex-wrap items-center gap-2" role="search">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              type="search"
              value={search.text}
              onChange={(e) => search.setText(e.target.value)}
              placeholder="Search by name, email, phone or place"
              aria-label="Search customers by name, email, phone or place"
              className={cn(inputStyles, 'pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
            />
            {search.text && (
              <button type="button" onClick={search.clear} aria-label="Clear search" className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="customer-filters"
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2 sm:hidden"
          >
            <ListFilter className="size-4" aria-hidden />
            Filters
            {narrowing > 0 && <span className="rounded bg-primary px-1.5 text-xs font-semibold text-primary-fg">{narrowing}</span>}
          </button>
          <div id="customer-filters" className={cn('basis-full grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:flex lg:basis-auto', filtersOpen ? 'grid' : 'hidden sm:grid')}>
            <select aria-label="Show customers" value={status} onChange={(e) => set('status', e.target.value, 'active')} className={cn(select, 'lg:w-36')}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">Active and archived</option>
            </select>
            <select aria-label="Open inquiries" value={pipeline ?? ''} onChange={(e) => set('pipeline', e.target.value)} className={cn(select, 'lg:w-44')}>
              <option value="">Any pipeline</option>
              <option value="open">With open inquiries</option>
              <option value="none">No open inquiries</option>
            </select>
            <select aria-label="Trips" value={trips ?? ''} onChange={(e) => set('trips', e.target.value)} className={cn(select, 'lg:w-36')}>
              <option value="">Any trips</option>
              <option value="yes">Has trips</option>
              <option value="no">No trips yet</option>
            </select>
            <select aria-label="Preferred contact method" value={contact ?? ''} onChange={(e) => set('contact', e.target.value)} className={cn(select, 'lg:w-40')}>
              <option value="">Any contact method</option>
              {CONTACT_METHODS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select aria-label="Sort customers" value={sort} onChange={(e) => set('sort', e.target.value, 'name_asc')} className={cn(select, 'col-span-2 sm:col-span-1 lg:w-44')}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {list.isPending || everyone.isPending ? (
        <div role="status" aria-label="Loading customers" className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : list.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your customers" description="Something went wrong while fetching them. Your records are safe.">
          <Button onClick={() => list.refetch()} loading={list.isFetching}>Try again</Button>
        </StateCard>
      ) : noCustomersAtAll ? (
        <StateCard icon={UsersRound} title="No customers yet" description="Add the people who contact you to organise a trip. Each one keeps their inquiries, follow-ups and trips together in one place.">
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={workspace.newCustomer}>Add your first customer</Button>
        </StateCard>
      ) : items.length === 0 ? (
        <StateCard icon={SearchX} title="No customers match" description={search.query ? `Nothing matches “${search.query}” with these filters. Try fewer filters or a different search.` : 'No customers match these filters.'}>
          <Button onClick={resetFilters}>Clear filters</Button>
        </StateCard>
      ) : (
        <div className={cn('space-y-3', list.isFetching && 'opacity-70 transition-opacity')}>
          <p aria-live="polite" className="text-sm text-fg-subtle">
            {pluralize(total, 'customer')}
            {narrowing > 0 && (
              <>
                {' · '}
                <button type="button" onClick={resetFilters} className="font-medium text-primary-ink hover:underline">Clear filters</button>
              </>
            )}
          </p>

          {/* Wide screens: a table that can be sorted by its headers. */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <table className="w-full table-fixed border-collapse">
              <caption className="sr-only">Customers</caption>
              <thead className="border-b border-line bg-surface-2/60">
                <tr>
                  <SortHeader label="Customer" ascending="name_asc" descending="name_desc" sort={sort} onSort={(s) => set('sort', s, 'name_asc')} className="w-[30%]" />
                  <th scope="col" className="w-[24%] px-4 py-2.5 text-left text-xs font-semibold text-fg-muted">Contact</th>
                  <SortHeader label="Inquiries" descending="inquiries_desc" sort={sort} onSort={(s) => set('sort', s, 'name_asc')} className="w-[12%]" />
                  <th scope="col" className="w-[8%] px-4 py-2.5 text-left text-xs font-semibold text-fg-muted">Trips</th>
                  <th scope="col" className="w-[14%] px-4 py-2.5 text-left text-xs font-semibold text-fg-muted">Next follow-up</th>
                  <SortHeader label="Last activity" descending="activity_desc" sort={sort} onSort={(s) => set('sort', s, 'name_asc')} className="w-[12%]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((c) => (
                  <tr key={c.id} onClick={() => workspace.openCustomer(c.id)} className="cursor-pointer transition-colors hover:bg-surface-2/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={initials(c.name)} className="size-9 text-xs" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              workspace.openCustomer(c.id)
                            }}
                            className="block max-w-full truncate text-left text-sm font-semibold text-fg hover:text-primary-ink hover:underline"
                          >
                            {c.name}
                          </button>
                          <p className="truncate text-xs text-fg-subtle">
                            {c.is_archived ? 'Archived' : [c.city, c.country].filter(Boolean).join(', ') || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Contact customer={c} /></td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {c.total_inquiries === 0 ? (
                        <span className="text-fg-subtle">None</span>
                      ) : (
                        <span className="text-fg">
                          {c.open_inquiries} open
                          <span className="text-fg-subtle"> / {c.total_inquiries}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">{c.trip_count > 0 ? c.trip_count : <span className="text-fg-subtle">0</span>}</td>
                    <td className="px-4 py-3 text-sm"><FollowUpCell customer={c} today={today} /></td>
                    <td className="px-4 py-3 text-sm text-fg-muted">{ago(c.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: the same people as a plain list. */}
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:hidden">
            {items.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => workspace.openCustomer(c.id)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-surface-2/70">
                  <Avatar initials={initials(c.name)} className="size-10 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{c.name}</span>
                    <span className="block truncate text-sm text-fg-muted">{c.email ?? c.phone}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-fg-subtle">
                      <span>{c.total_inquiries === 0 ? 'No inquiries' : `${c.open_inquiries} open of ${pluralize(c.total_inquiries, 'inquiry').replace('inquirys', 'inquiries')}`}</span>
                      {c.trip_count > 0 && <span>{pluralize(c.trip_count, 'trip')}</span>}
                      {c.next_follow_up_on && <span className={cn(c.next_follow_up_on < today && 'font-semibold text-danger')}>Follow-up {dueLabel(c.next_follow_up_on, today).toLowerCase()}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <Pagination label="Customer pages" page={list.data?.page ?? 1} totalPages={list.data?.total_pages ?? 1} busy={list.isFetching} onChange={(p) => set('page', String(p), '1')} />
        </div>
      )}
    </section>
  )
}
