import { useState } from 'react'
import { DollarSign, Plus, Receipt } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Expense, Trip } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useBudgetSummary, useDeleteExpense, useExpenses } from '@/hooks/useExpenses'
import { EXPENSE_CATEGORIES } from '@/lib/schema'
import { BudgetOverview } from './BudgetOverview'
import { ExpenseCard } from './ExpenseCard'
import { ExpenseDialog } from './ExpenseDialog'

interface ExpenseSectionProps {
  trip: Trip
}

export function ExpenseSection({ trip }: ExpenseSectionProps) {
  const toast = useToast()
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)

  const categoryQuery = selectedCategory === 'All' ? undefined : selectedCategory
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(trip.id, categoryQuery)
  const { data: summary, isLoading: loadingSummary } = useBudgetSummary(trip.id)
  const deleteExpense = useDeleteExpense(trip.id)

  const handleOpenAdd = () => {
    setEditingExpense(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp)
    setDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return
    try {
      await deleteExpense.mutateAsync(deletingExpense.id)
      toast.success(`“${deletingExpense.title}” was deleted.`)
      setDeletingExpense(null)
    } catch {
      // Error handled by dialog
    }
  }

  return (
    <section className="space-y-6 pt-6 border-t border-line">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold tracking-tight text-fg">Expenses & Budget</h2>
            {summary && (
              <span className="inline-flex items-center justify-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-soft-fg">
                {summary.expense_count} {summary.expense_count === 1 ? 'expense' : 'expenses'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Track actual spending, categorize receipts, and monitor your remaining budget.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={handleOpenAdd}
        >
          Log Expense
        </Button>
      </div>

      {/* Budget Summary Card */}
      {loadingSummary ? (
        <Skeleton className="h-44 rounded-2xl" />
      ) : summary ? (
        <BudgetOverview summary={summary} />
      ) : null}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedCategory === 'All'
              ? 'bg-primary text-primary-fg shadow-sm'
              : 'bg-surface-2 text-fg-muted hover:text-fg'
          }`}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary text-primary-fg shadow-sm'
                : 'bg-surface-2 text-fg-muted hover:text-fg'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expense List */}
      {loadingExpenses ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/50 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Receipt className="size-6" aria-hidden />
          </div>
          <h3 className="mt-4 text-base font-semibold text-fg">
            {selectedCategory === 'All'
              ? 'No expenses logged yet'
              : `No ${selectedCategory.toLowerCase()} expenses found`}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
            {selectedCategory === 'All'
              ? 'Keep your travel budget on track by logging purchases, hotel stays, tickets, and meals.'
              : `You haven't recorded any expenses under ${selectedCategory} yet.`}
          </p>
          <Button
            variant="secondary"
            icon={<DollarSign className="size-4" aria-hidden />}
            onClick={handleOpenAdd}
            className="mt-5"
          >
            Log First Expense
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onEdit={handleOpenEdit}
              onDelete={setDeletingExpense}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <ExpenseDialog
        open={dialogOpen}
        trip={trip}
        expense={editingExpense}
        onClose={() => {
          setDialogOpen(false)
          setEditingExpense(null)
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingExpense)}
        title="Delete this expense?"
        description={
          deletingExpense
            ? `“${deletingExpense.title}” will be permanently removed and your budget updated.`
            : ''
        }
        confirmLabel="Delete expense"
        pending={deleteExpense.isPending}
        error={
          deleteExpense.error instanceof ApiError
            ? deleteExpense.error.message
            : deleteExpense.error
            ? 'Failed to delete expense. Please try again.'
            : null
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeletingExpense(null)
          deleteExpense.reset()
        }}
      />
    </section>
  )
}
