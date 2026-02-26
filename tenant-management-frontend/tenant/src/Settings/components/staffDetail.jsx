import React, { useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Plus, Users, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import AddStaffDialog from './AddStaffDialog'
import api from '../../../plugins/axios'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Phone } from 'lucide-react'
function StaffDetail({ staff }) {
    const [open, setOpen] = useState(false)

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?'
        return name
            .trim()
            .split(/\s+/)
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    const handleDelete = async (id) => {
        try {
            const res = await api.delete(`/api/staff/delete-staff/${id}`)
            if (res.data.success) {
                toast.success(res.data.message || 'Staff deleted successfully')
                // Ideally refetch in parent; for now just log.
            } else {
                toast.error(res.data.message || 'Failed to delete staff')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete staff')
        }
    }
    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
                    <p className="text-slate-500">
                        Manage and view your staff details
                    </p>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                        type="text"
                        placeholder="Search staff"
                        className="w-full"
                    />

                    <Button
                        onClick={() => setOpen(true)}
                        className="text-white w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Staff Member
                    </Button>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {!staff || staff.length === 0 ? (
                    <Card className="flex items-center gap-3 px-6 py-4 border-border">
                        <Users className="w-10 h-10 text-gray-400" />
                        <CardContent className="p-0">
                            <p className="text-base font-medium text-slate-700">
                                No staff found
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    staff.map((member) => (
                        <Card
                            key={member._id}
                            className="px-4 sm:px-6 py-4 border-border rounded-2xl shadow-sm"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

                                {/* Left: Avatar + Name */}
                                <div className="flex items-center gap-4">
                                    <Avatar className="w-10 h-10 bg-accent/20 text-black font-semibold">
                                        <AvatarFallback className="text-black">
                                            {getInitials(member?.name)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {member?.name}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {member?.role || "staff"}
                                        </p>
                                    </div>
                                </div>

                                {/* Middle: Email / Phone */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-16 flex-1">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                            Email
                                        </p>
                                        <p className="text-sm text-slate-900 break-all">
                                            {member?.email}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                            Phone
                                        </p>

                                        <div className="flex items-center gap-3">
                                            <p className="text-sm text-slate-900">
                                                {member?.phone}
                                            </p>

                                            {member?.phone && (
                                                <a href={`tel:${member.phone}`} className="w-full sm:w-auto">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="gap-2 w-full sm:w-auto"
                                                    >
                                                        <Phone className="w-4 h-4" />
                                                        Call
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center justify-start lg:justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-border hover:bg-destructive/10 hover:text-destructive gap-1 w-full sm:w-auto"
                                        onClick={() => handleDelete(member._id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete</span>
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>


        </>
    )
}

export default StaffDetail