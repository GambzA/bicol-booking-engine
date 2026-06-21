import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { propertiesApi } from '../../api/admin/properties'
import { Button } from '../../components/common/Button'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { HotelStatusBadge, SubscriptionStatusBadge } from '../../components/admin/StatusBadge'
import { PageLoader } from '../../components/common/PageLoader'
import { useToast } from '../../components/common/useToast'
import type { Hotel } from '../../types/admin'

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | 'deactivate' | null>(null)

  const fetchHotel = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await propertiesApi.get(id)
      setHotel(r.data)
    } catch {
      toast.error('Failed to load property.')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchHotel() }, [fetchHotel])

  const handleAction = async (action: 'suspend' | 'reactivate' | 'deactivate') => {
    if (!id) return
    setActionLoading(true)
    try {
      if (action === 'suspend') await propertiesApi.suspend(id, 'Admin action')
      else if (action === 'reactivate') await propertiesApi.reactivate(id, 'Admin action')
      else await propertiesApi.deactivate(id, 'Admin action')
      toast.success(`Property ${action}d.`)
      if (action === 'deactivate') { navigate('/admin/properties'); return }
      await fetchHotel()
    } catch {
      toast.error('Action failed.')
    }
    setActionLoading(false)
    setConfirmAction(null)
  }

  if (loading) return <PageLoader />
  if (!hotel) return null

  const sub = hotel.subscription

  return (
    <div className="p-8">
      <button onClick={() => navigate('/admin/properties')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={14} /> Back to Properties
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{hotel.name}</h1>
            <HotelStatusBadge status={hotel.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{hotel.email}</p>
        </div>
        <div className="flex gap-2">
          {hotel.status === 'active' && (
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('suspend')}>Suspend</Button>
          )}
          {hotel.status === 'suspended' && (
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('reactivate')}>Reactivate</Button>
          )}
          {hotel.status !== 'deactivated' && (
            <Button variant="danger" size="sm" onClick={() => setConfirmAction('deactivate')}>Deactivate</Button>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Property Information</h2>
          <dl className="mt-4 space-y-3">
            <Row label="Name" value={hotel.name} />
            <Row label="Email" value={hotel.email} />
            <Row label="Phone" value={hotel.phone ?? '-'} />
            <Row label="Address" value={hotel.address ?? '-'} />
            <Row label="City" value={hotel.city ?? '-'} />
            <Row label="Country" value={hotel.country} />
            <Row label="Registered" value={new Date(hotel.created_at).toLocaleDateString()} />
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Subscription</h2>
          {sub ? (
            <dl className="mt-4 space-y-3">
              <Row label="Plan" value={sub.plan?.name ?? '-'} />
              <Row label="Status" value={<SubscriptionStatusBadge status={sub.status} />} />
              <Row label="Billing cycle" value={sub.billing_cycle} />
              <Row label="Start date" value={sub.start_date} />
              <Row label="Next billing" value={sub.next_billing_date} />
              {sub.trial_end_date && <Row label="Trial ends" value={sub.trial_end_date} />}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No subscription assigned.</p>
          )}
        </div>

        {hotel.users && hotel.users.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-700">Users</h2>
            <table className="mt-4 min-w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Name</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Email</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {hotel.users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 text-sm text-slate-700">{u.full_name}</td>
                    <td className="py-2 text-sm text-slate-500">{u.email}</td>
                    <td className="py-2 text-sm capitalize text-slate-500">{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === 'suspend'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('suspend')}
        title="Suspend Property"
        message="This will prevent hotel staff from logging in. You can reactivate later."
        confirmLabel="Suspend"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'reactivate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('reactivate')}
        title="Reactivate Property"
        message="Hotel staff will regain access."
        confirmLabel="Reactivate"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'deactivate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleAction('deactivate')}
        title="Deactivate Property"
        message="This is a permanent soft deletion. The property will no longer appear in the platform."
        confirmLabel="Deactivate"
        loading={actionLoading}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 flex-shrink-0 text-xs font-medium text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  )
}
