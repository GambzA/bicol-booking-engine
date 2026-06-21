import adminApi from '../adminClient'
import type { CommissionStatement, CommissionAdjustment, PaginatedResponse } from '../../types/admin'

export const commissionsApi = {
  list: (params?: { hotel_id?: string; status?: string; page?: number; page_size?: number }) =>
    adminApi.get<PaginatedResponse<CommissionStatement>>('/api/v1/admin/commissions', { params }),
  get: (id: string) =>
    adminApi.get<CommissionStatement>(`/api/v1/admin/commissions/${id}`),
  create: (data: object) =>
    adminApi.post<CommissionStatement>('/api/v1/admin/commissions', data),
  addAdjustment: (id: string, data: object) =>
    adminApi.post<CommissionAdjustment>(`/api/v1/admin/commissions/${id}/adjustments`, data),
  finalize: (id: string) =>
    adminApi.post<CommissionStatement>(`/api/v1/admin/commissions/${id}/finalize`),
}
