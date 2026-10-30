import { CircleAlert, KanbanSquare, List, Plus, Search, SearchX, UserPlus, X } from 'lucide-react'
import type { InquirySort } from '@/api/crm'
import { InquiryBoard } from '@/components/crm/InquiryBoard'
import { InquiryList } from '@/components/crm/InquiryList'
import { oneOf, useFilterParams, useSearchParam } from '@/components/crm/useFilterParams'
import { useWorkspace } from '@/components/crm/Workspace'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useAllInquiries, useCustomers } from '@/hooks/useCrm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToday } from '@/hooks/useToday'
import { STAGES, STAGE_LABEL } from '@/lib/crm'
import { pluralize } from '@/lib/trips'

const VIEWS = ['board', 'list'] as const
const SORTS: Array<{ value: InquirySort; label: string }> = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'created_desc', label: 'Newest first' },
  { value: 'start_asc', label: 'Trip date' },
  { value: 'budget_desc', label: 'Highest budget' },
  { value: 'destination_asc', label: 'Destination A–Z' },
]

export function InquiriesTab() {
  useDocumentTitle('Inquiries · Customers')
  const workspace = useWorkspace()
  const today = useToday()
  const { params, set } = useFilterParams()
  const search = useSearchParam()

  const view = oneOf(params.get('view'), VIEWS) ?? 'board'
  const sort = oneOf(params.get('sort'), SORTS.map((s) => s.value)) ?? 'updated_desc'
  const stage = oneOf(params.get('stage'), STAGES)

  const inquiries = useAllInquiries({ q: search.query || undefined, sort })
  const customers = useCustomers({ status: 'all', page_size: 1 })

  const all = inquiries.data?.items ?? []
  // The list view can be narrowed to one stage; the board always shows every stage.
  const shown = view === 'list' && stage ? all.filter((i) => i.stage === stage) : all
  const searching = Boolean(search.query)
  const noCustomers = customers.data?.total === 0
  const nothingAtAll = !inquiries.isPending && !inquiries.isError && all.length === 0 && !searching

  return (
    <section aria-label="Inquiry pipeline" className="space-y-4">
      {!nothingAtAll && (
        <div className="flex flex-wrap items-center gap-2" role="search">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              type="search"
              value={search.text}
              onChange={(e) => search.setText(e.target.value)}
              placeholder="Search by destination or customer"
              aria-label="Search inquiries by destination or customer"
              className={cn(inputStyles, 'pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
            />
            {search.text && (
              <button type="button" onClick={search.clear} aria-label="Clear search" className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {view === 'list' && (
            <>
              <select aria-label="Stage" value={stage ?? ''} onChange={(e) => set('stage', e.target.value)} className={cn(inputStyles, 'w-44')}>
                <option value="">All stages</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </select>
              <select aria-label="Sort inquiries" value={sort} onChange={(e) => set('sort', e.target.value, 'updated_desc')} className={cn(inputStyles, 'w-44')}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </>
          )}
          <div role="group" aria-label="View" className="flex rounded-lg border border-line-strong bg-surface p-0.5">
            {([['board', 'Board', KanbanSquare], ['list', 'List', List]] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => set('view', value, 'board')}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                  view === value ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {inquiries.isPending ? (
        <div role="status" aria-label="Loading inquiries" className="grid gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : inquiries.isError ? (
        <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load your inquiries" description="Something went wrong while fetching them. Your records are safe.">
          <Button onClick={() => inquiries.refetch()} loading={inquiries.isFetching}>Try again</Button>
        </StateCard>
      ) : nothingAtAll ? (
        noCustomers ? (
          <StateCard icon={UserPlus} title="Start with a customer" description="An inquiry is a customer asking about a trip, so add the person first. Then you can log what they want and move it through your pipeline.">
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={workspace.newCustomer}>Add a customer</Button>
          </StateCard>
        ) : (
          <StateCard icon={KanbanSquare} title="No inquiries yet" description="When someone asks about a trip, log it here. It starts in New and moves along as you contact, plan, quote and confirm.">
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => workspace.newInquiry()}>Log your first inquiry</Button>
          </StateCard>
        )
      ) : searching && all.length === 0 ? (
        <StateCard icon={SearchX} title="No inquiries match" description={`Nothing matches “${search.query}”. Try a different destination or customer name.`}>
          <Button onClick={search.clear}>Clear search</Button>
        </StateCard>
      ) : (
        <div className={cn('space-y-3', inquiries.isFetching && !inquiries.isPlaceholderData && 'opacity-80 transition-opacity')}>
          <p aria-live="polite" className="text-sm text-fg-subtle">
            {pluralize(shown.length, 'inquiry').replace('inquirys', 'inquiries')}
            {view === 'board' && ' · drag a card to another stage, or use its move button'}
          </p>
          {view === 'board' ? (
            <InquiryBoard inquiries={all} today={today} />
          ) : shown.length === 0 ? (
            <StateCard icon={SearchX} title={`Nothing in ${stage ? STAGE_LABEL[stage] : 'this view'}`} description="No inquiries are at this stage right now.">
              <Button onClick={() => set('stage', undefined)}>Show all stages</Button>
            </StateCard>
          ) : (
            <InquiryList inquiries={shown} today={today} />
          )}
          {inquiries.data?.truncated && (
            <p className="text-center text-xs text-fg-subtle">Showing your first {all.length} inquiries. Search to find the rest.</p>
          )}
        </div>
      )}
    </section>
  )
}
