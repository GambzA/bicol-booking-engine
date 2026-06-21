import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { paymentsApi } from '../../api/admin/payments'
import { invoicesApi } from '../../api/admin/invoices'
import { propertiesApi } from '../../api/admin/properties'
import { Table, type Column } from '../../components/common/Table'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Select } from '../../components/common/Select'
import { Modal } from '../../components/common/Modal'
import { Pagination } from '../../components/common/Pagination'
import { useToast } from '../../components/common/useToast'
import type { Payment, Invoice, Hotel } from '../../types/admin'

const schema = z.object({
  hotel_id: z.string().min(1, 'Select a property'),
  invoice_id: z.string().optional(),
  amount: z.coerce.number().positive('Must be > 0'),
  payment_date: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function PaymentsPage() {
  const toast = useToast()
  const [payments, setPayments] = useState<Payment[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const PAGE_SIZE = 20

  const hotelMap = Object.fromEntries(hotels.map((h) => [h.id, h.name]))
  const invoiceMap = Object.fromEntries(invoices.map((i) => [i.id, i.invoice_number]))

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { payment_date: new Date().toISOString().split('T')[0] },
  })

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const r = await paymentsApi.list({ page, page_size: PAGE_SIZE })
      setPayments(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load payments.')
    }
    setLoading(false)
  }, [page])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  useEffect(() => {
    propertiesApi.list({ page_size: 200 }).then((r) => setHotels(r.data.items)).catch(() => {})
    invoicesApi.list({ status: 'sent', page_size: 200 }).then((r) => setInvoices(r.data.items)).catch(() => {})
  }, [])

  const invoiceOptions = [
    { value: '', label: 'No linked invoice' },
    ...invoices.map((i) => ({ value: i.id, label: `${i.invoice_number} (₱${i.total_amount})` })),
  ]

  const hotelOptions = [
    { value: '', label: 'Select property...' },
    ...hotels.map((h) => ({ value: h.id, label: h.name })),
  ]

  const onSubmit = async (values: FormValues) => {
    try {
      await paymentsApi.record({
        hotel_id: values.hotel_id,
        invoice_id: values.invoice_id || null,
        amount: values.amount,
        payment_date: values.payment_date,
        notes: values.notes || null,
      })
      toast.success('Payment recorded.')
      reset()
      setShowModal(false)
      fetchPayments()
    } catch {
      toast.error('Failed to record payment.')
    }
  }

  const columns: Column<Payment>[] = [
    { key: 'payment_date', label: 'Date', render: (p) => new Date(p.payment_date).toLocaleDateString() },
    { key: 'hotel_id', label: 'Property', render: (p) => hotelMap[p.hotel_id] ?? p.hotel_id.slice(0, 8) },
    { key: 'invoice_id', label: 'Invoice', render: (p) => p.invoice_id ? (invoiceMap[p.invoice_id] ?? p.invoice_id.slice(0, 8)) : '-' },
    { key: 'amount', label: 'Amount', render: (p) => `₱${p.amount}` },
    { key: 'notes', label: 'Notes', render: (p) => p.notes ?? '-' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'payment' : 'payments'}</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={16} /> Record Payment</Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table columns={columns} data={payments} loading={loading} keyExtractor={(p) => p.id} emptyTitle="No payments recorded" emptyDescription="Record a payment against a sent invoice." />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Payment">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Select label="Property" options={hotelOptions} {...register('hotel_id')} error={errors.hotel_id?.message} />
          <Select label="Invoice (optional)" options={invoiceOptions} {...register('invoice_id')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (₱)" type="number" step="0.01" {...register('amount')} error={errors.amount?.message} />
            <Input label="Payment date" type="date" {...register('payment_date')} error={errors.payment_date?.message} />
          </div>
          <Input label="Notes (optional)" {...register('notes')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
