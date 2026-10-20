import { useState } from 'react'
import { CalendarCheck2, Compass, Plus, TrendingUp, Wallet } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { Activity, Trip } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useActivities, useDeleteActivity } from '@/hooks/useActivities'
import { formatCurrency } from '@/lib/trips'
import { ActivityCard } from './ActivityCard'
import { ActivityDialog } from './ActivityDialog'

interface ActivitySectionProps {
  trip: Trip
}

export function ActivitySection({ trip }: ActivitySectionProps) {
  const toast = useToast()
  const { data: activities = trip.activities ?? [], isLoading } = useActivities(trip.id)
  const deleteActivity = useDeleteActivity(trip.id)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null)

  const totalCost = activities.reduce((sum, item) => sum + Number(item.cost || 0), 0)
  const remainingBudget = Number(trip.budget) - totalCost
  const budgetPercent = trip.budget > 0 ? Math.round((totalCost / Number(trip.budget)) * 100) : 0
  const isOverBudget = remainingBudget < 0

  const handleOpenAdd = () => {
    setEditingActivity(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (act: Activity) => {
    setEditingActivity(act)
    setDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingActivity) return
    try {
      await deleteActivity.mutateAsync(deletingActivity.id)
      toast.success(`“${deletingActivity.title}” was deleted.`)
      setDeletingActivity(null)
    } catch {
      // Handled by deleteActivity.error in dialog
    }
  }

  return (
    <section className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold tracking-tight text-fg">Activities & Itinerary</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-soft-fg">
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Plan visits, events, and reservations within your trip dates.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={handleOpenAdd}
        >
          Add Activity
        </Button>
      </div>

      {/* Budget & Activities Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-fg-subtle">
            <span>Activities Total</span>
            <Wallet className="size-4 text-primary" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-fg">
            {formatCurrency(totalCost)}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {budgetPercent}% of {formatCurrency(trip.budget)} budget
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-fg-subtle">
            <span>Remaining Budget</span>
            <TrendingUp className={`size-4 ${isOverBudget ? 'text-danger' : 'text-emerald-500'}`} aria-hidden />
          </div>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${isOverBudget ? 'text-danger' : 'text-fg'}`}>
            {formatCurrency(remainingBudget)}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {isOverBudget ? 'Exceeds planned budget' : 'Available for extra expenses'}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-fg-subtle">
            <span>Scheduled Items</span>
            <CalendarCheck2 className="size-4 text-primary" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-fg">
            {activities.length}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {activities.length === 0 ? 'No activities booked' : 'Planned on itinerary'}
          </p>
        </div>
      </div>

      {/* Activities list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/50 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Compass className="size-6" aria-hidden />
          </div>
          <h3 className="mt-4 text-base font-semibold text-fg">No activities planned yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
            Start building your itinerary by adding museums, tours, dining reservations, or day trips.
          </p>
          <Button
            variant="secondary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={handleOpenAdd}
            className="mt-5"
          >
            Add First Activity
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onEdit={handleOpenEdit}
              onDelete={setDeletingActivity}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <ActivityDialog
        open={dialogOpen}
        trip={trip}
        activity={editingActivity}
        onClose={() => {
          setDialogOpen(false)
          setEditingActivity(null)
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingActivity)}
        title="Delete this activity?"
        description={
          deletingActivity
            ? `“${deletingActivity.title}” will be removed from this trip's itinerary.`
            : ''
        }
        confirmLabel="Delete activity"
        pending={deleteActivity.isPending}
        error={
          deleteActivity.error instanceof ApiError
            ? deleteActivity.error.message
            : deleteActivity.error
            ? 'Failed to delete activity. Please try again.'
            : null
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeletingActivity(null)
          deleteActivity.reset()
        }}
      />
    </section>
  )
}
