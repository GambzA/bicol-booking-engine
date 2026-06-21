import { useCallback, useEffect, useState } from 'react'
import { auditApi } from '../../api/admin/audit'
import { Table, type Column } from '../../components/common/Table'
import { Input } from '../../components/common/Input'
import { Pagination } from '../../components/common/Pagination'
import { Modal } from '../../components/common/Modal'
import { useToast } from '../../components/common/useToast'
import type { AuditLog } from '../../types/admin'

export function AuditLogsPage() {
  const toast = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [adminId, setAdminId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const PAGE_SIZE = 30

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const r = await auditApi.list({
        entity_type: entityType || undefined,
        entity_id: entityId || undefined,
        admin_id: adminId || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setLogs(r.data.items)
      setTotal(r.data.total)
      setPages(r.data.pages)
    } catch {
      toast.error('Failed to load audit logs.')
    }
    setLoading(false)
  }, [entityType, entityId, adminId, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const columns: Column<AuditLog>[] = [
    { key: 'created_at', label: 'Time', render: (l) => new Date(l.created_at).toLocaleString() },
    { key: 'admin_id', label: 'Admin', render: (l) => l.admin_id ? l.admin_id.slice(0, 8) : '-' },
    { key: 'action', label: 'Action', render: (l) => (
      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{l.action}</code>
    )},
    { key: 'entity_type', label: 'Entity', render: (l) => (
      <span>
        <span className="capitalize">{l.entity_type}</span>
        {l.entity_id && <span className="text-slate-400 text-xs ml-1">({l.entity_id.slice(0, 8)})</span>}
      </span>
    )},
    { key: 'detail', label: '', render: (l) => (
      <button className="text-xs text-slate-500 hover:text-slate-800 underline" onClick={() => setSelected(l)}>
        Details
      </button>
    )},
  ]

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
      <p className="mt-1 text-sm text-slate-500">{total} events</p>

      <div className="mt-6 flex gap-3 flex-wrap">
        <Input
          placeholder="Entity type (hotel, invoice...)"
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1) }}
          className="w-52"
        />
        <Input
          placeholder="Entity ID..."
          value={entityId}
          onChange={(e) => { setEntityId(e.target.value); setPage(1) }}
          className="w-52"
        />
        <Input
          placeholder="Admin ID..."
          value={adminId}
          onChange={(e) => { setAdminId(e.target.value); setPage(1) }}
          className="w-52"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table columns={columns} data={logs} loading={loading} keyExtractor={(l) => l.id} emptyTitle="No audit logs" emptyDescription="Audit events from admin actions will appear here." />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Audit: ${selected?.action}`} size="lg">
        {selected && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">Before State</p>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-auto max-h-48">
                {selected.before_state ? JSON.stringify(selected.before_state, null, 2) : 'null'}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">After State</p>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-auto max-h-48">
                {selected.after_state ? JSON.stringify(selected.after_state, null, 2) : 'null'}
              </pre>
            </div>
            {selected.extra && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">Extra</p>
                <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-auto max-h-48">
                  {JSON.stringify(selected.extra, null, 2)}
                </pre>
              </div>
            )}
            {selected.remarks && (
              <p className="text-xs text-slate-500">Remarks: {selected.remarks}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
