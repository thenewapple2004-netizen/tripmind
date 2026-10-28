import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { Compass, LayoutDashboard, LogIn, LogOut, Moon, Plus, Sun, User as UserIcon } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'

export function AppShell() {
  const { theme, toggle } = useTheme()
  const { user, isAuthenticated, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const lastPathname = useRef(pathname)

  useEffect(() => {
    if (lastPathname.current === pathname) return
    lastPathname.current = pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="-ml-1 flex items-center gap-2.5 rounded-lg p-1 text-lg font-semibold tracking-tight text-fg"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm">
              <Compass className="size-5" aria-hidden />
            </span>
            TripMind
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex size-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {theme === 'dark' ? (
                <Sun className="size-5" aria-hidden />
              ) : (
                <Moon className="size-5" aria-hidden />
              )}
            </button>

            {isAuthenticated ? (
              <>
                <NavLink
                  to="/portal"
                  className={({ isActive }) =>
                    cn(
                      'hidden md:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-primary-soft text-primary-soft-fg'
                        : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                    )
                  }
                >
                  <LayoutDashboard className="size-3.5" aria-hidden />
                  Portal
                </NavLink>
                <div className="hidden sm:flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-muted">
                  <UserIcon className="size-3.5 text-primary" />
                  <span className="max-w-[150px] truncate">{user?.email}</span>
                </div>
                <ButtonLink to="/trips/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
                  New trip
                </ButtonLink>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLogout}
                  icon={<LogOut className="size-4" aria-hidden />}
                  aria-label="Log out"
                >
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <ButtonLink to="/login" variant="secondary" icon={<LogIn className="size-4" aria-hidden />}>
                  Sign in
                </ButtonLink>
                <ButtonLink to="/register" variant="primary">
                  Sign up
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10 lg:px-8"
      >
        <Outlet />
      </main>

      <ScrollRestoration />
    </div>
  )
}
