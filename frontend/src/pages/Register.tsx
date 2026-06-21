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
  hotel_name: z.string().min(2, 'Hotel name must be at least 2 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

export function Register() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const toast = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await authApi.register(values)
      setAuth(data.user, data.access_token, data.refresh_token)
      navigate('/dashboard')
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: { message: string } }>
      toast.error(axiosErr.response?.data?.error?.message ?? 'Registration failed. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Register your hotel</h1>
        <p className="mt-1 text-sm text-slate-500">Get started in minutes</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
          <Input
            label="Hotel name"
            id="hotel_name"
            {...register('hotel_name')}
            error={errors.hotel_name?.message}
          />
          <Input
            label="Your full name"
            id="full_name"
            autoComplete="name"
            {...register('full_name')}
            error={errors.full_name?.message}
          />
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
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-slate-800 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
