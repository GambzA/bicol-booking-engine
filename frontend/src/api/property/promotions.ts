import api from '../client'

export interface PromotionAccommodationItem {
  id: string
  name: string | null
}

export interface PromotionRatePlanItem {
  id: string
  name: string | null
}

export interface Promotion {
  id: string
  name: string
  description: string | null
  is_active: boolean
  discount_type: string
  discount_value: string
  stay_start_date: string | null
  stay_end_date: string | null
  booking_start_date: string | null
  booking_end_date: string | null
  promo_code: string | null
  accommodation_count?: number
  accommodations?: PromotionAccommodationItem[]
  rate_plans?: PromotionRatePlanItem[]
  created_at: string
  updated_at: string
}

export interface PromotionListResponse {
  items: Promotion[]
  total: number
  page: number
  pages: number
}

const BASE = '/api/v1/property/promotions'

export const promotionsApi = {
  list: (params?: { search?: string; active?: boolean; page?: number; page_size?: number }) =>
    api.get<PromotionListResponse>(BASE, { params }),

  get: (id: string) => api.get<Promotion>(`${BASE}/${id}`),

  create: (data: {
    name: string
    description?: string | null
    is_active?: boolean
    discount_type: string
    discount_value: string
    stay_start_date?: string | null
    stay_end_date?: string | null
    booking_start_date?: string | null
    booking_end_date?: string | null
    promo_code?: string | null
    accommodation_ids: string[]
    rate_plan_ids?: string[]
  }) => api.post<Promotion>(BASE, data),

  update: (id: string, data: {
    name?: string
    description?: string | null
    is_active?: boolean
    discount_type?: string
    discount_value?: string
    stay_start_date?: string | null
    stay_end_date?: string | null
    booking_start_date?: string | null
    booking_end_date?: string | null
    promo_code?: string | null
    accommodation_ids?: string[]
    rate_plan_ids?: string[]
  }) => api.put<Promotion>(`${BASE}/${id}`, data),

  toggleActive: (id: string) => api.patch<Promotion>(`${BASE}/${id}/toggle`),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
