import { CalendarPlus, Plus } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { WorkspaceProvider, useWorkspace } from '@/components/crm/Workspace'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { useFollowUpSummary } from '@/hooks/useCrm'

const TABS = [
  { to: '/customers', label: 'Customers', end: true },
  { to: '/customers/inquiries', label: 'Inquiries', end: false },
  { to: '/customers/follow-ups', label: 'Follow-ups', end: false },
] as const

function Header() {
  const workspace = useWorkspace()
  const { pathname } = useLocation()
  const summary = useFollowUpSummary()
  const attention = (summary.data?.overdue ?? 0) + (summary.data?.today ?? 0)

  const action =
    pathname.startsWith('/customers/follow-ups') ? (
      <Button variant="primary" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => workspace.newFollowUp()}>
        New follow-up
      </Button>
    ) : pathname.startsWith('/customers/inquiries') ? (
      <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => workspace.newInquiry()}>
        New inquiry
      </Button>
    ) : (
      <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={workspace.newCustomer}>
        Add customer
      </Button>
    )

  return (
    <>
      <PageHeader
        title="Customers"
        description="The people you plan trips for: who they are, what they asked, and what you owe them next."
        actions={action}
      />
      <nav aria-label="Customer workspace" className="-mb-2 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
                isActive ? 'border-primary text-fg' : 'border-transparent text-fg-muted hover:text-fg',
              )
            }
          >
            {tab.label}
            {tab.to === '/customers/follow-ups' && attention > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] leading-none font-semibold text-primary-fg tabular-nums">
                {attention}
                <span className="sr-only"> due or overdue</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

/** The Customer Workspace: one header and tab bar over Customers, Inquiries and Follow-ups. */
export function CustomerWorkspacePage() {
  return (
    <WorkspaceProvider>
      <div className="space-y-6">
        <Header />
        <Outlet />
      </div>
    </WorkspaceProvider>
  )
}
