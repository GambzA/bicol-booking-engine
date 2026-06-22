export interface PlatformAdmin {
  id: string
  email: string
  full_name: string
}

export interface AdminAuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  admin: PlatformAdmin
}

export type HotelStatus = 'active' | 'suspended' | 'deactivated'
export type PropertyType = 'hotel' | 'resort' | 'apartment' | 'hostel' | 'villa' | 'bed_and_breakfast' | 'guest_house'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'
export type BillingCycle = 'monthly' | 'annual'
export type InvoiceType = 'subscription' | 'commission' | 'combined' | 'one_time'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'void'
export type PeriodType = 'monthly' | 'annual'
export type CommissionStatementStatus = 'draft' | 'finalized'

export interface SubscriptionPlanSummary {
  id: string
  name: string
  monthly_fee: string
  annual_fee: string
  commission_percentage: string
  trial_period_days: number
}

export interface PropertySubscriptionSummary {
  id: string
  status: SubscriptionStatus
  billing_cycle: BillingCycle
  start_date: string
  next_billing_date: string
  trial_end_date: string | null
  plan: SubscriptionPlanSummary | null
}

export interface HotelUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string
  mobile_number: string | null
  username: string | null
  role: 'owner' | 'staff'
}

export interface PropertyPhoto {
  id: string
  url: string
  caption: string | null
  sort_order: number
}

export interface Hotel {
  id: string
  name: string
  business_name: string | null
  slug: string
  property_type: PropertyType
  description: string | null
  email: string
  contact_person: string | null
  mobile_number: string | null
  telephone_number: string | null
  city: string | null
  province: string | null
  country: string
  address_line_1: string | null
  address_line_2: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  default_currency: string
  timezone: string
  language: string
  banner_image_url: string | null
  logo_url: string | null
  status: HotelStatus
  is_active: boolean
  created_at: string
  subscription: PropertySubscriptionSummary | null
  users?: HotelUser[]
  photos?: PropertyPhoto[]
}

export interface SubscriptionPlan {
  id: string
  name: string
  monthly_fee: string
  annual_fee: string
  commission_percentage: string
  trial_period_days: number
  max_users: number | null
  max_properties: number | null
  features: string[]
  is_active: boolean
  created_at: string
}

export interface PropertySubscription {
  id: string
  hotel_id: string
  plan_id: string
  status: SubscriptionStatus
  billing_cycle: BillingCycle
  start_date: string
  trial_end_date: string | null
  next_billing_date: string
  grace_period_days: number
  auto_suspend: boolean
}

export interface Invoice {
  id: string
  invoice_number: string
  hotel_id: string
  type: InvoiceType
  status: InvoiceStatus
  billing_period_start: string
  billing_period_end: string
  due_date: string
  subscription_amount: string
  commission_amount: string
  tax_amount: string
  total_amount: string
  notes: string | null
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  commission_statement_id: string | null
  created_at: string
}

export interface Payment {
  id: string
  hotel_id: string
  invoice_id: string | null
  amount: string
  payment_date: string
  proof_of_payment_url: string | null
  notes: string | null
  recorded_by: string
  created_at: string
}

export interface CommissionAdjustment {
  id: string
  amount: string
  reason: string
  created_at: string
}

export interface CommissionStatement {
  id: string
  hotel_id: string
  period_type: PeriodType
  period_start: string
  period_end: string
  total_booking_revenue: string
  eligible_booking_revenue: string
  commission_percentage: string
  total_commission_due: string
  net_commission_due?: string
  status: CommissionStatementStatus
  invoice_id: string | null
  created_at: string
  adjustments: CommissionAdjustment[]
}

export interface AuditLog {
  id: string
  admin_id: string | null
  hotel_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  remarks: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  extra: Record<string, unknown> | null
  created_at: string
}

export interface PlatformOverview {
  total_properties: number
  active_properties: number
  suspended_properties: number
  active_subscriptions: number
  overdue_invoices_count: number
  overdue_invoices_amount: string
}

export interface RevenueReport {
  period_start: string
  period_end: string
  subscription_revenue: string
  commission_revenue: string
  total_revenue: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}
