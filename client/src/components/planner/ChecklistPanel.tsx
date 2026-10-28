import { useState, type FormEvent } from 'react'
import { Check, CircleAlert, Lightbulb, ListChecks, Plus, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { ChecklistCategory, ChecklistItem, Trip } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { inputStyles } from '@/components/ui/TextField'
import { cn } from '@/components/ui/cn'
import { useToast } from '@/components/ui/Toast'
import { useAddChecklistItem, useChecklist, useDeleteChecklistItem, useUpdateChecklistItem } from '@/hooks/useChecklist'

const CATEGORIES: Array<{ value: ChecklistCategory; label: string }> = [
  { value: 'documents', label: 'Documents' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'packing', label: 'Packing' },
  { value: 'health', label: 'Health & safety' },
  { value: 'other', label: 'Other' },
]

// One-click ideas for an empty list. They are only added when you click one.
const SUGGESTIONS: Array<{ text: string; category: ChecklistCategory }> = [
  { text: 'Passport valid for 6+ months', category: 'documents' },
  { text: 'Visa or entry permit', category: 'documents' },
  { text: 'Book accommodation', category: 'bookings' },
  { text: 'Confirm transport tickets', category: 'bookings' },
  { text: 'Travel insurance', category: 'health' },
  { text: 'Download offline maps', category: 'packing' },
  { text: 'Charger and power bank', category: 'packing' },
]

function Row({ item, tripId }: { item: ChecklistItem; tripId: string }) {
  const toast = useToast()
  const update = useUpdateChecklistItem(tripId)
  const remove = useDeleteChecklistItem(tripId)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'That change didn’t save. Please try again.')

  const save = () => {
    const next = text.trim()
    setEditing(false)
    if (!next || next === item.text) return setText(item.text)
    update.mutate({ id: item.id, patch: { text: next } }, { onError: fail })
  }

  return (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.is_done}
        aria-label={`${item.text}${item.is_done ? ', done' : ''}`}
        onClick={() => update.mutate({ id: item.id, patch: { is_done: !item.is_done } }, { onError: fail })}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition',
          item.is_done ? 'border-primary bg-primary text-primary-fg' : 'border-line-strong hover:border-primary',
        )}
      >
        {item.is_done && <Check className="size-4" strokeWidth={3} aria-hidden />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={text}
          maxLength={200}
          aria-label="Edit checklist item"
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setText(item.text)
              setEditing(false)
            }
          }}
          className={cn(inputStyles, 'h-9 flex-1')}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to edit"
          className={cn('min-w-0 flex-1 truncate text-left text-sm', item.is_done ? 'text-fg-subtle line-through' : 'text-fg')}
        >
          {item.text}
        </button>
      )}

      <button
        type="button"
        onClick={() => remove.mutate(item.id, { onError: fail })}
        aria-label={`Delete ${item.text}`}
        className="rounded-lg p-1.5 text-fg-subtle opacity-100 transition hover:bg-danger-soft hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}

export function ChecklistPanel({ trip }: { trip: Trip }) {
  const toast = useToast()
  const { data: items = [], isPending, isError, refetch, isFetching } = useChecklist(trip.id)
  const add = useAddChecklistItem(trip.id)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<ChecklistCategory>('other')
  const [problem, setProblem] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = text.trim()
    if (!next) return setProblem('Type what you need to do first.')
    setProblem(null)
    add.mutate(
      { text: next, category },
      {
        onSuccess: () => setText(''),
        onError: (error) => setProblem(error instanceof ApiError ? error.message : 'We couldn’t add that. Please try again.'),
      },
    )
  }

  const quickAdd = (s: (typeof SUGGESTIONS)[number]) =>
    add.mutate(s, { onError: (error) => toast.error(error instanceof ApiError ? error.message : 'We couldn’t add that.') })

  if (isPending) {
    return (
      <div role="status" aria-label="Loading checklist" className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <StateCard tone="danger" icon={CircleAlert} title="Couldn’t load the checklist" description="Something went wrong while fetching your checklist.">
        <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
          Try again
        </Button>
      </StateCard>
    )
  }

  const done = items.filter((i) => i.is_done).length
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100)
  const unusedSuggestions = SUGGESTIONS.filter((s) => !items.some((i) => i.text.toLowerCase() === s.text.toLowerCase()))

  return (
    <section aria-label="Trip checklist" className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-fg">Checklist</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {items.length === 0 ? 'Everything to sort out before you go.' : done === items.length ? 'All done. Have a great trip!' : `${done} of ${items.length} done`}
            </p>
          </div>
          {items.length > 0 && <p className="font-display text-3xl font-semibold text-primary-ink tabular-nums">{percent}%</p>}
        </div>
        {items.length > 0 && (
          <div
            role="progressbar"
            aria-label="Checklist progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-3"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row" noValidate>
          <label className="sr-only" htmlFor="checklist-text">
            New checklist item
          </label>
          <input
            id="checklist-text"
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add something to do or pack…"
            aria-invalid={problem ? true : undefined}
            className={cn(inputStyles, 'flex-1')}
          />
          <label className="sr-only" htmlFor="checklist-category">
            Category
          </label>
          <select id="checklist-category" value={category} onChange={(e) => setCategory(e.target.value as ChecklistCategory)} className={cn(inputStyles, 'sm:w-44')}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="primary" loading={add.isPending} icon={<Plus className="size-4" aria-hidden />}>
            Add
          </Button>
        </form>
        {problem && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {problem}
          </p>
        )}

        {items.length < 4 && unusedSuggestions.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
              <Lightbulb className="size-3.5" aria-hidden /> Ideas to start with
            </p>
            <div className="flex flex-wrap gap-2">
              {unusedSuggestions.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => quickAdd(s)}
                  className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-fg-muted transition hover:border-primary hover:text-fg"
                >
                  + {s.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {items.length === 0 ? (
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface p-5 text-sm text-fg-muted">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
            <ListChecks className="size-6" aria-hidden />
          </span>
          Your checklist is empty. Add your first item above or pick one of the ideas.
        </div>
      ) : (
        <div className="grid gap-4 @3xl:grid-cols-2">
          {CATEGORIES.map(({ value, label }) => {
            const group = items.filter((i) => i.category === value)
            if (group.length === 0) return null
            return (
              <Card key={value} className="p-4">
                <h3 className="mb-2 flex items-center justify-between px-2 font-display text-sm font-bold text-fg">
                  {label}
                  <span className="text-xs font-medium text-fg-subtle tabular-nums">
                    {group.filter((i) => i.is_done).length}/{group.length}
                  </span>
                </h3>
                <ul>
                  {group.map((item) => (
                    <Row key={item.id} item={item} tripId={trip.id} />
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
