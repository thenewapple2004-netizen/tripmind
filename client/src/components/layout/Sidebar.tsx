import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { LogOut, Moon, Settings, Sun, UserRound, X, type LucideIcon } from 'lucide-react'
import { LogoMark, Wordmark } from '@/components/ui/Logo'
import { cn } from '@/components/ui/cn'
import { useAuth } from '@/hooks/useAuth'
import { useAppearance } from '@/hooks/useAppearance'
import { isDarkTheme, quickSwitchLabel } from '@/lib/theme'
import { NAV_ITEMS, isNavActive } from './nav'

const rowBase =
  'group/item relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors'

/** Tooltip that only appears for the icon-only (collapsed) sidebar. */
function Tip({ label, show }: { label: string; show: boolean }) {
  if (!show) return null
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full z-50 ml-3 hidden rounded-lg bg-surface-3 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-fg opacity-0 shadow-lift transition group-hover/item:opacity-100 lg:block"
    >
      {label}
    </span>
  )
}

function Row({
  icon: Icon,
  label,
  collapsed,
  trailing,
}: {
  icon: LucideIcon
  label: string
  collapsed: boolean
  trailing?: React.ReactNode
}) {
  return (
    <>
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className={cn('flex-1 truncate text-left', collapsed && 'sr-only')}>{label}</span>
      {!collapsed && trailing}
      <Tip label={label} show={collapsed} />
    </>
  )
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useAppearance()
  const dark = isDarkTheme(theme)
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    onNavigate?.()
    navigate('/login')
  }

  const linkClass = (active: boolean) =>
    cn(
      rowBase,
      active
        ? 'bg-primary-soft font-semibold text-primary-soft-fg before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
        : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
      collapsed && 'justify-center px-0',
    )

  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Link
        to="/portal"
        onClick={onNavigate}
        aria-label="TripMind overview"
        className={cn('flex items-center gap-3 rounded-lg px-1.5', collapsed && 'justify-center px-0')}
      >
        <LogoMark />
        {!collapsed && <Wordmark />}
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, pathname)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={linkClass(active)}
            >
              <Row
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                trailing={
                  item.badge && (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary-soft-fg uppercase">
                      {item.badge}
                    </span>
                  )
                }
              />
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-1.5 border-t border-line pt-4">
        <Link
          to="/profile"
          onClick={onNavigate}
          aria-current={pathname === '/profile' ? 'page' : undefined}
          className={linkClass(pathname === '/profile')}
        >
          <Row icon={UserRound} label="Profile" collapsed={collapsed} />
        </Link>

        <Link
          to="/settings"
          onClick={onNavigate}
          aria-current={pathname === '/settings' ? 'page' : undefined}
          className={linkClass(pathname === '/settings')}
        >
          <Row icon={Settings} label="Settings" collapsed={collapsed} />
        </Link>

        <button
          type="button"
          role="switch"
          aria-checked={dark}
          onClick={toggleTheme}
          className={cn(rowBase, 'text-fg-muted hover:bg-surface-2 hover:text-fg', collapsed && 'justify-center px-0')}
        >
          <Row
            icon={dark ? Moon : Sun}
            label={quickSwitchLabel(theme)}
            collapsed={collapsed}
            trailing={
              <span
                aria-hidden
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  dark ? 'bg-primary' : 'bg-line-strong',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
                    dark && 'translate-x-4 bg-primary-fg',
                  )}
                />
              </span>
            }
          />
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className={cn(rowBase, 'text-fg-muted hover:bg-danger-soft hover:text-danger-soft-fg', collapsed && 'justify-center px-0')}
        >
          <Row icon={LogOut} label="Log out" collapsed={collapsed} />
        </button>
      </div>
    </div>
  )
}

/** Slide-in navigation for small screens. Closes on Escape, backdrop click and route change. */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstPath = useRef(pathname)

  useEffect(() => {
    if (pathname !== firstPath.current) {
      firstPath.current = pathname
      onClose()
    }
  }, [pathname, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-drawer-in overflow-y-auto border-r border-line bg-sidebar shadow-pop"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute top-5 right-3 flex size-9 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-5" aria-hidden />
        </button>
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  )
}
