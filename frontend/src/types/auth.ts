export interface User {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'staff'
  hotel_id: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}
