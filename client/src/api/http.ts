import { ApiError } from './errors'
import { tokenStorage } from './tokenStorage'
import type { AuthTokens } from './authTypes'

/** Relative on purpose: Vite proxies /api/v1/auth to Auth Service and /api/v1/trips to Trip Service. */
const BASE_URL = '/api/v1'
const TIMEOUT_MS = 10_000

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Skip attaching the Bearer token even if one is stored. */
  skipAuth?: boolean
  /** Provide an explicit Bearer token instead of reading from storage. */
  token?: string
}

let isRefreshing = false
let refreshSubscribers: Array<(token: string | null) => void> = []

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb)
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      tokenStorage.clearTokens()
      return null
    }

    const data = (await res.json()) as AuthTokens
    tokenStorage.setTokens(data)
    return data.access_token
  } catch {
    tokenStorage.clearTokens()
    return null
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, skipAuth = false, token: explicitToken } = options
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  const token = explicitToken ?? (!skipAuth ? tokenStorage.getAccessToken() : null)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combined,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw timeout.aborted ? ApiError.timeout() : ApiError.network()
  }

  // Handle 401 Unauthorized by attempting a token refresh
  if (response.status === 401 && !skipAuth && !path.startsWith('/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true
      const newToken = await refreshAccessToken()
      isRefreshing = false
      onRefreshed(newToken)

      if (newToken) {
        return request<T>(path, { ...options, skipAuth: false })
      }
    } else {
      // Wait for concurrent refresh to complete
      const retryToken = await new Promise<string | null>((resolve) => {
        subscribeTokenRefresh(resolve)
      })
      if (retryToken) {
        return request<T>(path, { ...options, skipAuth: false })
      }
    }
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null)
    throw ApiError.fromResponse(response.status, errorBody)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
