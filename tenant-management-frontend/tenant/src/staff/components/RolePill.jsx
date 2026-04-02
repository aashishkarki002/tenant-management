import React from 'react'

import { Badge } from '@/components/ui/badge'

import { ROLE_CONFIG } from '../constants/staffPills.constants'

export default function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.staff
  const { Icon, label, badgeVariant } = cfg

  return (
    <Badge variant={badgeVariant} className="text-[11px] font-semibold">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  )
}

