import type { AuthTokens } from './authTypes'

const ACCESS_KEY = 'tripmind_access_token'
const REFRESH_KEY = 'tripmind_refresh_token'

export const tokenStorage = {
  getAccessToken: (): string | null => {
    try {
      return localStorage.getItem(ACCESS_KEY)
    } catch {
      return null
    }
  },

  getRefreshToken: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },

  setTokens: (tokens: AuthTokens) => {
    try {
      localStorage.setItem(ACCESS_KEY, tokens.access_token)
      localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
    } catch {
      // ignore
    }
  },

  clearTokens: () => {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      // ignore
    }
  },
}
