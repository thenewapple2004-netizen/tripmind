import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { RightRail } from '@/components/layout/RightRail'
import { MobileDrawer, SidebarContent } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/components/ui/cn'
import { useAppearance } from '@/hooks/useAppearance'
import { useAuth } from '@/hooks/useAuth'
import { useProfileSync } from '@/hooks/useProfileSync'

function PortalShell() {
  const { pathname } = useLocation()
  const { collapsed, toggleCollapsed } = useAppearance()
  const currency = useProfileSync()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const mainRef = useRef<HTMLElement>(null)
  const lastPathname = useRef(pathname)

  useEffect(() => {
    if (lastPathname.current === pathname) return
    lastPathname.current = pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  // The calendar rail belongs to the Overview only; other pages get the full width.
  const hasRail = pathname === '/portal'

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only z-[60] rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside
        aria-label="Sidebar"
        className={cn(
          'sticky top-0 z-40 hidden h-dvh shrink-0 border-r border-line bg-sidebar transition-[width] duration-300 lg:block',
          collapsed ? 'w-[5.25rem]' : 'w-64',
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

      <div className="min-w-0 flex-1">
        <TopBar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onOpenDrawer={() => setDrawerOpen(true)} />
        <div
          className={cn(
            'mx-auto grid w-full max-w-[1600px] items-start gap-6 px-4 pt-6 pb-12 sm:px-6 lg:px-8',
            hasRail && 'xl:grid-cols-[minmax(0,1fr)_21.5rem]',
          )}
        >
          <main key={currency} id="main" ref={mainRef} tabIndex={-1} className="@container min-w-0 outline-none">
            <Outlet />
          </main>
          {hasRail && (
            <RightRail
              className="xl:sticky xl:top-22 xl:max-h-[calc(100dvh-6.5rem)] xl:overflow-y-auto xl:pr-1"
            />
          )}
        </div>
      </div>
      <ScrollRestoration />
    </div>
  )
}

export function AppShell() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  return isAuthenticated ? <PortalShell /> : <AuthLayout />
}
