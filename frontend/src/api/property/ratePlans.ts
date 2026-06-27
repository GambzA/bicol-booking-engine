import api from '../client'

export interface RatePlanAccommodationItem {
  id: string
  accommodation_id: string
  accommodation_name: string
  pricing_value: string
}

export interface RatePlan {
  id: string
  name: string
  description: string | null
  is_active: boolean
  pricing_method: string
  display_order: number
  accommodation_count?: number
  accommodations?: RatePlanAccommodationItem[]
  inclusions?: string[]
  created_at: string
  updated_at: string
}

export interface RatePlanListResponse {
  items: RatePlan[]
  total: number
  page: number
  pages: number
}

const BASE = '/api/v1/property/rate-plans'

export const ratePlansApi = {
  list: (params?: { search?: string; active?: boolean; page?: number; page_size?: number }) =>
    api.get<RatePlanListResponse>(BASE, { params }),

  get: (id: string) => api.get<RatePlan>(`${BASE}/${id}`),

  create: (data: {
    name: string
    description?: string | null
    is_active?: boolean
    pricing_method?: string
    display_order?: number
    accommodations: { accommodation_id: string; pricing_value: string }[]
    inclusions?: string[]
  }) => api.post<RatePlan>(BASE, data),

  update: (id: string, data: {
    name?: string
    description?: string | null
    is_active?: boolean
    pricing_method?: string
    display_order?: number
    accommodations?: { accommodation_id: string; pricing_value: string }[] | null
    inclusions?: string[] | null
  }) => api.put<RatePlan>(`${BASE}/${id}`, data),

  toggleActive: (id: string) => api.patch<RatePlan>(`${BASE}/${id}/toggle`),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
