import { Link } from 'react-router'
import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import type { OwnerDashboardOverview } from '@/api/ownerTypes'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { cn } from '@/components/ui/cn'
import { formatCompactCurrency } from '@/lib/owner'

const tile =
  'group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-xl p-4 transition duration-300 hover:shadow-lift'

export function QuickTiles({ overview }: { overview: OwnerDashboardOverview | undefined }) {
  const used = overview?.budget_utilization_pct ?? 0
  const hasBudget = (overview?.total_budget ?? 0) > 0
  return (
    <ul className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
      <li>
        <Link to="/trips/new" className={cn(tile, 'h-full bg-primary text-primary-fg')}>
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary-fg/10 transition group-hover:rotate-90">
            <Plus className="size-6" aria-hidden />
          </span>
          <span>
            <span className="block font-display text-base font-bold">Plan a trip</span>
            <span className="text-xs opacity-75">Dates, budget, destination</span>
          </span>
        </Link>
      </li>
      <li>
        <Link to="/itinerary" className={cn(tile, 'h-full border border-line bg-surface-2 text-fg hover:border-primary/40')}>
          <span className="flex size-11 items-center justify-center rounded-lg bg-info-soft text-info-soft-fg">
            <CalendarDays className="size-6" aria-hidden />
          </span>
          <span>
            <span className="block font-display text-base font-bold">Itinerary</span>
            <span className="text-xs text-fg-subtle">Every activity, by day</span>
          </span>
        </Link>
      </li>
      <li>
        <Link
          to="/expenses"
          className={cn(tile, 'h-full border border-line bg-surface text-fg hover:border-primary/40')}
        >
          <ProgressRing
            value={hasBudget ? used : 0}
            danger={overview?.is_over_budget}
            size={60}
            stroke={6}
            label={hasBudget ? `${Math.round(used)} percent of budget used` : 'No budget set'}
          >
            <span className="font-display text-sm font-bold tabular-nums">{hasBudget ? `${Math.round(used)}%` : '—'}</span>
            <span className="text-[9px] text-fg-subtle">used</span>
          </ProgressRing>
          <span className="min-w-0 text-xs text-fg-subtle">
            {hasBudget && overview ? (
              <>
                <span className="block truncate font-display text-base font-bold text-fg tabular-nums">
                  {formatCompactCurrency(Math.abs(overview.remaining_budget))}
                </span>
                {overview.is_over_budget ? 'over budget' : 'left to spend'}
              </>
            ) : (
              'No budget set yet'
            )}
          </span>
        </Link>
      </li>
      <li>
        <Link
          to="/planner"
          className={cn(tile, 'h-full border border-dashed border-primary/40 bg-primary-soft text-primary-soft-fg')}
        >
          <span className="relative flex size-11 items-center justify-center rounded-lg bg-primary/20">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <span className="relative">
            <span className="block font-display text-base font-bold">AI Planner</span>
            <span className="text-xs opacity-80">Coming soon</span>
          </span>
        </Link>
      </li>
    </ul>
  )
}
