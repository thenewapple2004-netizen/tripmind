import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PieChart as PieIcon, TrendingUp } from 'lucide-react'
import type { OwnerCategoryExpense, OwnerSpendingTrend } from '@/api/ownerTypes'
import { Card, CardHeader, EmptyNote } from '@/components/ui/Card'
import { categoryColor, formatCompactCurrency, formatMonth } from '@/lib/owner'
import { ChartTooltip } from './ChartTooltip'

export function SpendingTrendCard({ trends }: { trends: OwnerSpendingTrend[] }) {
  const data = trends.map((t) => ({ ...t, label: formatMonth(t.period) }))
  return (
    <Card className="h-full">
      <CardHeader
        title="Spending trends"
        description="Monthly expenses across all trips"
        icon={<TrendingUp className="size-4" aria-hidden />}
      />
      {data.length === 0 ? (
        <EmptyNote icon={<TrendingUp className="size-6" aria-hidden />} className="h-52">
          No spending yet. Log an expense on a trip to see your trend.
        </EmptyNote>
      ) : (
        <div className="h-52" role="img" aria-label={`Monthly spending, ${data.length} months`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatCompactCurrency(v)}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--line-strong)' }} />
              <Area
                type="monotone"
                dataKey="total_spent"
                name="Spent"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#spendFill)"
                dot={{ fill: 'var(--primary)', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

export function CategoryCard({ categories }: { categories: OwnerCategoryExpense[] }) {
  return (
    <Card className="h-full">
      <CardHeader title="By category" description="Where the money goes" icon={<PieIcon className="size-4" aria-hidden />} />
      {categories.length === 0 ? (
        <EmptyNote icon={<PieIcon className="size-6" aria-hidden />} className="h-52">
          No categories yet.
        </EmptyNote>
      ) : (
        <div className="flex flex-col items-center gap-4 @lg:flex-row @lg:items-center">
          <div className="size-36 shrink-0" role="img" aria-label="Expense categories">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="total_amount"
                  nameKey="category"
                  innerRadius={44}
                  outerRadius={66}
                  paddingAngle={3}
                  stroke="none"
                >
                  {categories.map((c, i) => (
                    <Cell key={c.category} fill={categoryColor(c.category, i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-1.5">
            {categories.slice(0, 5).map((c, i) => (
              <li key={c.category} className="flex items-center gap-2 text-xs">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: categoryColor(c.category, i) }} />
                <span className="flex-1 truncate text-fg-muted">{c.category}</span>
                <span className="font-semibold text-fg tabular-nums">{formatCompactCurrency(c.total_amount)}</span>
                <span className="w-9 text-right text-fg-subtle tabular-nums">{Math.round(c.percentage)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
