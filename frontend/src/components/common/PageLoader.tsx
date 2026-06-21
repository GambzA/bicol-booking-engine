import { LoadingSpinner } from './LoadingSpinner'

export function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <LoadingSpinner size="lg" />
    </div>
  )
}
