import adminApi from '../adminClient'
import type { AuditLog, PaginatedResponse } from '../../types/admin'

export const auditApi = {
  list: (params?: { hotel_id?: string; admin_id?: string; entity_type?: string; entity_id?: string; page?: number; page_size?: number }) =>
    adminApi.get<PaginatedResponse<AuditLog>>('/api/v1/admin/audit-logs', { params }),
}
