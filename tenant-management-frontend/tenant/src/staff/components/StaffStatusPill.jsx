import React from 'react'

export default function StaffStatusPill({ isActive }) {
  const active = isActive !== false

  if (active) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2 py-0.5 border"
        style={{
          backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)',
          borderColor: 'color-mix(in oklch, var(--color-success) 25%, transparent)',
          color: 'var(--color-success)',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
        Active
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2 py-0.5 border text-muted-foreground"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-muted-fill" />
      Inactive
    </span>
  )
}

