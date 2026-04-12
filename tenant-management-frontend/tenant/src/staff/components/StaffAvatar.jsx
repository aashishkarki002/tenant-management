import React from 'react'

function getInitials(name) {
  if (!name) return '?'
  return String(name)
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function StaffAvatar({ src, name, size = 'md' }) {
  const sz =
    size === 'xl'
      ? 'w-16 h-16 text-base'
      : size === 'lg'
        ? 'w-12 h-12 text-base'
        : 'w-9 h-9 text-xs'

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sz} rounded-full object-cover ring-2 ring-ring flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${sz} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary ring-2 ring-primary/20 ring-offset-0 flex-shrink-0`}
    >
      {getInitials(name)}
    </div>
  )
}

