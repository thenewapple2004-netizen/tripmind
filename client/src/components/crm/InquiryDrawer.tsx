import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, CalendarPlus, CircleCheck, Mail, Pencil, Phone, PlaneTakeoff, Trash2, TriangleAlert } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { InquiryStage } from '@/api/crmTypes'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Skeleton'
import { StateCard } from '@/components/ui/StateCard'
import { TabPanel, Tabs } from '@/components/ui/Tabs'
import { useInquiry } from '@/hooks/useCrm'
import { useToday } from '@/hooks/useToday'
import { STAGE_LABEL, ago, exactTime, mailHref, telHref } from '@/lib/crm'
import { formatDateRange } from '@/lib/trips'
import { BriefSummary } from './BriefSummary'
import { FollowUpRow } from './FollowUpRow'
import { StageBadge } from './StageBadge'
import { Timeline } from './Timeline'
import { Nothing } from './bits'
import { useWorkspace } from './Workspace'

type Tab = 'brief' | 'follow-ups' | 'history'

const moveLabel = (stage: InquiryStage) => (stage === 'closed_lost' ? 'Close as lost' : STAGE_LABEL[stage])

export function InquiryDrawer({ inquiryId, onClose }: { inquiryId: string | null; onClose: () => void }) {
  const workspace = useWorkspace()
  const today = useToday()
  const query = useInquiry(inquiryId)
  const inquiry = query.data
  const [tab, setTab] = useState<Tab>('brief')

  const openFollowUps = inquiry?.follow_ups.filter((f) => !f.is_completed) ?? []
  const doneFollowUps = inquiry?.follow_ups.filter((f) => f.is_completed) ?? []

  return (
    <Drawer
      open={Boolean(inquiryId)}
      onClose={onClose}
      backLabel="Back to inquiries"
      title={inquiry?.destination ?? 'Inquiry'}
      eyebrow={
        inquiry && (
          <button type="button" onClick={() => workspace.openCustomer(inquiry.customer.id)} className="font-medium text-primary-ink hover:underline">
            {inquiry.customer.name}
          </button>
        )
      }
      actions={
        inquiry && (
          <>
            <button
              type="button"
              onClick={() => workspace.editInquiry(inquiry)}
              aria-label="Edit inquiry"
              className="flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => workspace.askDeleteInquiry(inquiry)}
              disabled={Boolean(inquiry.converted_trip_id)}
              aria-label="Delete inquiry"
              title={inquiry.converted_trip_id ? 'An inquiry that became a trip is kept as its record' : undefined}
              className="flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </>
        )
      }
    >
      {query.isPending ? (
        <div className="space-y-4 p-5" role="status" aria-label="Loading inquiry">
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
          <Skeleton className="h-40" />
        </div>
      ) : query.isError || !inquiry ? (
        <div className="p-5">
          <StateCard
            icon={TriangleAlert}
            tone="danger"
            title={query.error instanceof ApiError && query.error.isNotFound ? 'Inquiry not found' : 'We couldn’t load this inquiry'}
            description={query.error instanceof ApiError && query.error.isNotFound ? 'It may have been deleted. Check the link or go back to your inquiries.' : (query.error?.message ?? 'Please try again.')}
          >
            <Button onClick={onClose}>Close</Button>
          </StateCard>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Where it stands, and what can happen next */}
          <section aria-label="Stage" className="space-y-3 border-b border-line px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StageBadge stage={inquiry.stage} />
              <span className="text-xs text-fg-subtle" title={exactTime(inquiry.stage_changed_at)}>
                since {ago(inquiry.stage_changed_at)}
              </span>
            </div>

            {inquiry.stage === 'closed_lost' && inquiry.closed_reason && (
              <p className="text-sm text-fg-muted">Reason: {inquiry.closed_reason}</p>
            )}

            {inquiry.converted_trip_id ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-primary-line/60 bg-primary-soft p-3 text-sm text-primary-soft-fg">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="min-w-0">
                  Converted to a trip{inquiry.converted_at ? ` ${ago(inquiry.converted_at)}` : ''}.{' '}
                  <Link to={`/trips/${inquiry.converted_trip_id}`} className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2">
                    Open the trip
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </p>
              </div>
            ) : (
              <>
                {inquiry.stage === 'confirmed' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/60 p-3">
                    <p className="min-w-0 flex-1 basis-48 text-sm text-fg-muted">The customer has said yes. Turn this into a trip you can plan and book.</p>
                    <Button variant="primary" size="sm" icon={<PlaneTakeoff className="size-4" aria-hidden />} onClick={() => workspace.convert(inquiry)}>
                      Create trip
                    </Button>
                  </div>
                )}
                {inquiry.allowed_stages.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-fg-subtle">Move to</p>
                    <div className="flex flex-wrap gap-2">
                      {inquiry.allowed_stages.map((stage) => (
                        <Button key={stage} size="sm" variant={stage === 'closed_lost' ? 'danger-outline' : 'secondary'} onClick={() => workspace.moveTo(inquiry, stage)}>
                          {moveLabel(stage)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Who to contact. Details come straight from the customer's record. */}
          <section aria-label="Customer" className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-line px-4 py-3 text-sm sm:px-5">
            {inquiry.customer_phone && (
              <a href={telHref(inquiry.customer_phone)} className="inline-flex items-center gap-1.5 text-fg hover:text-primary-ink">
                <Phone className="size-4 text-fg-subtle" aria-hidden />
                {inquiry.customer_phone}
              </a>
            )}
            {inquiry.customer_email && (
              <a href={mailHref(inquiry.customer_email)} className="inline-flex min-w-0 items-center gap-1.5 text-fg hover:text-primary-ink">
                <Mail className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                <span className="truncate">{inquiry.customer_email}</span>
              </a>
            )}
          </section>

          <div className="px-4 pt-3 sm:px-5">
            <Tabs
              label="Inquiry sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'brief', label: 'Travel brief' },
                { id: 'follow-ups', label: 'Follow-ups', count: openFollowUps.length },
                { id: 'history', label: 'History', count: inquiry.events.length },
              ]}
            >
              <div className="py-5">
                {tab === 'brief' && (
                  <TabPanel id="brief" className="space-y-5">
                    <BriefSummary inquiry={inquiry} />
                    {inquiry.notes && (
                      <div>
                        <h3 className="mb-1 text-xs font-medium text-fg-subtle">Your notes</h3>
                        <p className="text-sm whitespace-pre-line text-fg">{inquiry.notes}</p>
                      </div>
                    )}
                    <Button size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => workspace.editInquiry(inquiry)}>
                      Edit travel brief
                    </Button>
                  </TabPanel>
                )}

                {tab === 'follow-ups' && (
                  <TabPanel id="follow-ups" className="space-y-4">
                    {inquiry.follow_ups.length === 0 ? (
                      <Nothing>No follow-ups for this inquiry yet.</Nothing>
                    ) : (
                      <>
                        {openFollowUps.length > 0 && (
                          <ul className="divide-y divide-line">
                            {openFollowUps.map((f) => (
                              <FollowUpRow key={f.id} followUp={f} today={today} context="none" />
                            ))}
                          </ul>
                        )}
                        {doneFollowUps.length > 0 && (
                          <div>
                            <h3 className="mb-1 text-xs font-medium text-fg-subtle">Done</h3>
                            <ul className="divide-y divide-line">
                              {doneFollowUps.map((f) => (
                                <FollowUpRow key={f.id} followUp={f} today={today} context="none" />
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                    <Button
                      size="sm"
                      icon={<CalendarPlus className="size-4" aria-hidden />}
                      onClick={() =>
                        workspace.newFollowUp({ inquiryId: inquiry.id, subjectLabel: `${inquiry.customer.name} · ${inquiry.destination}` })
                      }
                    >
                      Add follow-up
                    </Button>
                  </TabPanel>
                )}

                {tab === 'history' && (
                  <TabPanel id="history">
                    {inquiry.events.length === 0 ? <Nothing>Nothing recorded yet.</Nothing> : <Timeline events={inquiry.events} />}
                    {inquiry.date_from && inquiry.date_to && (
                      <p className="sr-only">Trip dates {formatDateRange(inquiry.date_from, inquiry.date_to)}</p>
                    )}
                  </TabPanel>
                )}
              </div>
            </Tabs>
          </div>
        </div>
      )}
    </Drawer>
  )
}
