import {
  CalendarDays,
  LayoutDashboard,
  Luggage,
  Receipt,
  FileSpreadsheet,
  FolderLock,
  Sparkles,
  Ticket,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Extra path prefixes that should also highlight this item (e.g. trip detail pages). */
  matchPrefixes?: string[]
  /** Short pill shown beside the label for features that aren't built yet. */
  badge?: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/portal', label: 'Overview', icon: LayoutDashboard },
  { to: '/', label: 'My Trips', icon: Luggage, matchPrefixes: ['/trips'] },
  { to: '/itinerary', label: 'Itinerary', icon: CalendarDays },
  { to: '/bookings', label: 'Bookings', icon: Ticket },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { to: '/documents', label: 'Documents', icon: FolderLock },
  { to: '/planner', label: 'AI Planner', icon: Sparkles, badge: 'Soon' },
]

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') {
    return pathname === '/' || (item.matchPrefixes ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
