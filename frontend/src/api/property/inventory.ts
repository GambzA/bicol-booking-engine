import api from '../client'

export interface InventoryDay {
  date: string
  total_units: number
  reserved: number
  adjustments: number
  sellable: number
  available: number
}

export interface InventoryAccommodation {
  id: string
  name: string
  total_units: number
  days: InventoryDay[]
}

export interface InventoryResponse {
  start_date: string
  end_date: string
  dates: string[]
  accommodations: InventoryAccommodation[]
}

export interface InventoryAdjustment {
  id: string
  accommodation_id: string
  accommodation_name: string | null
  start_date: string
  end_date: string
  adjustment_value: number
  reason: string
  notes: string | null
  created_by_name: string | null
  created_at: string
}

export interface PreviewDay {
  date: string
  sellable_before: number
  sellable_after: number
  available_before: number
  available_after: number
}

export interface PreviewResponse {
  accommodations: { accommodation_id: string; accommodation_name: string; days: PreviewDay[] }[]
}

interface AdjustmentBody {
  accommodation_ids: string[]
  start_date: string
  end_date: string
  adjustment_value: number
  reason: string
  notes?: string | null
}

const BASE = '/api/v1/property/inventory'

export const inventoryApi = {
  grid: (params?: { accommodation_id?: string; date_from?: string; date_to?: string }) =>
    api.get<InventoryResponse>(BASE, { params }),

  listAdjustments: (params?: { accommodation_id?: string; date_from?: string; date_to?: string }) =>
    api.get<{ items: InventoryAdjustment[] }>(`${BASE}/adjustments`, { params }),

  preview: (data: Omit<AdjustmentBody, 'reason' | 'notes'>) =>
    api.post<PreviewResponse>(`${BASE}/adjustments/preview`, data),

  createAdjustment: (data: AdjustmentBody) =>
    api.post<{ items: InventoryAdjustment[] }>(`${BASE}/adjustments`, data),

  updateAdjustment: (id: string, data: Partial<Omit<AdjustmentBody, 'accommodation_ids'>>) =>
    api.put<InventoryAdjustment>(`${BASE}/adjustments/${id}`, data),

  deleteAdjustment: (id: string) => api.delete(`${BASE}/adjustments/${id}`),
}
