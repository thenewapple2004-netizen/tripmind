import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ApiError } from '@/api/errors'
import type { CustomerDetail, FollowUp, Inquiry, InquiryStage } from '@/api/crmTypes'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useDeleteCustomer, useDeleteInquiry } from '@/hooks/useCrm'
import { ConvertDialog } from './ConvertDialog'
import { CustomerDialog } from './CustomerDialog'
import { CustomerDrawer } from './CustomerDrawer'
import { FollowUpDialog } from './FollowUpDialog'
import { InquiryDialog } from './InquiryDialog'
import { InquiryDrawer } from './InquiryDrawer'
import { useStageMoves } from './stageMoves'

interface FollowUpTarget {
  customerId?: string
  inquiryId?: string
  /** Who it is for, shown under the dialog title when the subject is fixed. */
  subjectLabel?: string
  title?: string
}

interface WorkspaceApi {
  openCustomer: (id: string) => void
  openInquiry: (id: string) => void
  newCustomer: () => void
  editCustomer: (customer: CustomerDetail) => void
  askDeleteCustomer: (customer: { id: string; name: string }) => void
  newInquiry: (options?: { customerId?: string }) => void
  editInquiry: (inquiry: Inquiry, step?: number) => void
  askDeleteInquiry: (inquiry: Inquiry) => void
  convert: (inquiry: Inquiry) => void
  moveTo: (inquiry: Pick<Inquiry, 'id' | 'stage' | 'converted_trip_id' | 'destination'>, stage: InquiryStage) => void
  newFollowUp: (target?: FollowUpTarget) => void
  editFollowUp: (followUp: FollowUp) => void
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null)

export function useWorkspace(): WorkspaceApi {
  const api = use(WorkspaceContext)
  if (!api) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return api
}

