import api from '../client'

export interface BankAccount {
  id?: string
  account_name: string
  bank_name: string
  account_number: string
  branch?: string | null
  swift_code?: string | null
  iban?: string | null
  qr_image_url?: string | null
  instructions?: string | null
  is_default: boolean
  display_order?: number
}

export interface PaymentMethod {
  id: string
  method_type: string
  name: string
  is_enabled: boolean
  display_order: number
  instructions: string | null
  deposit_required: boolean
  deposit_type: string | null
  deposit_value: string | null
  bank_account_count?: number
  bank_accounts?: BankAccount[]
  created_at: string
  updated_at: string
}

export interface PaymentMethodListResponse {
  items: PaymentMethod[]
}

const BASE = '/api/v1/property/payment-methods'

export const paymentMethodsApi = {
  list: (params?: { active?: boolean }) =>
    api.get<PaymentMethodListResponse>(BASE, { params }),

  get: (id: string) => api.get<PaymentMethod>(`${BASE}/${id}`),

  create: (data: {
    method_type: string
    name: string
    is_enabled?: boolean
    display_order?: number
    instructions?: string | null
    deposit_required?: boolean
    deposit_type?: string | null
    deposit_value?: string | null
    bank_accounts?: BankAccount[]
  }) => api.post<PaymentMethod>(BASE, data),

  update: (id: string, data: {
    name?: string
    is_enabled?: boolean
    display_order?: number
    instructions?: string | null
    deposit_required?: boolean
    deposit_type?: string | null
    deposit_value?: string | null
    bank_accounts?: BankAccount[] | null
  }) => api.put<PaymentMethod>(`${BASE}/${id}`, data),

  toggle: (id: string) => api.patch<PaymentMethod>(`${BASE}/${id}/toggle`),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
