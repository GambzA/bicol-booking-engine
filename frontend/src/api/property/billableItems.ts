import api from '../client'

export interface BillableItem {
  id: string
  name: string
  description: string | null
  category: string
  pricing_type: string
  unit_price: string
  is_taxable: boolean
  is_active: boolean
  display_order: number
  applies_to_all_accommodations: boolean
  applies_to_all_rate_plans: boolean
  available_at_booking: boolean
  available_at_checkin: boolean
  available_at_stay: boolean
  available_at_checkout: boolean
  accommodation_count?: number
  rate_plan_count?: number
  accommodations?: { accommodation_id: string; accommodation_name: string }[]
  rate_plans?: { rate_plan_id: string; rate_plan_name: string }[]
  created_at: string
  updated_at: string
}

export interface BillableItemListResponse {
  items: BillableItem[]
  total: number
  page: number
  pages: number
}

export interface EligibleBillableItemsResponse {
  items: BillableItem[]
}

const BASE = '/api/v1/property/billable-items'

export const billableItemsApi = {
  list: (params?: { search?: string; category?: string; active?: boolean; page?: number; page_size?: number }) =>
    api.get<BillableItemListResponse>(BASE, { params }),

  listEligible: (params: { accommodation_ids: string[]; rate_plan_ids?: string[]; stage?: string }) =>
    api.get<EligibleBillableItemsResponse>(`${BASE}/eligible`, {
      params: {
        accommodation_ids: params.accommodation_ids,
        rate_plan_ids: params.rate_plan_ids ?? [],
        stage: params.stage ?? 'booking',
      },
      paramsSerializer: { indexes: null },
    }),

  get: (id: string) => api.get<BillableItem>(`${BASE}/${id}`),

  create: (data: {
    name: string
    description?: string | null
    category: string
    pricing_type: string
    unit_price: string
    is_taxable?: boolean
    is_active?: boolean
    display_order?: number
    applies_to_all_accommodations?: boolean
    applies_to_all_rate_plans?: boolean
    accommodation_ids?: string[]
    rate_plan_ids?: string[]
    available_at_booking?: boolean
    available_at_checkin?: boolean
    available_at_stay?: boolean
    available_at_checkout?: boolean
  }) => api.post<BillableItem>(BASE, data),

  update: (id: string, data: {
    name?: string
    description?: string | null
    category?: string
    pricing_type?: string
    unit_price?: string
    is_taxable?: boolean
    is_active?: boolean
    display_order?: number
    applies_to_all_accommodations?: boolean
    applies_to_all_rate_plans?: boolean
    accommodation_ids?: string[]
    rate_plan_ids?: string[]
    available_at_booking?: boolean
    available_at_checkin?: boolean
    available_at_stay?: boolean
    available_at_checkout?: boolean
  }) => api.put<BillableItem>(`${BASE}/${id}`, data),

  toggleActive: (id: string) => api.patch<BillableItem>(`${BASE}/${id}/toggle`),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