/**
 * The one place that owns every drawer and dialog of the Customer Workspace, so the Customers, Inquiries and
 * Follow-ups tabs open exactly the same things. Which customer or inquiry is open lives in the URL
 * (`?customer=` / `?inquiry=`), so a drawer can be reloaded, shared and reached with Back.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const stageMoves = useStageMoves()
  const removeCustomer = useDeleteCustomer()
  const removeInquiry = useDeleteInquiry()

  const customerId = params.get('customer')
  const inquiryId = params.get('inquiry')

  const [customerForm, setCustomerForm] = useState<{ customer: CustomerDetail | null } | null>(null)
  const [inquiryForm, setInquiryForm] = useState<{ inquiry: Inquiry | null; customerId?: string; step: number } | null>(null)
  const [followUpForm, setFollowUpForm] = useState<{ followUp: FollowUp | null; target: FollowUpTarget } | null>(null)
  const [converting, setConverting] = useState<Inquiry | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<{ id: string; name: string } | null>(null)
  const [deletingInquiry, setDeletingInquiry] = useState<Inquiry | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const setDrawer = useCallback(
    (key: 'customer' | 'inquiry' | null, id?: string, { replace = false } = {}) => {
      setParams(
        () => {
          // Start from the live URL: the router's own copy is from the last render.
          const next = new URLSearchParams(window.location.search)
          next.delete('customer')
          next.delete('inquiry')
          if (key && id) next.set(key, id)
          return next
        },
        { replace },
      )
    },
    [setParams],
  )

  const api = useMemo<WorkspaceApi>(
    () => ({
      openCustomer: (id) => setDrawer('customer', id),
      openInquiry: (id) => setDrawer('inquiry', id),
      newCustomer: () => setCustomerForm({ customer: null }),
      editCustomer: (customer) => setCustomerForm({ customer }),
      askDeleteCustomer: (customer) => {
        setDeleteError(null)
        setDeletingCustomer(customer)
      },
      newInquiry: (options) => setInquiryForm({ inquiry: null, customerId: options?.customerId, step: 0 }),
      editInquiry: (inquiry, step = 0) => setInquiryForm({ inquiry, step }),
      askDeleteInquiry: (inquiry) => {
        setDeleteError(null)
        setDeletingInquiry(inquiry)
      },
      convert: setConverting,
      moveTo: stageMoves.moveTo,
      newFollowUp: (target = {}) => setFollowUpForm({ followUp: null, target }),
      editFollowUp: (followUp) =>
        setFollowUpForm({ followUp, target: { subjectLabel: followUp.customer.name } }),
    }),
    [setDrawer, stageMoves.moveTo],
  )

  const confirmDeleteCustomer = async () => {
    if (!deletingCustomer) return
    try {
      await removeCustomer.mutateAsync(deletingCustomer.id)
      toast.success(`${deletingCustomer.name} was deleted.`)
      setDeletingCustomer(null)
      if (customerId === deletingCustomer.id) setDrawer(null, undefined, { replace: true })
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'We couldn’t delete that customer. Please try again.')
    }
  }

  const confirmDeleteInquiry = async () => {
    if (!deletingInquiry) return
    try {
      await removeInquiry.mutateAsync(deletingInquiry.id)
      toast.success(`The ${deletingInquiry.destination} inquiry was deleted.`)
      setDeletingInquiry(null)
      if (inquiryId === deletingInquiry.id) setDrawer(null, undefined, { replace: true })
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'We couldn’t delete that inquiry. Please try again.')
    }
  }

  return (
    <WorkspaceContext value={api}>
      {children}

      <CustomerDrawer customerId={customerId} onClose={() => setDrawer(null, undefined, { replace: true })} />
      <InquiryDrawer inquiryId={inquiryId} onClose={() => setDrawer(null, undefined, { replace: true })} />

      <CustomerDialog
        open={customerForm !== null}
        customer={customerForm?.customer}
        onClose={() => setCustomerForm(null)}
        onSaved={(saved) => {
          // A newly added customer opens straight away: the next thing the owner does is usually log an inquiry.
          if (!customerForm?.customer) setDrawer('customer', saved.id)
        }}
      />
      <InquiryDialog
        open={inquiryForm !== null}
        inquiry={inquiryForm?.inquiry}
        customerId={inquiryForm?.customerId}
        initialStep={inquiryForm?.step}
        onClose={() => setInquiryForm(null)}
        onSaved={(saved) => {
          if (!inquiryForm?.inquiry) setDrawer('inquiry', saved.id)
        }}
      />
      <FollowUpDialog
        open={followUpForm !== null}
        followUp={followUpForm?.followUp}
        customerId={followUpForm?.target.customerId}
        inquiryId={followUpForm?.target.inquiryId}
        subjectLabel={followUpForm?.target.subjectLabel}
        initialTitle={followUpForm?.target.title}
        onClose={() => setFollowUpForm(null)}
      />
      <ConvertDialog open={converting !== null} inquiry={converting} onClose={() => setConverting(null)} />
      {stageMoves.element}

      <ConfirmDialog
        open={deletingCustomer !== null}
        title={`Delete ${deletingCustomer?.name ?? 'this customer'}?`}
        description="Their inquiries, follow-ups and history are deleted with them. Trips already made for them are kept, but no longer linked to anyone. This can’t be undone."
        confirmLabel="Delete customer"
        pending={removeCustomer.isPending}
        error={deleteError}
        onConfirm={() => void confirmDeleteCustomer()}
        onCancel={() => setDeletingCustomer(null)}
      />
      <ConfirmDialog
        open={deletingInquiry !== null}
        title="Delete this inquiry?"
        description={`The ${deletingInquiry?.destination ?? ''} inquiry and its follow-ups are deleted. It stays mentioned in ${deletingInquiry?.customer.name ?? 'the customer'}’s history. This can’t be undone.`}
        confirmLabel="Delete inquiry"
        pending={removeInquiry.isPending}
        error={deleteError}
        onConfirm={() => void confirmDeleteInquiry()}
        onCancel={() => setDeletingInquiry(null)}
      />
    </WorkspaceContext>
  )
}
