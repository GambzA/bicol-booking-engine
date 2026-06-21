import api from './client'
import type { AuthResponse } from '../types/auth'

export const authApi = {
  register: (data: { hotel_name: string; email: string; full_name: string; password: string }) =>
    api.post<AuthResponse>('/api/v1/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/api/v1/auth/login', data),

  refresh: (refresh_token: string) =>
    api.post<AuthResponse>('/api/v1/auth/refresh', { refresh_token }),

  logout: (refresh_token: string) =>
    api.post('/api/v1/auth/logout', { refresh_token }),
}
