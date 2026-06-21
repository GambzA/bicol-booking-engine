import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { commissionsApi } from '../../api/admin/commissions'
import { propertiesApi } from '../../api/admin/properties'
import { Table, type Column } from '../../components/common/Table'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Select } from '../../components/common/Select'
import { Modal } from '../../components/common/Modal'
import { Pagination } from '../../components/common/Pagination'
import { CommissionStatusBadge } from '../../components/admin/StatusBadge'
import { useToast } from '../../components/common/useToast'
import type { CommissionStatement, Hotel } from '../../types/admin'

const schema = z.object({
  hotel_id: z.string().min(1, 'Select a property'),
  period_type: z.enum(['monthly', 'annual']),
  period_start: z.string().min(1, 'Required'),
  period_end: z.string().min(1, 'Required'),
  total_booking_revenue: z.coerce.number().min(0).default(0),
  eligible_booking_revenue: z.coerce.number().min(0).default(0),
})

type FormValues = z.infer<typeof schema>

export function CommissionsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [statements, setStatements] = useState<CommissionStatement[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [hotelId, setHotelId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const PAGE_SIZE = 20

  const hotelMap = Object.fromEntries(hotels.map((h) => [h.id, h.name]))

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { period_type: 'monthly' },
  })

  const fetchStatements = useCallback(async () => {
    setLoading(true)
    try {
      const r = await commissionsApi.list({
        hotel_id: hotelId || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setStatements(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load commissions.')
    }
    setLoading(false)
  }, [hotelId, page])

  useEffect(() => { fetchStatements() }, [fetchStatements])

  useEffect(() => {
    propertiesApi.list({ page_size: 200 }).then((r) => setHotels(r.data.items)).catch(() => {})
  }, [])

  const hotelOptions = [
    { value: '', label: 'All properties' },
    ...hotels.map((h) => ({ value: h.id, label: h.name })),
  ]

  const onSubmit = async (values: FormValues) => {
    try {
      await commissionsApi.create(values)
      toast.success('Commission statement created.')
      reset()
      setShowModal(false)
      fetchStatements()
    } catch {
      toast.error('Failed to create statement.')
    }
  }

  const columns: Column<CommissionStatement>[] = [
    { key: 'hotel_id', label: 'Property', render: (s) => (
      <button onClick={() => navigate(`/admin/commissions/${s.id}`)} className="font-medium text-slate-800 hover:underline">
        {hotelMap[s.hotel_id] ?? s.hotel_id.slice(0, 8)}
      </button>
    )},
    { key: 'period_start', label: 'Period', render: (s) => `${s.period_start} - ${s.period_end}` },
    { key: 'total_booking_revenue', label: 'Revenue', render: (s) => `₱${s.total_booking_revenue}` },
    { key: 'total_commission_due', label: 'Commission Due', render: (s) => `₱${s.total_commission_due}` },
    { key: 'status', label: 'Status', render: (s) => <CommissionStatusBadge status={s.status} /> },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Commissions</h1>
          <p className="mt-1 text-sm text-slate-500">{total} {total === 1 ? 'statement' : 'statements'}</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={16} /> New Statement</Button>
      </div>

      <div className="mt-6 flex gap-3">
        <Select options={hotelOptions} value={hotelId} onChange={(e) => { setHotelId(e.target.value); setPage(1) }} className="w-52" />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table columns={columns} data={statements} loading={loading} keyExtractor={(s) => s.id} emptyTitle="No commission statements" emptyDescription="Create your first commission statement." />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Commission Statement" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Select label="Property" options={[{ value: '', label: 'Select property...' }, ...hotels.map((h) => ({ value: h.id, label: h.name }))]} {...register('hotel_id')} error={errors.hotel_id?.message} />
          <div className="grid grid-cols-3 gap-3">
            <Select label="Period type" options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'annual', label: 'Annual' },
            ]} {...register('period_type')} />
            <Input label="Period start" type="date" {...register('period_start')} error={errors.period_start?.message} />
            <Input label="Period end" type="date" {...register('period_end')} error={errors.period_end?.message} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total revenue (₱)" type="number" step="0.01" {...register('total_booking_revenue')} />
            <Input label="Eligible revenue (₱)" type="number" step="0.01" {...register('eligible_booking_revenue')} />
          </div>
          <p className="text-xs text-slate-400">Commission % is pulled from the property's active subscription plan.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Create Statement</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
