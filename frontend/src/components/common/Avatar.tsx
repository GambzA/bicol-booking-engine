interface AvatarProps {
  name: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' }

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name} className={`${sizeClasses[size]} rounded-full object-cover`} />
  }
  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-slate-200 font-medium text-slate-600`}>
      {initials(name)}
    </div>
  )
}
