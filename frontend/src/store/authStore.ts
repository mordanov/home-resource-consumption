import { create } from 'zustand'
import { registerTokenHandlers } from '../lib/tokenRegistry'

export interface UserRead {
  id: string
  username: string
  email: string
  created_at: string
}

interface AuthState {
  accessToken: string | null
  user: UserRead | null
  setTokens: (token: string, user: UserRead) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setTokens: (token, user) => set({ accessToken: token, user }),
  setAccessToken: (token) => set({ accessToken: token }),
  clearAuth: () => set({ accessToken: null, user: null }),
}))

// Register handlers with tokenRegistry so axios.ts can read/write tokens
// without creating a circular import.
registerTokenHandlers(
  () => useAuthStore.getState().accessToken,
  (token) => useAuthStore.getState().setAccessToken(token),
  () => useAuthStore.getState().clearAuth(),
)
