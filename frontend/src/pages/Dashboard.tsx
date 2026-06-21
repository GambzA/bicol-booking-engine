import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { Avatar } from '../components/common/Avatar'
import { Button } from '../components/common/Button'

export function Dashboard() {
  const { user, refreshToken, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      // best-effort
    }
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">Booking Engine</span>
          <div className="flex items-center gap-3">
            {user && <Avatar name={user.full_name} size="sm" />}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-bold text-slate-900">
          Welcome, {user?.full_name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          More features are coming as we build them out.
        </p>
      </main>
    </div>
  )
}
