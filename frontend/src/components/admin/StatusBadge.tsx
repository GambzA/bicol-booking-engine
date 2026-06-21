import { Badge } from '../common/Badge'
import type { HotelStatus, SubscriptionStatus, InvoiceStatus, CommissionStatementStatus } from '../../types/admin'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const HOTEL_STATUS: Record<HotelStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'warning' },
  deactivated: { label: 'Deactivated', variant: 'danger' },
}

const SUB_STATUS: Record<SubscriptionStatus, { label: string; variant: BadgeVariant }> = {
  trial: { label: 'Trial', variant: 'info' },
  active: { label: 'Active', variant: 'success' },
  past_due: { label: 'Past Due', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'default' },
}

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'default' },
  sent: { label: 'Sent', variant: 'info' },
  paid: { label: 'Paid', variant: 'success' },
  overdue: { label: 'Overdue', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'default' },
  void: { label: 'Void', variant: 'default' },
}

const COMMISSION_STATUS: Record<CommissionStatementStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'default' },
  finalized: { label: 'Finalized', variant: 'success' },
}

export function HotelStatusBadge({ status }: { status: HotelStatus }) {
  const { label, variant } = HOTEL_STATUS[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge label={label} variant={variant} />
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const { label, variant } = SUB_STATUS[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge label={label} variant={variant} />
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, variant } = INVOICE_STATUS[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge label={label} variant={variant} />
}

export function CommissionStatusBadge({ status }: { status: CommissionStatementStatus }) {
  const { label, variant } = COMMISSION_STATUS[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge label={label} variant={variant} />
}
