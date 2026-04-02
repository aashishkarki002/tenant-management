import React from 'react'
import { toast } from 'sonner'
import { Mail, Phone, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

import StaffAvatar from './StaffAvatar'
import RolePill from './RolePill'
import DeptPill from './DeptPill'
import StaffStatusPill from './StaffStatusPill'

export default function StaffRow({ member, onView, onEdit, onDelete }) {
  const profile = member.profile
  const dept = profile?.department
  const designation = profile?.designation

  const handleCall = (e) => {
    e.stopPropagation()
    if (member.phone) window.location.href = `tel:${member.phone}`
    else toast.error('No phone number on record')
  }

  const handleEmail = (e) => {
    e.stopPropagation()
    window.location.href = `mailto:${member.email}`
  }

  return (
    <tr
      onClick={() => onView(member)}
      className="group border-b border-border hover:bg-muted/40 cursor-pointer transition-colors"
    >
      {/* Identity */}
      <td className="py-3.5 pl-6 pr-4">
        <div className="flex items-center gap-3">
          <StaffAvatar src={member.profilePicture} name={member.name} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">{member.name}</p>
            {designation && <p className="text-xs text-muted-foreground truncate mt-0.5">{designation}</p>}
          </div>
        </div>
      </td>

      {/* Role & Dept */}
      <td className="py-3.5 px-4">
        <div className="flex flex-col gap-1">
          <RolePill role={member.role} />
          <DeptPill dept={dept} />
        </div>
      </td>

      {/* Contact — quick CTAs */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleEmail}
            title={member.email}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-1 rounded-md transition-colors"
          >
            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="max-w-[140px] truncate hidden sm:block">{member.email}</span>
          </button>

          {member.phone && (
            <button
              onClick={handleCall}
              title={`Call ${member.phone}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-1 rounded-md transition-colors"
            >
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden md:block">{member.phone}</span>
            </button>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="py-3.5 px-4 hidden lg:table-cell">
        <StaffStatusPill isActive={member.isActive} />
      </td>

      {/* Actions */}
      <td className="py-3.5 pl-4 pr-6">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(member)
            }}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Edit
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(member)
            }}
            className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Remove
          </Button>

          <ChevronRight className="w-4 h-4 text-muted-foreground/60 ml-1" />
        </div>
      </td>
    </tr>
  )
}

