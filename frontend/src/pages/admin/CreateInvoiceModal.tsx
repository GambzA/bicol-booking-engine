import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invoicesApi } from '../../api/admin/invoices'
import { Modal } from '../../components/common/Modal'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Select } from '../../components/common/Select'
import { useToast } from '../../components/common/useToast'
import type { Hotel } from '../../types/admin'

const schema = z.object({
  hotel_id: z.string().min(1, 'Select a property'),
  type: z.enum(['subscription', 'commission', 'combined', 'one_time']),
  billing_period_start: z.string().min(1, 'Required'),
  billing_period_end: z.string().min(1, 'Required'),
  due_date: z.string().min(1, 'Required'),
  subscription_amount: z.coerce.number().min(0).default(0),
  commission_amount: z.coerce.number().min(0).default(0),
  tax_amount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface CreateInvoiceModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  hotels: Hotel[]
}

export function CreateInvoiceModal({ open, onClose, onCreated, hotels }: CreateInvoiceModalProps) {
  const toast = useToast()
  const hotelOptions = [
    { value: '', label: 'Select property...' },
    ...hotels.map((h) => ({ value: h.id, label: h.name })),
  ]

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'combined' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await invoicesApi.create(values)
      toast.success('Invoice created.')
      reset()
      onCreated()
    } catch {
      toast.error('Failed to create invoice.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Invoice" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Select label="Property" options={hotelOptions} {...register('hotel_id')} error={errors.hotel_id?.message} />
        <Select label="Type" options={[
          { value: 'subscription', label: 'Subscription' },
          { value: 'commission', label: 'Commission' },
          { value: 'combined', label: 'Combined' },
          { value: 'one_time', label: 'One-time' },
        ]} {...register('type')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Period start" type="date" {...register('billing_period_start')} error={errors.billing_period_start?.message} />
          <Input label="Period end" type="date" {...register('billing_period_end')} error={errors.billing_period_end?.message} />
        </div>
        <Input label="Due date" type="date" {...register('due_date')} error={errors.due_date?.message} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Subscription (₱)" type="number" step="0.01" {...register('subscription_amount')} />
          <Input label="Commission (₱)" type="number" step="0.01" {...register('commission_amount')} />
          <Input label="Tax (₱)" type="number" step="0.01" {...register('tax_amount')} />
        </div>
        <Input label="Notes (optional)" {...register('notes')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create Invoice</Button>
        </div>
      </form>
    </Modal>
  )
}
