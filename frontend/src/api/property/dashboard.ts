import api from '../client'

export interface DashboardStats {
  total_bookings: number
  todays_checkins: number
  todays_checkouts: number
  upcoming_arrivals: number
  upcoming_departures: number
  monthly_revenue: string
  occupancy_rate: number
  outstanding_payments: string
  recent_bookings: RecentBooking[]
}

export interface RecentBooking {
  id: string
  booking_number: string
  guest_name: string
  accommodation_name: string
  check_in_date: string
  check_out_date: string
  total_amount: string
  status: string
  created_at: string
}

export const dashboardApi = {
  get: () => api.get<DashboardStats>('/api/v1/property/dashboard'),
}
