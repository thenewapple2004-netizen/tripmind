import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'tripmind-sidebar-collapsed'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applySidebarCollapsed(next: boolean) {
  if (read() === next) return
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    // Storage blocked: the choice just won't persist.
  }
  listeners.forEach((listener) => listener())
}

/** Whether the desktop sidebar is collapsed to icons, shared by every component that shows it. */
export function useSidebarCollapsedValue(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}
