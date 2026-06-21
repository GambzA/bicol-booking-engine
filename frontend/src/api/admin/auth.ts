import adminApi from '../adminClient'
import type { AdminAuthResponse } from '../../types/admin'

export const adminAuthApi = {
  login: (data: { email: string; password: string }) =>
    adminApi.post<AdminAuthResponse>('/api/v1/admin/auth/login', data),
  refresh: (refresh_token: string) =>
    adminApi.post<AdminAuthResponse>('/api/v1/admin/auth/refresh', { refresh_token }),
  logout: (refresh_token: string) =>
    adminApi.post('/api/v1/admin/auth/logout', { refresh_token }),
}
