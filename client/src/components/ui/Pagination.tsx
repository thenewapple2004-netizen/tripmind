import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

export function Pagination({
  page,
  totalPages,
  onChange,
  busy,
  label,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  busy?: boolean
  label: string
}) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-2">
      <Button
        size="sm"
        variant="secondary"
        icon={<ChevronLeft className="size-4" aria-hidden />}
        disabled={page <= 1 || busy}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <p className="text-xs text-fg-subtle tabular-nums" aria-live="polite">
        Page {page} of {totalPages}
      </p>
      <Button size="sm" variant="secondary" disabled={page >= totalPages || busy} onClick={() => onChange(page + 1)}>
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  )
}
