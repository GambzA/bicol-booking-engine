import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { useToast } from '../components/common/useToast'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

export function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const toast = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await authApi.login(values)
      setAuth(data.user, data.access_token, data.refresh_token)
      navigate('/dashboard')
    } catch {
      toast.error('Invalid email or password.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Access your hotel dashboard</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
          <Input
            label="Email"
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
          <Input
            label="Password"
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          New hotel?{' '}
          <Link to="/register" className="font-medium text-slate-800 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}
