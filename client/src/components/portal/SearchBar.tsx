import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ListFilter, Search } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { STATUS_LABEL, type StatusFilter } from '@/lib/trips'

const STATUSES: StatusFilter[] = ['all', 'upcoming', 'ongoing', 'completed']

/** Search + status filter that hands off to the My Trips page (which owns the results). */
export function TripSearchBar({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (status !== 'all') params.set('status', status)
    const qs = params.toString()
    navigate(qs ? `/?${qs}` : '/')
  }

  return (
    <form role="search" onSubmit={submit} className={cn('flex flex-col gap-3 sm:flex-row', className)}>
      <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-line bg-surface pr-4 pl-1.5 shadow-card transition focus-within:border-primary/60">
        <button
          type="submit"
          aria-label="Search trips"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg transition hover:bg-primary-hover"
        >
          <Search className="size-4" aria-hidden />
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trips or destinations"
          aria-label="Search trips or destinations"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <label className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-fg-muted shadow-card">
        <ListFilter className="size-4 text-primary-ink" aria-hidden />
        <span className="sr-only">Filter by status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="cursor-pointer bg-transparent pr-1 font-medium text-fg outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-surface text-fg">
              {s === 'all' ? 'All trips' : STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}
