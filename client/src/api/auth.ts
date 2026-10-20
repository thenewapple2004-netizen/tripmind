import { request } from './http'
import { tokenStorage } from './tokenStorage'
import type { AuthTokens, LoginInput, RegisterInput, User } from './authTypes'

export const authApi = {
  register: async (input: RegisterInput): Promise<User> => {
    return request<User>('/auth/register', {
      method: 'POST',
      body: input,
      skipAuth: true,
    })
  },

  login: async (input: LoginInput): Promise<AuthTokens> => {
    const tokens = await request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: input,
      skipAuth: true,
    })
    tokenStorage.setTokens(tokens)
    return tokens
  },

  getMe: async (token?: string, signal?: AbortSignal): Promise<User> => {
    return request<User>('/auth/me', {
      signal,
      token,
    })
  },

  refresh: async (): Promise<AuthTokens> => {
    const refreshToken = tokenStorage.getRefreshToken()
    if (!refreshToken) throw new Error('No refresh token available')
    const tokens = await request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      skipAuth: true,
    })
    tokenStorage.setTokens(tokens)
    return tokens
  },

  logout: () => {
    tokenStorage.clearTokens()
  },
}
