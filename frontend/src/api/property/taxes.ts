import api from '../client'

export interface Tax {
  id: string
  name: string
  description: string | null
  tax_type: string
  rate: string
  calculation_method: string
  application_scope: string
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface TaxListResponse {
  items: Tax[]
  total: number
  page: number
  pages: number
}

export interface TaxLine {
  tax_id: string | null
  name: string
  tax_type: string
  rate: string
  calculation_method: string
  application_scope: string
  amount: string
  is_included: boolean
}

export interface TaxPreview {
  subtotal: string
  taxes: TaxLine[]
  tax_total: string
  grand_total: string
}

const BASE = '/api/v1/property/taxes'

export const taxesApi = {
  list: (params?: { search?: string; active?: boolean; page?: number; page_size?: number }) =>
    api.get<TaxListResponse>(BASE, { params }),

  get: (id: string) => api.get<Tax>(`${BASE}/${id}`),

  create: (data: {
    name: string
    description?: string | null
    tax_type: string
    rate: string
    calculation_method: string
    application_scope: string
    is_active?: boolean
    display_order?: number
  }) => api.post<Tax>(BASE, data),

  update: (id: string, data: {
    name?: string
    description?: string | null
    tax_type?: string
    rate?: string
    calculation_method?: string
    application_scope?: string
    is_active?: boolean
    display_order?: number
  }) => api.put<Tax>(`${BASE}/${id}`, data),

  toggleActive: (id: string) => api.patch<Tax>(`${BASE}/${id}/toggle`),

  delete: (id: string) => api.delete(`${BASE}/${id}`),

  preview: (data: { subtotal: string; nights: number; num_adults: number; num_children: number }) =>
    api.post<TaxPreview>(`${BASE}/preview`, data),
}
