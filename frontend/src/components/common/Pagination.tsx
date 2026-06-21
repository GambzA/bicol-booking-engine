import { Button } from './Button'

interface PaginationProps {
  page: number
  pages: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}

export function Pagination({ page, pages, total, pageSize, onPage }: PaginationProps) {
  if (pages <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-500">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
