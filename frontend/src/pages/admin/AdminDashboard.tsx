import { useCallback, useEffect, useState } from 'react'
import { Building2, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { reportsApi } from '../../api/admin/reports'
import { StatCard } from '../../components/admin/StatCard'
import { PageLoader } from '../../components/common/PageLoader'
import { useToast } from '../../components/common/useToast'
import type { PlatformOverview } from '../../types/admin'

export function AdminDashboard() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const r = await reportsApi.overview()
      setOverview(r.data)
    } catch {
      toast.error('Failed to load overview.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  if (loading) return <PageLoader />

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Platform overview</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Properties"
          value={overview?.total_properties ?? 0}
          icon={<Building2 size={24} />}
        />
        <StatCard
          title="Active Properties"
          value={overview?.active_properties ?? 0}
          icon={<CheckCircle size={24} />}
          variant="default"
        />
        <StatCard
          title="Suspended Properties"
          value={overview?.suspended_properties ?? 0}
          icon={<AlertCircle size={24} />}
          variant={overview?.suspended_properties ? 'warning' : 'default'}
        />
        <StatCard
          title="Active Subscriptions"
          value={overview?.active_subscriptions ?? 0}
        />
        <StatCard
          title="Overdue Invoices"
          value={overview?.overdue_invoices_count ?? 0}
          description={`₱${overview?.overdue_invoices_amount ?? '0.00'} outstanding`}
          icon={<FileText size={24} />}
          variant={overview?.overdue_invoices_count ? 'danger' : 'default'}
        />
      </div>
    </div>
  )
}
