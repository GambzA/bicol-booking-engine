import adminApi from '../adminClient'
import type { PropertySubscription } from '../../types/admin'

export const subscriptionsApi = {
  assign: (hotelId: string, data: object) =>
    adminApi.post<PropertySubscription>(`/api/v1/admin/properties/${hotelId}/subscription`, data),
  update: (hotelId: string, data: object) =>
    adminApi.patch<PropertySubscription>(`/api/v1/admin/properties/${hotelId}/subscription`, data),
  cancel: (hotelId: string) =>
    adminApi.delete(`/api/v1/admin/properties/${hotelId}/subscription`),
}
