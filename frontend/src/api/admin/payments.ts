import adminApi from '../adminClient'
import type { Payment, PaginatedResponse } from '../../types/admin'

export const paymentsApi = {
  list: (params?: { hotel_id?: string; invoice_id?: string; page?: number; page_size?: number }) =>
    adminApi.get<PaginatedResponse<Payment>>('/api/v1/admin/payments', { params }),
  record: (data: object) =>
    adminApi.post<Payment>('/api/v1/admin/payments', data),
  create: (data: object) =>
    adminApi.post<Payment>('/api/v1/admin/payments', data),
}
