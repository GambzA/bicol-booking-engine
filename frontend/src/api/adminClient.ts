import axios from 'axios'
import { useAdminAuthStore } from '../store/adminAuthStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const adminApi = axios.create({ baseURL: BASE_URL })

adminApi.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = false
let queue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

adminApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) throw error
    original._retry = true

    if (refreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return adminApi(original)
      })
    }

    refreshing = true
    try {
      const refreshToken = useAdminAuthStore.getState().refreshToken
      if (!refreshToken) throw new Error('no refresh token')
      const { data } = await axios.post(`${BASE_URL}/api/v1/admin/auth/refresh`, {
        refresh_token: refreshToken,
      })
      useAdminAuthStore.getState().setAuth(data.admin, data.access_token, data.refresh_token)
      queue.forEach(({ resolve }) => resolve(data.access_token))
      queue = []
      original.headers.Authorization = `Bearer ${data.access_token}`
      return adminApi(original)
    } catch (err) {
      queue.forEach(({ reject }) => reject(err))
      queue = []
      useAdminAuthStore.getState().clearAuth()
      window.location.href = '/admin/login'
      throw error
    } finally {
      refreshing = false
    }
  }
)

export default adminApi
