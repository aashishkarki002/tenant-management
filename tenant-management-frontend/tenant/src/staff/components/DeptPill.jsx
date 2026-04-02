import React from 'react'

import { DEPT_CONFIG } from '../constants/staffPills.constants'

function toTitleCase(str) {
  if (!str) return ''
  const s = String(str).trim()
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function DeptPill({ dept }) {
  if (!dept) return null

  const key = typeof dept === 'string' ? dept.toLowerCase() : 'other'
  const cfg = DEPT_CONFIG[key] || DEPT_CONFIG.other

  const bg = `color-mix(in oklch, ${cfg.chartVar} 12%, transparent)`
  const borderColor = `color-mix(in oklch, ${cfg.chartVar} 25%, transparent)`

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{
        backgroundColor: bg,
        borderColor,
        color: cfg.chartVar,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.chartVar }} />
      {cfg.label || toTitleCase(dept)}
    </span>
  )
}

