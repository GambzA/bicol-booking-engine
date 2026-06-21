import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { adminAuthApi } from '../../api/admin/auth'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { useToast } from '../../components/common/useToast'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

export function AdminLogin() {
  const navigate = useNavigate()
  const setAuth = useAdminAuthStore((s) => s.setAuth)
  const toast = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await adminAuthApi.login(values)
      setAuth(data.admin, data.access_token, data.refresh_token)
      navigate('/admin/dashboard')
    } catch {
      toast.error('Invalid credentials.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Admin Portal</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Sign in</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
          <Input label="Email" id="email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
          <Input label="Password" id="password" type="password" autoComplete="current-password" {...register('password')} error={errors.password?.message} />
          <Button type="submit" loading={isSubmitting} className="mt-2 w-full">Sign in</Button>
        </form>
      </div>
    </div>
  )
}
