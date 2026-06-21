import adminApi from '../adminClient'
import type { PlatformOverview, RevenueReport } from '../../types/admin'

export const reportsApi = {
  overview: () =>
    adminApi.get<PlatformOverview>('/api/v1/admin/reports/overview'),
  revenue: (params: { period_start: string; period_end: string }) =>
    adminApi.get<RevenueReport>('/api/v1/admin/reports/revenue', { params }),
}
