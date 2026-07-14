import api from '../client'

export interface PaymentListItem {
  id: string
  payment_number: string
  booking_id: string | null
  booking_number: string | null
  guest_name: string | null
  payment_method_id: string | null
  payment_method_name: string | null
  amount: string
  status: string
  payment_date: string
  reference_number: string | null
  recorded_by_name: string | null
  refunded_payment_id: string | null
  created_at: string
}

export interface PaymentListResponse {
  items: PaymentListItem[]
  total: number
  page: number
  pages: number
}

export interface PaymentTransaction {
  id: string
  transaction_type: string
  status: string
  amount: string
  external_transaction_id: string | null
  reference_number: string | null
  remarks: string | null
  created_at: string
}

export interface PaymentDetail extends PaymentListItem {
  notes: string | null
  transactions: PaymentTransaction[]
  refunded_payment: PaymentListItem | null
  refunds: PaymentListItem[]
  refundable_remaining: string
  booking: {
    id: string
    booking_number: string
    guest_name: string | null
    total_amount: string
  } | null
}

const BASE = '/api/v1/property/payments'

export const paymentsApi = {
  list: (params?: {
    search?: string
    payment_method_id?: string
    status?: string
    date_from?: string
    date_to?: string
    sort?: string
    page?: number
    page_size?: number
  }) => api.get<PaymentListResponse>(BASE, { params }),

  get: (id: string) => api.get<PaymentDetail>(`${BASE}/${id}`),

  refund: (id: string, data: { amount?: string | null; reference_number?: string | null; notes?: string | null }) =>
    api.post<PaymentDetail>(`${BASE}/${id}/refund`, data),
}
