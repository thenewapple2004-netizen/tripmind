import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CalendarPlus, ChevronDown, Luggage, Plus, ReceiptText, Ticket, X } from 'lucide-react'
import type { Trip } from '@/api/types'
import { ActivityDialog } from '@/components/activities/ActivityDialog'
import { ExpenseDialog } from '@/components/expenses/ExpenseDialog'
import { Button, buttonStyles } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { inputStyles } from '@/components/ui/TextField'
import { useTrips } from '@/hooks/useTrips'
import { formatDateRange, getTripStatus, sortTrips } from '@/lib/trips'

export type AddKind = 'activity' | 'expense'

const COPY: Record<AddKind, { label: string; title: string; hint: string }> = {
  activity: { label: 'Add activity', title: 'Add an activity', hint: 'Which trip is this activity for?' },
  expense: { label: 'Log expense', title: 'Log an expense', hint: 'Which trip did you spend on?' },
}

/** Small modal that asks which trip an activity or expense belongs to. */
function TripPickerDialog({
  open,
  kind,
  trips,
  onPick,
  onClose,
}: {
  open: boolean
  kind: AddKind
  trips: Trip[]
  onPick: (trip: Trip) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [choice, setChoice] = useState('')

  const ordered = useMemo(() => sortTrips(trips, 'upcoming'), [trips])
  const fallback = ordered.find((t) => getTripStatus(t) !== 'completed') ?? ordered[0]
  const selected = ordered.find((t) => t.id === choice) ?? fallback

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="animate-dialog-in m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-fg shadow-pop backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 id={titleId} className="font-display text-lg font-bold">
          {COPY[kind].title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-9 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-fg">{COPY[kind].hint}</span>
          <select value={selected?.id ?? ''} onChange={(e) => setChoice(e.target.value)} className={inputStyles}>
            {ordered.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {formatDateRange(t.start_date, t.end_date)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!selected} onClick={() => selected && onPick(selected)}>
            Continue
          </Button>
        </div>
      </div>
    </dialog>
  )
}

/**
 * Add an activity or expense from anywhere in the portal. Picks the trip first (skipped when
 * there is only one), then reuses the same dialogs as the trip page.
 */
export function AddFlow({ kind, open, onClose }: { kind: AddKind; open: boolean; onClose: () => void }) {
  const { data: trips = [], isSuccess } = useTrips()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<Trip | null>(null)

  // With a single trip there's nothing to choose, and with none we send them to create one.
  const only = trips.length === 1 ? trips[0] : null
  const active = trip ?? only

  useEffect(() => {
    if (open && isSuccess && trips.length === 0) {
      onClose()
      navigate('/trips/new')
    }
  }, [open, isSuccess, trips.length, onClose, navigate])

  const close = () => {
    setTrip(null)
    onClose()
  }

  return (
    <>
      <TripPickerDialog
        open={open && !active && trips.length > 1}
        kind={kind}
        trips={trips}
        onPick={setTrip}
        onClose={close}
      />
      {active && kind === 'expense' && <ExpenseDialog open={open} trip={active} onClose={close} />}
      {active && kind === 'activity' && <ActivityDialog open={open} trip={active} onClose={close} />}
    </>
  )
}

export function QuickAddButton({
  kind,
  variant = 'secondary',
  size,
  className,
}: {
  kind: AddKind
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const Icon = kind === 'expense' ? ReceiptText : CalendarPlus
  return (
    <>
      <Button variant={variant} size={size} className={className} icon={<Icon className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        {COPY[kind].label}
      </Button>
      <AddFlow kind={kind} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** The global "Add" menu in the top bar: new trip, activity or expense. */
export function QuickAddMenu() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [kind, setKind] = useState<AddKind | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const item =
    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg'

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className={buttonStyles({ variant: 'secondary' })}
      >
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">Add</span>
        <span className="sr-only sm:hidden">Add</span>
        <ChevronDown className={cn('size-4 transition', menuOpen && 'rotate-180')} aria-hidden />
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Add"
          className="absolute right-0 z-50 mt-2 w-56 animate-dialog-in rounded-lg border border-line-strong bg-surface p-1.5 shadow-pop"
        >
          <Link to="/trips/new" role="menuitem" className={item} onClick={() => setMenuOpen(false)}>
            <Luggage className="size-4 text-primary-ink" aria-hidden />
            New trip
          </Link>
          <Link to="/bookings?new=1" role="menuitem" className={item} onClick={() => setMenuOpen(false)}>
            <Ticket className="size-4 text-primary-ink" aria-hidden />
            New booking
          </Link>
          {(['activity', 'expense'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setMenuOpen(false)
                setKind(k)
              }}
            >
              {k === 'expense' ? (
                <ReceiptText className="size-4 text-primary-ink" aria-hidden />
              ) : (
                <CalendarPlus className="size-4 text-primary-ink" aria-hidden />
              )}
              {COPY[k].label}
            </button>
          ))}
        </div>
      )}

      {kind && <AddFlow kind={kind} open onClose={() => setKind(null)} />}
    </div>
  )
}
