/**
 * OwnerPortalPage.tsx
 * ===================
 * The comprehensive TripMind Owner Dashboard / Portal (Task 17).
 *
 * Sections:
 *  1. KPI Overview Cards
 *  2. Spending Trend Line Chart
 *  3. Category Expense Donut Chart
 *  4. Trip Status Distribution Bar Chart
 *  5. Budget Utilization Progress
 *  6. Upcoming Trips Cards
 *  7. Recent Activities Feed
 *  8. Recent Expenses Table
 *  9. Report History Table
 * 10. Quick Action Buttons
 */

import { useState } from 'react'
import { Link } from 'react-router'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Compass,
  TrendingUp,
  Wallet,
  MapPin,
  Calendar,
  Activity,
  Receipt,
  FileText,
  Plus,
  Download,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Star,
  BarChart3,
} from 'lucide-react'
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import type { OwnerDashboardOverview, OwnerUpcomingTrip } from '@/api/ownerTypes'

// ─── Colour palettes ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f59e0b',
  Transportation: '#3b82f6',
  Accommodation: '#8b5cf6',
  Activities: '#10b981',
  Shopping: '#ec4899',
  Other: '#64748b',
}
const DONUT_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#64748b']

const STATUS_COLOR: Record<string, string> = {
  upcoming: '#3b82f6',
  ongoing: '#10b981',
  completed: '#64748b',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function fmtCompact(amount: number) {
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
  return fmt(amount)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMonth(raw: string) {
  // raw: "2025-03" → "Mar '25"
  const [year, month] = raw.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ─── Skeleton primitive ──────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-skeleton animate-shimmer',
        'bg-[length:400%_100%] bg-gradient-to-r from-skeleton via-skeleton-shine to-skeleton',
        className,
      )}
    />
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent?: string
  highlight?: boolean
  trend?: 'up' | 'down' | 'neutral'
}

function KpiCard({ label, value, sub, icon, accent = 'bg-primary-soft', highlight }: KpiCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:shadow-lift hover:-translate-y-0.5',
        highlight && 'border-danger-line bg-danger-soft',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-medium uppercase tracking-wider', highlight ? 'text-danger-soft-fg' : 'text-fg-subtle')}>
            {label}
          </p>
          <p className={cn('mt-1.5 text-2xl font-bold tabular-nums tracking-tight', highlight ? 'text-danger-soft-fg' : 'text-fg')}>
            {value}
          </p>
          {sub && <p className={cn('mt-0.5 text-xs', highlight ? 'text-danger-soft-fg opacity-80' : 'text-fg-subtle')}>{sub}</p>}
        </div>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', accent)}>
          {icon}
        </span>
      </div>
    </div>
  )
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Sk className="h-3 w-24" />
          <Sk className="h-7 w-32" />
          <Sk className="h-3 w-16" />
        </div>
        <Sk className="size-10 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-subtle">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Budget utilization bar ───────────────────────────────────────────────────

