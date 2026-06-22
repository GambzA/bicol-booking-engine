import adminApi from '../adminClient'
import type { SubscriptionPlan } from '../../types/admin'

export const plansApi = {
  list: (params?: { include_inactive?: boolean }) =>
    adminApi.get<{ items: SubscriptionPlan[] }>('/api/v1/admin/plans', { params }),
  get: (id: string) =>
    adminApi.get<SubscriptionPlan>(`/api/v1/admin/plans/${id}`),
  create: (data: object) =>
    adminApi.post<SubscriptionPlan>('/api/v1/admin/plans', data),
  update: (id: string, data: object) =>
    adminApi.patch<SubscriptionPlan>(`/api/v1/admin/plans/${id}`, data),
  toggle: (id: string) =>
    adminApi.post<SubscriptionPlan>(`/api/v1/admin/plans/${id}/toggle`),
  softDelete: (id: string) =>
    adminApi.delete(`/api/v1/admin/plans/${id}`),
  /** @deprecated use softDelete */
  disable: (id: string) => adminApi.delete(`/api/v1/admin/plans/${id}`),
}
