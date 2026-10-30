import { useState } from 'react'
import { Link } from 'react-router'
import { Archive, ArchiveRestore, ArrowUpRight, CalendarPlus, LoaderCircle, Mail, MapPin, MessageSquarePlus, Pencil, Phone, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { CustomerDetail } from '@/api/crmTypes'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { TextAreaField } from '@/components/ui/FormFields'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { TabPanel, Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { useAddNote, useCustomer, useCustomerEvents, useUpdateCustomer } from '@/hooks/useCrm'
import { useToday } from '@/hooks/useToday'
import { CONTACT_LABEL, budgetLabel, datesLabel, groupLabel, initials, mailHref, telHref } from '@/lib/crm'
import { formatDate, formatDateRange, pluralize } from '@/lib/trips'
import { formatMoneyIn } from '@/lib/money'
import { FollowUpRow } from './FollowUpRow'
import { StageBadge } from './StageBadge'
import { Timeline } from './Timeline'
import { Fact, Nothing } from './bits'
import { useWorkspace } from './Workspace'

type Tab = 'overview' | 'inquiries' | 'trips' | 'follow-ups' | 'activity'

const rowButton =
  'flex w-full flex-col gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2'

function ActivityTab({ customerId }: { customerId: string }) {
  const toast = useToast()
  const events = useCustomerEvents(customerId)
  const addNote = useAddNote()
  const [note, setNote] = useState('')
  const items = events.data?.pages.flatMap((p) => p.items) ?? []

  const submit = async () => {
    const summary = note.trim()
    if (!summary) return
    try {
      await addNote.mutateAsync({ customerId, summary })
      setNote('')
      toast.success('Note added')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'We couldn’t save that note.')
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-2"
      >
        <TextAreaField label="Log a note" rows={2} maxLength={600} placeholder="A call, a message, something they said…" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" size="sm" loading={addNote.isPending} disabled={!note.trim()} icon={<MessageSquarePlus className="size-4" aria-hidden />}>
          Add to history
        </Button>
      </form>

      {events.isPending ? (
        <div role="status" aria-label="Loading history" className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : events.isError ? (
        <p role="alert" className="text-sm text-danger">We couldn’t load the history. {events.error.message}</p>
      ) : items.length === 0 ? (
        <Nothing>Nothing recorded yet.</Nothing>
      ) : (
        <>
          <Timeline events={items} />
          {events.hasNextPage && (
            <Button size="sm" variant="ghost" onClick={() => void events.fetchNextPage()} loading={events.isFetchingNextPage}>
              Show older
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function Body({ customer }: { customer: CustomerDetail }) {
  const workspace = useWorkspace()
  const today = useToday()
  const [tab, setTab] = useState<Tab>('overview')

  const openFollowUps = customer.follow_ups.filter((f) => !f.is_completed)
  const doneFollowUps = customer.follow_ups.filter((f) => f.is_completed)
  const place = [customer.city, customer.country].filter(Boolean).join(', ')

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section aria-label="Contact" className="space-y-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {customer.phone && (
            <a href={telHref(customer.phone)} className="inline-flex items-center gap-1.5 text-fg hover:text-primary-ink">
              <Phone className="size-4 text-fg-subtle" aria-hidden />
              {customer.phone}
            </a>
          )}
          {customer.email && (
            <a href={mailHref(customer.email)} className="inline-flex min-w-0 items-center gap-1.5 text-fg hover:text-primary-ink">
              <Mail className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              <span className="truncate">{customer.email}</span>
            </a>
          )}
          {place && (
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <MapPin className="size-4 text-fg-subtle" aria-hidden />
              {place}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => workspace.newInquiry({ customerId: customer.id })} disabled={customer.is_archived}>
            New inquiry
          </Button>
          <Button size="sm" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => workspace.newFollowUp({ customerId: customer.id, subjectLabel: customer.name })}>
            Follow-up
          </Button>
        </div>
        {customer.is_archived && <p className="text-sm text-fg-muted">Archived. Restore this customer to add new inquiries.</p>}
      </section>

      <div className="px-4 pt-3 sm:px-5">
        <Tabs
          label="Customer sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'inquiries', label: 'Inquiries', count: customer.inquiries.length },
            { id: 'trips', label: 'Trips', count: customer.trips.length },
            { id: 'follow-ups', label: 'Follow-ups', count: openFollowUps.length },
            { id: 'activity', label: 'Activity' },
          ]}
        >
          <div className="py-5">
            {tab === 'overview' && (
              <TabPanel id="overview" className="space-y-5">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                  <Fact label="Prefers">{CONTACT_LABEL[customer.preferred_contact]}</Fact>
                  <Fact label="Customer since">{formatDate(customer.created_at.slice(0, 10))}</Fact>
                </dl>
                <div>
                  <h3 className="mb-1 text-xs font-medium text-fg-subtle">Travel preferences</h3>
                  {customer.preferences ? <p className="text-sm whitespace-pre-line text-fg">{customer.preferences}</p> : <p className="text-sm text-fg-subtle">None recorded.</p>}
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-medium text-fg-subtle">Private notes</h3>
                  {customer.notes ? <p className="text-sm whitespace-pre-line text-fg">{customer.notes}</p> : <p className="text-sm text-fg-subtle">None.</p>}
                </div>
              </TabPanel>
            )}

            {tab === 'inquiries' && (
              <TabPanel id="inquiries" className="space-y-2.5">
                {customer.inquiries.length === 0 ? (
                  <Nothing>No inquiries yet. Add one when {customer.name.split(' ')[0]} asks about a trip.</Nothing>
                ) : (
                  customer.inquiries.map((i) => (
                    <button key={i.id} type="button" onClick={() => workspace.openInquiry(i.id)} className={rowButton}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 font-medium break-words text-fg">{i.destination}</span>
                        <StageBadge stage={i.stage} />
                      </span>
                      <span className="text-sm text-fg-muted">
                        {datesLabel(i)} · {groupLabel(i)}
                        {budgetLabel(i) && ` · ${budgetLabel(i)}`}
                      </span>
                    </button>
                  ))
                )}
              </TabPanel>
            )}

            {tab === 'trips' && (
              <TabPanel id="trips" className="space-y-6">
                {customer.trips.length === 0 ? (
                  <Nothing>No trips yet. A trip appears here when you convert one of their confirmed inquiries.</Nothing>
                ) : (
                  <>
                    <ul className="space-y-2.5">
                      {customer.trips.map((t) => (
                        <li key={t.id}>
                          <Link to={`/trips/${t.id}`} className={rowButton}>
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0 font-medium break-words text-fg">{t.title}</span>
                              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
                            </span>
                            <span className="text-sm text-fg-muted">
                              {t.destination} · {formatDateRange(t.start_date, t.end_date)} · {pluralize(t.booking_count, 'booking')}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-fg">Bookings</h3>
                      {customer.bookings.length === 0 ? (
                        <p className="text-sm text-fg-subtle">No bookings on these trips yet.</p>
                      ) : (
                        <ul className="divide-y divide-line">
                          {customer.bookings.map((b) => (
                            <li key={b.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                              <div className="min-w-0">
                                <p className="font-medium break-words text-fg">{b.title}</p>
                                <p className="text-fg-muted">
                                  <span className="capitalize">{b.type}</span> · {b.status} · {formatDate(b.start_date)} · {b.trip_title}
                                </p>
                              </div>
                              <span className="shrink-0 text-fg tabular-nums">{formatMoneyIn(b.total_cost, b.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </TabPanel>
            )}

            {tab === 'follow-ups' && (
              <TabPanel id="follow-ups" className="space-y-4">
                {customer.follow_ups.length === 0 ? (
                  <Nothing>No follow-ups for {customer.name.split(' ')[0]}.</Nothing>
                ) : (
                  <>
                    {openFollowUps.length > 0 && (
                      <ul className="divide-y divide-line">
                        {openFollowUps.map((f) => (
                          <FollowUpRow key={f.id} followUp={f} today={today} context="inquiry" />
                        ))}
                      </ul>
                    )}
                    {doneFollowUps.length > 0 && (
                      <div>
                        <h3 className="mb-1 text-xs font-medium text-fg-subtle">Done</h3>
                        <ul className="divide-y divide-line">
                          {doneFollowUps.map((f) => (
                            <FollowUpRow key={f.id} followUp={f} today={today} context="inquiry" />
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </TabPanel>
            )}

            {tab === 'activity' && (
              <TabPanel id="activity">
                <ActivityTab customerId={customer.id} />
              </TabPanel>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  )
}

export function CustomerDrawer({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const workspace = useWorkspace()
  const toast = useToast()
  const query = useCustomer(customerId)
  const update = useUpdateCustomer()
  const customer = query.data

  const toggleArchive = async () => {
    if (!customer) return
    try {
      await update.mutateAsync({ id: customer.id, patch: { is_archived: !customer.is_archived } })
      toast.success(customer.is_archived ? `${customer.name} restored` : `${customer.name} archived`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'We couldn’t change that. Please try again.')
    }
  }

  const iconButton = 'flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg'

  return (
    <Drawer
      open={Boolean(customerId)}
      onClose={onClose}
      backLabel="Back to customers"
      title={
        <span className="flex items-center gap-3">
          {customer && <Avatar initials={initials(customer.name)} className="size-9 text-xs" />}
          <span className="min-w-0">{customer?.name ?? 'Customer'}</span>
        </span>
      }
      eyebrow={customer?.is_archived ? <span className="rounded bg-neutral-soft px-1.5 py-0.5 text-neutral-soft-fg">Archived</span> : undefined}
      actions={
        customer && (
          <>
            <button type="button" onClick={() => workspace.editCustomer(customer)} aria-label="Edit customer" className={iconButton}>
              <Pencil className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => void toggleArchive()} disabled={update.isPending} aria-label={customer.is_archived ? 'Restore customer' : 'Archive customer'} title={customer.is_archived ? 'Restore' : 'Archive'} className={iconButton}>
              {update.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : customer.is_archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
            </button>
            <button type="button" onClick={() => workspace.askDeleteCustomer(customer)} aria-label="Delete customer" className={`${iconButton} hover:bg-danger-soft hover:text-danger`}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          </>
        )
      }
    >
      {query.isPending ? (
        <div className="space-y-4 p-5" role="status" aria-label="Loading customer">
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
          <Skeleton className="h-40" />
        </div>
      ) : query.isError || !customer ? (
        <div className="p-5">
          <StateCard
            icon={TriangleAlert}
            tone="danger"
            title={query.error instanceof ApiError && query.error.isNotFound ? 'Customer not found' : 'We couldn’t load this customer'}
            description={query.error instanceof ApiError && query.error.isNotFound ? 'They may have been deleted. Check the link or go back to your customers.' : (query.error?.message ?? 'Please try again.')}
          >
            <Button onClick={onClose}>Close</Button>
          </StateCard>
        </div>
      ) : (
        <Body customer={customer} />
      )}
    </Drawer>
  )
}