function BudgetBar({ overview }: { overview: OwnerDashboardOverview }) {
  const pct = Math.min(overview.budget_utilization_pct, 100)
  const over = overview.is_over_budget
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <SectionHeader
        title="Budget Overview"
        description="Total budget utilization across all trips"
      />
      <div className="mt-4 space-y-3">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-bold tabular-nums text-fg">
            {overview.budget_utilization_pct.toFixed(1)}%
          </span>
          <span className={cn('text-sm font-medium', over ? 'text-danger-soft-fg' : 'text-success-soft-fg')}>
            {over ? `${fmt(Math.abs(overview.remaining_budget))} over budget` : `${fmt(overview.remaining_budget)} remaining`}
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all duration-700',
              over ? 'bg-danger' : pct > 80 ? 'bg-amber-500' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-fg-subtle">
          <span>Spent: {fmt(overview.total_spent)}</span>
          <span>Budget: {fmt(overview.total_budget)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Upcoming Trip Card ──────────────────────────────────────────────────────

function UpcomingTripCard({ trip }: { trip: OwnerUpcomingTrip }) {
  const pct = trip.budget > 0 ? Math.min((trip.total_spent / trip.budget) * 100, 100) : 0
  const over = trip.total_spent > trip.budget
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-200 hover:border-primary/30 hover:shadow-lift hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg group-hover:text-primary transition-colors">{trip.title}</p>
          <p className="flex items-center gap-1 text-xs text-fg-subtle">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {trip.destination}
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-info-soft px-2 py-0.5 text-xs font-medium text-info-soft-fg">
          {trip.days_until_start === 0
            ? 'Today'
            : trip.days_until_start === 1
              ? 'Tomorrow'
              : `In ${trip.days_until_start}d`}
        </span>
      </div>

      <div className="flex gap-3 text-xs text-fg-subtle">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" aria-hidden />
          {fmtDate(trip.start_date)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" aria-hidden />
          {trip.duration_days}d trip
        </span>
        <span className="flex items-center gap-1">
          <Activity className="size-3" aria-hidden />
          {trip.activity_count} activities
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-fg-subtle">{fmtCompact(trip.total_spent)} spent</span>
          <span className={over ? 'text-danger-soft-fg' : 'text-fg-subtle'}>{fmtCompact(trip.budget)} budget</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn('h-full rounded-full transition-all', over ? 'bg-danger' : pct > 80 ? 'bg-amber-500' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

// ─── Custom Tooltip for charts ───────────────────────────────────────────────

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; formatter?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  const f = formatter ?? fmtCompact
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lift text-sm">
      {label && <p className="mb-1 font-medium text-fg">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-fg-muted">
          <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold text-fg tabular-nums">{f(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Main OwnerPortalPage ────────────────────────────────────────────────────

export function OwnerPortalPage() {
  useDocumentTitle('Owner Portal')
  const { data, isPending, isError, refetch, isFetching } = useOwnerDashboard()
  const [activeTab, setActiveTab] = useState<'activities' | 'expenses' | 'reports'>('activities')

  // ── Loading skeleton ──
  if (isPending) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PortalHeader />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-line bg-surface p-5 shadow-card h-72">
            <Sk className="h-full w-full" />
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card h-72">
            <Sk className="h-full w-full" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (isError || !data) {
    return (
      <div className="space-y-8">
        <PortalHeader />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface py-16 text-center shadow-card">
          <AlertTriangle className="size-12 text-danger-soft-fg" aria-hidden />
          <div>
            <p className="font-semibold text-fg">Failed to load dashboard</p>
            <p className="text-sm text-fg-muted">We couldn't fetch your owner data. Please try again.</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover transition-colors"
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} aria-hidden />
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { overview, category_expenses, spending_trends, trip_status_distribution, upcoming_trips, recent_activities, recent_expenses, reports_history } = data

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Header ── */}
      <PortalHeader />

      {/* ── Quick Actions ── */}
      <div className="flex flex-wrap gap-3">
        <ButtonLink to="/trips/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
          New Trip
        </ButtonLink>
        <ButtonLink to="/" variant="secondary" icon={<MapPin className="size-4" aria-hidden />}>
          My Trips
        </ButtonLink>
      </div>

      {/* ── KPI Overview Cards ── */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="mb-4 text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Trips"
            value={String(overview.total_trips)}
            sub={`${overview.upcoming_trips_count} upcoming`}
            icon={<Compass className="size-5 text-primary" aria-hidden />}
            accent="bg-primary-soft"
          />
          <KpiCard
            label="Ongoing"
            value={String(overview.ongoing_trips_count)}
            sub="right now"
            icon={<Activity className="size-5 text-emerald-600" aria-hidden />}
            accent="bg-success-soft"
          />
          <KpiCard
            label="Completed"
            value={String(overview.completed_trips_count)}
            sub="all time"
            icon={<CheckCircle2 className="size-5 text-slate-500" aria-hidden />}
            accent="bg-neutral-soft"
          />
          <KpiCard
            label="Total Activities"
            value={String(overview.total_activities)}
            sub="across all trips"
            icon={<Star className="size-5 text-amber-500" aria-hidden />}
            accent="bg-amber-50 dark:bg-amber-950/30"
          />
          <KpiCard
            label="Total Budget"
            value={fmtCompact(overview.total_budget)}
            sub="across all trips"
            icon={<Wallet className="size-5 text-primary" aria-hidden />}
            accent="bg-primary-soft"
          />
          <KpiCard
            label="Total Spent"
            value={fmtCompact(overview.total_spent)}
            sub={`${overview.total_expenses_count} expenses`}
            icon={<Receipt className="size-5 text-blue-500" aria-hidden />}
            accent="bg-info-soft"
            highlight={overview.is_over_budget}
          />
          <KpiCard
            label="Remaining"
            value={fmtCompact(Math.abs(overview.remaining_budget))}
            sub={overview.is_over_budget ? 'over budget' : 'available'}
            icon={<TrendingUp className="size-5 text-emerald-600" aria-hidden />}
            accent="bg-success-soft"
            highlight={overview.is_over_budget}
          />
          <KpiCard
            label="Reports"
            value={String(overview.total_reports_count)}
            sub="generated"
            icon={<FileText className="size-5 text-violet-500" aria-hidden />}
            accent="bg-violet-50 dark:bg-violet-950/30"
          />
        </div>
      </section>

      {/* ── Charts Row ── */}
      <section aria-labelledby="charts-heading" className="grid gap-6 lg:grid-cols-3">
        <h2 id="charts-heading" className="sr-only">Analytics Charts</h2>

        {/* Spending Trend Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <SectionHeader
            title="Spending Trends"
            description="Monthly expenses across all trips"
          />
          {spending_trends.length === 0 ? (
            <EmptyChart message="No spending data yet. Add expenses to see your trends." />
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spending_trends.map(t => ({ ...t, month: fmtMonth(t.month) }))}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total_spent"
                    name="Spent"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#spendGradient)"
                    dot={{ fill: 'var(--primary)', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Donut Chart */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <SectionHeader title="By Category" description="Expense distribution" />
          {category_expenses.length === 0 ? (
            <EmptyChart message="No category data yet." />
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={category_expenses}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="total"
                    nameKey="category"
                    paddingAngle={2}
                  >
                    {category_expenses.map((entry, index) => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[entry.category] ?? DONUT_COLORS[index % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as { category: string; total: number; percentage: number }
                      return (
                        <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lift text-sm">
                          <p className="font-medium text-fg">{d.category}</p>
                          <p className="text-fg-muted">{fmtCompact(d.total)} · {d.percentage.toFixed(1)}%</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center -mt-2">
                {category_expenses.slice(0, 5).map((e, i) => (
                  <span key={e.category} className="flex items-center gap-1 text-xs text-fg-muted">
                    <span className="size-2 rounded-full" style={{ background: CATEGORY_COLORS[e.category] ?? DONUT_COLORS[i] }} />
                    {e.category}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Budget & Trip Status Row ── */}
      <section aria-labelledby="budget-status-heading" className="grid gap-6 lg:grid-cols-2">
        <h2 id="budget-status-heading" className="sr-only">Budget and Status</h2>
        <BudgetBar overview={overview} />

        {/* Trip Status Distribution */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <SectionHeader title="Trip Status" description="Distribution by status" />
          {trip_status_distribution.every(d => d.count === 0) ? (
            <EmptyChart message="No trips found." />
          ) : (
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trip_status_distribution} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="status"
                    tick={({ x, y, payload }) => (
                      <text x={x} y={y} textAnchor="end" dominantBaseline="middle" fontSize={12} fill="var(--fg-muted)" style={{ textTransform: 'capitalize' }}>
                        {payload.value}
                      </text>
                    )}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as { status: string; count: number; percentage: number }
                      return (
                        <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lift text-sm">
                          <p className="font-medium capitalize text-fg">{d.status}</p>
                          <p className="text-fg-muted">{d.count} trips · {d.percentage.toFixed(1)}%</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {trip_status_distribution.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLOR[entry.status] ?? '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ── Upcoming Trips ── */}
      {upcoming_trips.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <SectionHeader
            title="Upcoming Trips"
            description="Your next adventures"
            action={
              <Link to="/" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ChevronRight className="size-3" />
              </Link>
            }
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming_trips.slice(0, 6).map((trip) => (
              <UpcomingTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      {/* ── Activity / Expense / Reports Tabs ── */}
      <section aria-labelledby="details-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="details-heading" className="text-base font-semibold text-fg">Recent Activity</h2>
          <div role="tablist" className="flex rounded-xl border border-line bg-surface p-1 shadow-sm">
            {(['activities', 'expenses', 'reports'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'bg-primary-soft text-primary-soft-fg shadow-sm'
                    : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-surface shadow-card overflow-hidden">

          {/* Activities Tab */}
          {activeTab === 'activities' && (
            recent_activities.length === 0 ? (
              <EmptyTableState
                icon={<Activity className="size-8 text-fg-subtle" aria-hidden />}
                message="No activities yet. Add activities to your trips to see them here."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">Activity</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle sm:table-cell">Trip</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle md:table-cell">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-fg-subtle">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent_activities.map((act) => (
                    <tr key={act.id} className="group hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-fg">{act.title}</p>
                        {act.description && <p className="text-xs text-fg-subtle truncate max-w-48">{act.description}</p>}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Link
                          to={`/trips/${act.trip_id}`}
                          className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                        >
                          {act.trip_title}
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 text-fg-subtle md:table-cell">
                        {act.location ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-fg-subtle whitespace-nowrap">{fmtDate(act.activity_date)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg">{fmt(act.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            recent_expenses.length === 0 ? (
              <EmptyTableState
                icon={<Receipt className="size-8 text-fg-subtle" aria-hidden />}
                message="No expenses yet. Add expenses to your trips to track spending."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">Expense</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle sm:table-cell">Trip</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-fg-subtle">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent_expenses.map((exp) => (
                    <tr key={exp.id} className="group hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-fg">{exp.title}</p>
                        {exp.description && <p className="text-xs text-fg-subtle truncate max-w-48">{exp.description}</p>}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Link
                          to={`/trips/${exp.trip_id}`}
                          className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                        >
                          {exp.trip_title}
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={exp.category} />
                      </td>
                      <td className="px-4 py-3 text-fg-subtle whitespace-nowrap">{fmtDate(exp.expense_date)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg">{fmt(exp.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            reports_history.length === 0 ? (
              <EmptyTableState
                icon={<FileText className="size-8 text-fg-subtle" aria-hidden />}
                message="No reports generated yet. Generate a CSV report from any trip page."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">Report</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle sm:table-cell">Trip</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle md:table-cell">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-subtle">Generated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {reports_history.map((report) => (
                    <tr key={report.task_id} className="group hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-medium text-fg truncate max-w-48">{report.filename}</p>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Link
                          to={`/trips/${report.trip_id}`}
                          className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                        >
                          {report.trip_title}
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 text-fg-subtle md:table-cell">
                        {(report.file_size / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-4 py-3 text-fg-subtle whitespace-nowrap">{fmtDate(report.generated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={report.download_url}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
                          download
                        >
                          <Download className="size-3" aria-hidden />
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </section>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PortalHeader() {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm">
          <BarChart3 className="size-4" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Owner Portal</h1>
      </div>
      <p className="text-sm text-fg-subtle">
        Your complete travel overview — budgets, spending, activities, and reports all in one place.
      </p>
    </div>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `${color}22`, color }}
    >
      {category}
    </span>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="mt-4 flex h-48 flex-col items-center justify-center gap-2 rounded-xl bg-surface-2 text-center">
      <BarChart3 className="size-8 text-fg-subtle" aria-hidden />
      <p className="text-sm text-fg-subtle max-w-48">{message}</p>
    </div>
  )
}

function EmptyTableState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {icon}
      <p className="text-sm text-fg-muted max-w-xs">{message}</p>
    </div>
  )
}
