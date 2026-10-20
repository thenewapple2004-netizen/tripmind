import { ApiError } from './errors'

/** Relative on purpose: the Vite dev server proxies /api to the Trip Service. */
const BASE_URL = '/api/v1'
const TIMEOUT_MS = 10_000

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Abort signal from TanStack Query so cancelled queries stop their request. */
  signal?: AbortSignal
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combined,
    })
  } catch (error) {
    if (signal?.aborted) throw error // cancelled by the caller; not a failure
    throw timeout.aborted ? ApiError.timeout() : ApiError.network()
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null)
    throw ApiError.fromResponse(response.status, errorBody)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
