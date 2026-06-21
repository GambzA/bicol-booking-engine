import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = false
let queue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

api.interceptors.response.use(
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
        return api(original)
      })
    }

    refreshing = true
    try {
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) throw new Error('no refresh token')
      const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      })
      useAuthStore.getState().setAuth(data.user, data.access_token, data.refresh_token)
      queue.forEach(({ resolve }) => resolve(data.access_token))
      queue = []
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (err) {
      queue.forEach(({ reject }) => reject(err))
      queue = []
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      throw error
    } finally {
      refreshing = false
    }
  }
)

export default api
