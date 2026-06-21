import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { AxiosError } from 'axios'
import { propertiesApi } from '../../api/admin/properties'
import { Modal } from '../../components/common/Modal'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { useToast } from '../../components/common/useToast'

const schema = z.object({
  hotel_name: z.string().min(2, 'Required'),
  email: z.string().email('Invalid email'),
  owner_full_name: z.string().min(2, 'Required'),
  owner_password: z.string().min(8, 'Min 8 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface CreatePropertyModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreatePropertyModal({ open, onClose, onCreated }: CreatePropertyModalProps) {
  const toast = useToast()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await propertiesApi.create(values)
      toast.success('Property created.')
      reset()
      onCreated()
    } catch (err) {
      const e = err as AxiosError<{ error: { message: string } }>
      toast.error(e.response?.data?.error?.message ?? 'Failed to create property.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Property" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Hotel name" {...register('hotel_name')} error={errors.hotel_name?.message} />
        <Input label="Business email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Owner full name" {...register('owner_full_name')} error={errors.owner_full_name?.message} />
        <Input label="Owner password" type="password" {...register('owner_password')} error={errors.owner_password?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone (optional)" {...register('phone')} />
          <Input label="City (optional)" {...register('city')} />
        </div>
        <Input label="Address (optional)" {...register('address')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create Property</Button>
        </div>
      </form>
    </Modal>
  )
}
