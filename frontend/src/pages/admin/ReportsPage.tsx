import { useState } from 'react'
import { reportsApi } from '../../api/admin/reports'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { useToast } from '../../components/common/useToast'
import type { RevenueReport } from '../../types/admin'

function defaultRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  return { start, end }
}

export function ReportsPage() {
  const toast = useToast()
  const range = defaultRange()
  const [periodStart, setPeriodStart] = useState(range.start)
  const [periodEnd, setPeriodEnd] = useState(range.end)
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = async () => {
    if (!periodStart || !periodEnd) return
    setLoading(true)
    try {
      const r = await reportsApi.revenue({ period_start: periodStart, period_end: periodEnd })
      setReport(r.data)
    } catch {
      toast.error('Failed to load revenue report.')
    }
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">Revenue and commission summary by period</p>

      <div className="mt-6 flex items-end gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Period start</p>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Period end</p>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <Button onClick={fetchReport} loading={loading}>Generate Report</Button>
      </div>

      {report && (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Subscription Revenue" value={`₱${report.subscription_revenue}`} />
            <SummaryCard label="Commission Revenue" value={`₱${report.commission_revenue}`} />
            <SummaryCard label="Total Revenue" value={`₱${report.total_revenue}`} highlighted />
          </div>
          <p className="text-xs text-slate-400">
            Period: {report.period_start} - {report.period_end}. Only paid invoices are counted.
          </p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, highlighted }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlighted ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
      <p className={`text-xs font-medium ${highlighted ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${highlighted ? 'text-white' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
