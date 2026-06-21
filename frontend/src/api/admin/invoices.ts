import adminApi from '../adminClient'
import type { Invoice, PaginatedResponse } from '../../types/admin'

export const invoicesApi = {
  list: (params?: { hotel_id?: string; status?: string; page?: number; page_size?: number }) =>
    adminApi.get<PaginatedResponse<Invoice>>('/api/v1/admin/invoices', { params }),
  get: (id: string) =>
    adminApi.get<Invoice>(`/api/v1/admin/invoices/${id}`),
  create: (data: object) =>
    adminApi.post<Invoice>('/api/v1/admin/invoices', data),
  send: (id: string) =>
    adminApi.post<Invoice>(`/api/v1/admin/invoices/${id}/send`),
  void: (id: string, reason: string) =>
    adminApi.post<Invoice>(`/api/v1/admin/invoices/${id}/void`, { reason }),
  cancel: (id: string) =>
    adminApi.post<Invoice>(`/api/v1/admin/invoices/${id}/void`, { reason: 'Cancelled by admin' }),
  markPaid: (id: string) =>
    adminApi.post<Invoice>(`/api/v1/admin/invoices/${id}/mark-paid`),
}
