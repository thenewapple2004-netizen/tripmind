export interface User {
  id: string
  email: string
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterInput {
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}
