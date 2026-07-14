import api from '../client'

export interface AccommodationImage {
  url: string
  category: string
}

export interface AmenityItem {
  icon: string
  label: string
}

export interface ChildPolicy {
  id: string
  min_age: number
  max_age: number
  charge_type: 'free' | 'fixed_amount' | 'percentage_of_base_rate'
  charge_value: string | null
  sort_order: number
}

export interface Accommodation {
  id: string
  name: string
  accommodation_type: string
  description: string | null
  num_units: number
  base_occupancy: number
  max_occupancy: number
  max_adults: number | null
  max_children: number | null
  base_rate: string
  weekend_rate: string | null
  additional_adult_fee: string
  additional_adult_requires_extra_bed: boolean
  extra_bed_fee: string | null
  is_active: boolean
  check_in_time: string | null
  check_out_time: string | null
  amenities: AmenityItem[]
  images: AccommodationImage[]
  child_policies: ChildPolicy[]
  created_at: string
  updated_at: string
}

export interface AccommodationListResponse {
  items: Accommodation[]
  total: number
  page: number
  pages: number
}

export interface RateCalendarResponse {
  accommodation_id: string
  name: string
  base_rate: string
  weekend_rate: string | null
  start_date: string
  end_date: string
  dates: string[]
  rates: Record<string, string>
  overridden_dates: string[]
}

const BASE = '/api/v1/property/accommodations'

export const accommodationsApi = {
  list: (params?: {
    search?: string
    accommodation_type?: string
    active?: boolean
    page?: number
    page_size?: number
  }) => api.get<AccommodationListResponse>(BASE, { params }),

  get: (id: string) => api.get<Accommodation>(`${BASE}/${id}`),

  create: (data: {
    name: string
    accommodation_type: string
    description?: string | null
    num_units: number
    base_occupancy: number
    max_occupancy: number
    max_adults?: number | null
    max_children?: number | null
    base_rate: string
    weekend_rate?: string | null
    additional_adult_fee: string
    additional_adult_requires_extra_bed: boolean
    extra_bed_fee?: string | null
    check_in_time?: string | null
    check_out_time?: string | null
    amenities?: AmenityItem[]
    images?: AccommodationImage[]
    child_policies?: Omit<ChildPolicy, 'id'>[]
  }) => api.post<Accommodation>(BASE, data),

  update: (id: string, data: Partial<{
    name: string
    accommodation_type: string
    description: string | null
    num_units: number
    base_occupancy: number
    max_occupancy: number
    max_adults: number | null
    max_children: number | null
    base_rate: string
    weekend_rate: string | null
    additional_adult_fee: string
    additional_adult_requires_extra_bed: boolean
    extra_bed_fee: string | null
    check_in_time: string | null
    check_out_time: string | null
    amenities: AmenityItem[]
    images: AccommodationImage[]
    child_policies: Omit<ChildPolicy, 'id'>[]
  }>) => api.put<Accommodation>(`${BASE}/${id}`, data),

  toggleActive: (id: string) => api.patch<Accommodation>(`${BASE}/${id}/toggle`),

  delete: (id: string) => api.delete(`${BASE}/${id}`),

  rateCalendar: (id: string, params?: { start_date?: string; end_date?: string }) =>
    api.get<RateCalendarResponse>(`${BASE}/${id}/rate-calendar`, { params }),

  setRateCalendar: (id: string, records: { date: string; rate: string }[]) =>
    api.put(`${BASE}/${id}/rate-calendar`, records),

  deleteRateOverrides: (id: string, dates: string[]) =>
    api.delete(`${BASE}/${id}/rate-calendar`, { data: { dates } }),

  uploadImage: (file: File, folder = 'accommodations') => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ url: string }>('/api/v1/property/upload', form, {
      params: { folder },
    })
  },
}
