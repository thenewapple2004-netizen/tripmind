import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi } from '@/api/auth'
import { tokenStorage } from '@/api/tokenStorage'
import type { LoginInput, RegisterInput, User } from '@/api/authTypes'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = tokenStorage.getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    authApi
      .getMe()
      .then((currentUser) => {
        if (isMounted) setUser(currentUser)
      })
      .catch(() => {
        if (isMounted) {
          tokenStorage.clearTokens()
          setUser(null)
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (input: LoginInput) => {
    const tokens = await authApi.login(input)
    const currentUser = await authApi.getMe(tokens.access_token)
    setUser(currentUser)
  }

  const register = async (input: RegisterInput) => {
    return authApi.register(input)
  }

  const logout = () => {
    authApi.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
