import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlatformAdmin } from '../types/admin'

interface AdminAuthState {
  admin: PlatformAdmin | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (admin: PlatformAdmin, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      admin: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (admin, accessToken, refreshToken) =>
        set({ admin, accessToken, refreshToken, isAuthenticated: true }),
      clearAuth: () =>
        set({ admin: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    { name: 'admin-auth-storage' }
  )
)
