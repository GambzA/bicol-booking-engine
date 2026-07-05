import api from '../client'

export interface NightlyRate {
  date: string
  room_rate: string
  additional_adult_amount: string
  children_amount: string
  night_total: string
}

export interface BookingQuote {
  nights: number
  num_adults: number
  num_children: number
  base_amount: string
  additional_adult_amount: string
  children_amount: string
  accommodation_subtotal: string
  discount_amount: string
  package_amount: string
  taxes_fees_amount: string
  total_amount: string
  rate_plan_id: string | null
  rate_plan_name: string | null
  promotion_id: string | null
  promotion_name: string | null
  package_id: string | null
  package_name: string | null
  nightly: NightlyRate[]
  available_units?: number
}

export interface AvailabilityRatePlan { id: string; name: string; pricing_method: string }
export interface AvailabilityPromotion { id: string; name: string; discount_type: string; discount_value: string }
export interface AvailabilityPackage { id: string; name: string; pricing_type: string; price_value: string }

export interface AvailabilityResult {
  accommodation_id: string
  name: string
  accommodation_type: string
  available_units: number
  base_rate: string
  base_occupancy: number
  max_occupancy: number
  max_adults: number | null
  max_children: number | null
  nights: number
  estimated_total: string
  rate_plans: AvailabilityRatePlan[]
  promotions: AvailabilityPromotion[]
  packages: AvailabilityPackage[]
}

export interface AvailabilitySearchResponse {
  check_in_date: string
  check_out_date: string
  nights: number
  num_adults: number
  num_children: number
  results: AvailabilityResult[]
}

export interface BookingListItem {
  id: string
  booking_number: string
  guest_name: string | null
  accommodation_summary: string | null
  rooms_count: number
  check_in_date: string
  check_out_date: string
  nights: number
  status: string
  payment_status: string
  total_amount: string
  total_paid: string
  booking_source: string | null
  created_at: string
}

export interface BookingListResponse {
  items: BookingListItem[]
  total: number
  page: number
  pages: number
}

export interface PaymentSummary {
  booking_total: string
  deposit_paid: string
  total_paid: string
  outstanding_balance: string
  payment_status: string
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

export interface BookingPayment {
  id: string
  amount: string
  payment_date: string
  method: string | null
  payment_method_id: string | null
  payment_method_name: string | null
  reference_number: string | null
  notes: string | null
  status: string
  created_at: string
  transactions: PaymentTransaction[]
}

export interface TimelineEntry {
  id: string
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string
}

export interface BookingRoomGuest {
  id: string
  occupant_type: 'adult' | 'child'
  name: string | null
  is_named: boolean
  age: number | null
}

export interface BookingRoom {
  id: string
  display_order: number
  accommodation_id: string
  accommodation_name: string | null
  accommodation_type: string | null
  num_adults: number
  num_children: number
  num_guests: number
  rate_plan_id: string | null
  rate_plan_name: string | null
  promotion_id: string | null
  promotion_name: string | null
  discount_type: string | null
  discount_value: string | null
  package_id: string | null
  package_name: string | null
  package_amount: string
  base_amount: string
  additional_adult_amount: string
  children_amount: string
  discount_amount: string
  taxes_fees_amount: string
  subtotal_amount: string
  total_amount: string
  guests: BookingRoomGuest[]
  nightly_rates: NightlyRate[]
}

export interface BookingTaxLine {
  id: string
  tax_id: string | null
  name: string
  tax_type: string
  rate: string
  calculation_method: string
  application_scope: string
  amount: string
  is_included: boolean
}

export interface BookingDetail {
  id: string
  booking_number: string
  status: string
  booking_source: string | null
  guest_id: string
  guest_name: string | null
  guest_email: string | null
  guest_mobile: string | null
  check_in_date: string
  check_out_date: string
  nights: number
  num_guests: number
  rooms_count: number
  notes: string | null
  payment_method_id: string | null
  payment_method_name: string | null
  deposit_required: boolean
  deposit_amount: string
  rooms: BookingRoom[]
  base_amount: string
  additional_adult_amount: string
  children_amount: string
  discount_amount: string
  package_amount: string
  taxes_fees_amount: string
  subtotal_amount: string
  net_amount: string
  tax_total: string
  taxes: BookingTaxLine[]
  total_amount: string
  payment_summary: PaymentSummary
  timeline: TimelineEntry[]
  payments: BookingPayment[]
  created_at: string
  updated_at: string
}

export interface OccupantInput {
  full_name?: string | null
  age?: number | null
}

export interface RoomInput {
  accommodation_id: string
  rate_plan_id?: string | null
  promotion_id?: string | null
  package_id?: string | null
  adults: OccupantInput[]
  children: OccupantInput[]
}

const BASE = '/api/v1/property/bookings'

export const bookingsApi = {
  list: (params?: {
    search?: string
    status?: string
    payment_status?: string
    check_in_from?: string
    check_in_to?: string
    sort?: string
    page?: number
    page_size?: number
  }) => api.get<BookingListResponse>(BASE, { params }),

  get: (id: string) => api.get<BookingDetail>(`${BASE}/${id}`),

  searchAvailability: (data: {
    check_in_date: string
    check_out_date: string
    num_adults: number
    children_ages: number[]
  }) => api.post<AvailabilitySearchResponse>(`${BASE}/availability-search`, data),

  quote: (data: {
    accommodation_id: string
    check_in_date: string
    check_out_date: string
    num_adults: number
    children_ages: number[]
    rate_plan_id?: string | null
    promotion_id?: string | null
    package_id?: string | null
  }) => api.post<BookingQuote>(`${BASE}/quote`, data),

  create: (data: {
    guest_id: string
    check_in_date: string
    check_out_date: string
    booking_source?: string | null
    notes?: string | null
    status?: string
    payment_method_id?: string | null
    rooms: RoomInput[]
  }) => api.post<BookingDetail>(BASE, data),

  updateStatus: (id: string, data: { status: string; note?: string | null }) =>
    api.patch<BookingDetail>(`${BASE}/${id}/status`, data),

  recordPayment: (id: string, data: {
    amount: string
    payment_date?: string | null
    method?: string | null
    payment_method_id?: string | null
    reference_number?: string | null
    notes?: string | null
    is_refund?: boolean
  }) => api.post<BookingDetail>(`${BASE}/${id}/payments`, data),

  delete: (id: string) => api.delete(`${BASE}/${id}`),
}
