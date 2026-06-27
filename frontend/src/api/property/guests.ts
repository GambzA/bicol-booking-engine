import api from '../client'

export interface BookingHistoryItem {
  id: string
  booking_number: string
  accommodation_name: string | null
  check_in_date: string
  check_out_date: string
  status: string
  total_amount: string
}

export interface Guest {
  id: string
  first_name: string
  last_name: string
  full_name: string
  email: string | null
  mobile_number: string | null
  date_of_birth: string | null
  nationality: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  country_id: string | null
  country_name: string | null
  notes: string | null
  booking_count: number
  total_spent: string
  last_stay: string | null
  bookings?: BookingHistoryItem[]
  created_at: string
  updated_at: string
}

export interface GuestListResponse {
  items: Guest[]
  total: number
  page: number
  pages: number
}

export interface DuplicateError {
  message: string
  existing: {
    id: string
    full_name: string
    email: string | null
    mobile_number: string | null
  }
}

const BASE = '/api/v1/property/guests'

export const guestsApi = {
  list: (params?: {
    search?: string
    sort?: 'name' | 'created_at' | 'last_stay'
    page?: number
    page_size?: number
  }) => api.get<GuestListResponse>(BASE, { params }),

  get: (id: string) => api.get<Guest>(`${BASE}/${id}`),

  create: (
    data: {
      first_name: string
      last_name: string
      email?: string | null
      mobile_number?: string | null
      date_of_birth?: string | null
      nationality?: string | null
      address_line_1?: string | null
      address_line_2?: string | null
      city?: string | null
      state_province?: string | null
      postal_code?: string | null
      country_id?: string | null
      notes?: string | null
    },
    force?: boolean
  ) => api.post<Guest>(BASE, data, { params: force ? { force: true } : undefined }),

  update: (
    id: string,
    data: {
      first_name?: string
      last_name?: string
      email?: string | null
      mobile_number?: string | null
      date_of_birth?: string | null
      nationality?: string | null
      address_line_1?: string | null
      address_line_2?: string | null
      city?: string | null
      state_province?: string | null
      postal_code?: string | null
      country_id?: string | null
      notes?: string | null
    }
  ) => api.put<Guest>(`${BASE}/${id}`, data),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
