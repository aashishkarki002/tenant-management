import React from 'react'

import { Badge } from '@/components/ui/badge'

import { ROLE_CONFIG } from '../constants/staffPills.constants'

export default function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.staff
  const { Icon, label, badgeVariant } = cfg

  // Admin → bold petrol (default variant). Staff → light petrol tint so it's
  // visible against the card surface but clearly subordinate to Admin.
  const staffOverride = role !== 'admin'
    ? 'bg-accent text-accent-foreground border-0'
    : ''

  return (
    <Badge variant={badgeVariant} className={`text-[11px] font-semibold ${staffOverride}`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  )
}

