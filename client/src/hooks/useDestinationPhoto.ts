import { useQuery } from '@tanstack/react-query'

interface WikiSearchResponse {
  query?: { pages?: Record<string, { index?: number; thumbnail?: { source: string } }> }
}

// ─── Persistent cache ───────────────────────────────────────────────────────
// Photos rarely change and Wikipedia rate-limits busy pages, so answers (including "no photo")
// are remembered on this device.

const STORAGE_PREFIX = 'tripmind-photo:'
const FOUND_TTL = 30 * 24 * 60 * 60 * 1000
const NOT_FOUND_TTL = 3 * 24 * 60 * 60 * 1000

interface Stored {
  url: string | null
  at: number
}

function readStored(key: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return undefined
    const { url, at } = JSON.parse(raw) as Stored
    if (Date.now() - at > (url ? FOUND_TTL : NOT_FOUND_TTL)) return undefined
    return url
  } catch {
    return undefined
  }
}

function writeStored(key: string, url: string | null) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ url, at: Date.now() } satisfies Stored))
  } catch {
    // Storage full or blocked: we'll just look it up again next time.
  }
}

// ─── Throttle ───────────────────────────────────────────────────────────────
// A page with a couple of dozen trips would otherwise fire them all at once.

const MAX_CONCURRENT = 3
const GAP_MS = 120
let active = 0
const waiting: Array<() => void> = []

async function throttled<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve))
  active++
  try {
    return await task()
  } finally {
    await new Promise((resolve) => setTimeout(resolve, GAP_MS))
    active--
    waiting.shift()?.()
  }
}

/**
 * Looks up a travel photo for a destination from Wikipedia's page images (free, no key).
 * Resolves to `null` when Wikipedia has no picture. Rate limiting and network problems throw
 * instead, so React Query retries with a delay rather than remembering a false "no photo".
 * Callers fall back to a gradient cover either way, so the UI never depends on this call.
 */
async function fetchDestinationPhoto(key: string, destination: string, signal?: AbortSignal): Promise<string | null> {
  const stored = readStored(key)
  if (stored !== undefined) return stored

  const url =
    'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1' +
    `&gsrsearch=${encodeURIComponent(destination)}&prop=pageimages&piprop=thumbnail&pithumbsize=900` +
    '&format=json&origin=*'

  const res = await throttled(() => fetch(url, { signal }))
  if (res.status === 429 || res.status >= 500) throw new Error(`Photo service busy (${res.status})`)
  if (!res.ok) {
    writeStored(key, null)
    return null
  }
  const data = (await res.json()) as WikiSearchResponse
  const photo = Object.values(data.query?.pages ?? {})[0]?.thumbnail?.source ?? null
  writeStored(key, photo)
  return photo
}

export function useDestinationPhoto(destination: string | undefined) {
  const key = destination?.trim().toLowerCase() ?? ''
  return useQuery({
    queryKey: ['destination-photo', key],
    queryFn: ({ signal }) => fetchDestinationPhoto(key, destination!.trim(), signal),
    enabled: key.length > 1,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(30_000, 2000 * 2 ** attempt),
  })
}
