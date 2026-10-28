import { Link } from 'react-router'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { QuickAddMenu } from '@/components/portal/QuickAdd'
import { Avatar } from '@/components/ui/Avatar'
import { LogoMark, Wordmark } from '@/components/ui/Logo'
import { useIdentity } from '@/hooks/useProfile'

const iconButton =
  'flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted transition hover:border-line-strong hover:bg-surface-2 hover:text-fg'

export function TopBar({
  collapsed,
  onToggleCollapsed,
  onOpenDrawer,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenDrawer: () => void
}) {
  const { name, initials, avatarUrl } = useIdentity()

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpenDrawer} aria-label="Open navigation" className={`${iconButton} lg:hidden`}>
            <Menu className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className={`${iconButton} hidden lg:flex`}
          >
            {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
          </button>
          <Link to="/portal" className="flex items-center gap-2.5 lg:hidden" aria-label="TripMind overview">
            <LogoMark className="size-9 rounded-xl" />
            <Wordmark className="text-lg" />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <QuickAddMenu />
          <Link to="/profile" aria-label={`${name} — your profile`} className="rounded-full">
            <Avatar initials={initials} src={avatarUrl} className="size-10" />
          </Link>
        </div>
      </div>
    </header>
  )
}
