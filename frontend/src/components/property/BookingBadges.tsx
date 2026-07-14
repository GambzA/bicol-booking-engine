import { BOOKING_STATUSES, BOOKING_PAYMENT_STATUSES, PAYMENT_RECORD_STATUSES, BOOKING_CHARGE_CATEGORIES } from '../../constants/propertyOptions'

const COLOR_CLASS: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  slate: 'bg-slate-100 text-slate-600',
  red: 'bg-red-100 text-red-700',
}

const STATUS_MAP = Object.fromEntries(BOOKING_STATUSES.map((s) => [s.value, s]))
const PAYMENT_MAP = Object.fromEntries(BOOKING_PAYMENT_STATUSES.map((s) => [s.value, s]))
const RECORD_MAP = Object.fromEntries(PAYMENT_RECORD_STATUSES.map((s) => [s.value, s]))
const CHARGE_CATEGORY_MAP = Object.fromEntries(BOOKING_CHARGE_CATEGORIES.map((c) => [c.value, c]))

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_CLASS[color] ?? COLOR_CLASS.slate}`}>
      {label}
    </span>
  )
}

export function BookingStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status]
  return <Pill label={s?.label ?? status} color={s?.color ?? 'slate'} />
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = PAYMENT_MAP[status]
  return <Pill label={s?.label ?? status} color={s?.color ?? 'slate'} />
}

export function PaymentRecordBadge({ status }: { status: string }) {
  const s = RECORD_MAP[status]
  return <Pill label={s?.label ?? status} color={s?.color ?? 'slate'} />
}

export function ChargeCategoryBadge({ category }: { category: string }) {
  const c = CHARGE_CATEGORY_MAP[category]
  return <Pill label={c?.label ?? category} color={c?.color ?? 'slate'} />
}
