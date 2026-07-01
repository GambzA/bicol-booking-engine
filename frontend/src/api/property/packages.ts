import api from '../client'

export interface PackageAccommodationItem {
  accommodation_id: string
  accommodation_name: string
}

export interface Package {
  id: string
  name: string
  description: string | null
  is_active: boolean
  pricing_type: string
  price_value: string
  display_order: number
  accommodation_count?: number
  accommodations?: PackageAccommodationItem[] | { id: string; name: string }[]
  inclusions?: string[]
  created_at: string
  updated_at: string
}

export interface PackageListResponse {
  items: Package[]
  total: number
  page: number
  pages: number
}

const BASE = '/api/v1/property/packages'

export const packagesApi = {
  list: (params?: { search?: string; active?: boolean; page?: number; page_size?: number }) =>
    api.get<PackageListResponse>(BASE, { params }),

  get: (id: string) => api.get<Package>(`${BASE}/${id}`),

  create: (data: {
    name: string
    description?: string | null
    is_active?: boolean
    pricing_type?: string
    price_value: string
    display_order?: number
    accommodation_ids: string[]
    inclusions?: string[]
  }) => api.post<Package>(BASE, data),

  update: (id: string, data: {
    name?: string
    description?: string | null
    is_active?: boolean
    pricing_type?: string
    price_value?: string
    display_order?: number
    accommodation_ids?: string[] | null
    inclusions?: string[] | null
  }) => api.put<Package>(`${BASE}/${id}`, data),

  toggleActive: (id: string) => api.patch<Package>(`${BASE}/${id}/toggle`),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
