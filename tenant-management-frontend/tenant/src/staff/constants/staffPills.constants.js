import { ShieldCheck, Users } from 'lucide-react'

export const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    Icon: ShieldCheck,
    badgeVariant: 'default',
  },
  staff: {
    label: 'Staff',
    Icon: Users,
    badgeVariant: 'secondary',
  },
}

// Dept pills use the design-system chart tokens defined in `src/index.css`:
// `--chart-1`..`--chart-5`.
export const DEPT_CONFIG = {
  accounts: { label: 'Accounts', chartVar: 'var(--chart-2)' },
  security: { label: 'Security', chartVar: 'var(--chart-4)' },
  operations: { label: 'Operations', chartVar: 'var(--chart-3)' },
  management: { label: 'Management', chartVar: 'var(--chart-1)' },
  maintenance: { label: 'Maintenance', chartVar: 'var(--chart-5)' },
  other: { label: 'Other', chartVar: 'var(--chart-2)' },
}

