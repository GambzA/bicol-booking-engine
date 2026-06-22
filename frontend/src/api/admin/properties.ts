import adminApi from '../adminClient'
import type { Hotel, PaginatedResponse } from '../../types/admin'

export const propertiesApi = {
  list: (params?: { status?: string; search?: string; page?: number; page_size?: number }) =>
    adminApi.get<PaginatedResponse<Hotel>>('/api/v1/admin/properties', { params }),
  get: (id: string) =>
    adminApi.get<Hotel>(`/api/v1/admin/properties/${id}`),
  create: (data: object) =>
    adminApi.post<Hotel & { credentials: { username: string; email: string; temporary_password: string } }>(
      '/api/v1/admin/properties', data
    ),
  update: (id: string, data: object) =>
    adminApi.patch<Hotel>(`/api/v1/admin/properties/${id}`, data),
  suspend: (id: string, reason: string) =>
    adminApi.post<Hotel>(`/api/v1/admin/properties/${id}/suspend`, { reason }),
  reactivate: (id: string, reason: string) =>
    adminApi.post<Hotel>(`/api/v1/admin/properties/${id}/reactivate`, { reason }),
  deactivate: (id: string, reason: string) =>
    adminApi.post(`/api/v1/admin/properties/${id}/deactivate`, { reason }),
}

export function uploadApi(file: File, folder = 'properties') {
  const form = new FormData()
  form.append('file', file)
  return adminApi.post<{ url: string }>(`/api/v1/admin/upload?folder=${folder}`, form)
}
