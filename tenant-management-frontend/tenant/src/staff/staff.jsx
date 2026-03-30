import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import api from '../../plugins/axios'
import StaffProfileDialog from './components/StaffProfileDialog'
import DeleteStaffDialog from './components/DeleteStaffDialog'

import { Users, TrendingUp, Clock, Mail, Phone, Eye, Edit, Trash2, Grid3x3, List } from 'lucide-react'

function getInitials(name) {
    if (!name) return '?'
    return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Staff() {
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [viewMode, setViewMode] = useState('grid')
    const [dialogState, setDialogState] = useState({ open: false, mode: 'add', staff: null })
    const [deleteDialog, setDeleteDialog] = useState({ open: false, staff: null })

    const fetchStaff = useCallback(async () => {
        try {
            const res = await api.get('/api/staff/get-staffs')
            setStaff(res.data.data || [])
        } catch {
            toast.error('Could not load staff list')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStaff()
    }, [fetchStaff])

    const filtered = staff.filter(s => {
        const matchesSearch =
            !search ||
            s.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.email?.toLowerCase().includes(search.toLowerCase())
        const matchesRole = roleFilter === 'all' || s.role === roleFilter
        return matchesSearch && matchesRole
    })

    const deleteStaff = async (id) => {
        try {
            const res = await api.delete(`/api/staff/delete-staff/${id}`)
            if (res.data.success) {
                toast.success(res.data.message || 'Staff removed')
                fetchStaff()
                setDeleteDialog({ open: false, staff: null })
            } else toast.error(res.data.message)
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to remove staff')
        }
    }

    const statsData = [
        { label: 'Total', value: staff.length, icon: Users, color: 'text-blue-600', trend: '+12%' },
        { label: 'Admins', value: staff.filter(s => s.role === 'admin').length, icon: TrendingUp, color: 'text-gray-600', trend: '+8%' },
        { label: 'Staff', value: staff.filter(s => s.role === 'staff').length, icon: Clock, color: 'text-green-600', trend: '+15%' },
    ]

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            <div className="max-w-[1400px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-text-strong">Team Directory</h1>
                        <p className="text-sm text-slate-500 mt-1">{staff.length} {staff.length === 1 ? 'member' : 'members'}</p>
                    </div>
                    <Button onClick={() => setDialogState({ open: true, mode: 'add', staff: null })} size="lg">
                        Add Member
                    </Button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {statsData.map((stat) => (
                        <div key={stat.label} className="bg-surface-raised rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <p className="text-sm text-text-sub">{stat.label}</p>
                                <h2 className="text-xl font-bold text-text-strong">{stat.value}</h2>
                                <p className="text-xs text-text-sub mt-0.5">{stat.trend} vs last week</p>
                            </div>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                    ))}
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <Input
                        placeholder="Search by name or email"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 max-w-md"
                    />
                    <div className="flex items-center gap-2">
                        {['all', 'admin', 'staff'].map((role) => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition ${roleFilter === role
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-surface-muted text-text-body hover:bg-surface-muted/80'
                                    }`}
                            >
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                            </button>
                        ))}
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                        >
                            <Grid3x3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Staff Grid */}
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>
                    {loading
                        ? Array.from({ length: viewMode === 'grid' ? 6 : 4 }).map((_, idx) => (
                            <div key={idx} className="bg-surface-raised rounded-xl p-6 animate-pulse h-36"></div>
                        ))
                        : filtered.map((member) => (
                            <div
                                key={member._id}
                                className="bg-surface-raised rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center gap-3"
                            >
                                <Avatar className="w-16 h-16">
                                    <AvatarImage src={member.profilePicture} />
                                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                </Avatar>
                                <h3 className="font-semibold text-text-strong">{member.name}</h3>
                                <Badge className={`capitalize ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {member.role}
                                </Badge>
                                <p className="text-sm text-text-sub truncate">{member.email}</p>
                                {member.phone && <p className="text-sm text-text-sub">{member.phone}</p>}
                                <div className="flex gap-2 mt-2">
                                    <Button size="sm" variant="outline" onClick={() => setDialogState({ open: true, mode: 'view', staff: member })}>
                                        <Eye className="w-4 h-4 mr-1" /> View
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setDialogState({ open: true, mode: 'edit', staff: member })}>
                                        <Edit className="w-4 h-4 mr-1" /> Edit
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => setDeleteDialog({ open: true, staff: member })}>
                                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                                    </Button>
                                </div>
                            </div>
                        ))}
                </div>

                {/* Dialogs */}
                <StaffProfileDialog
                    open={dialogState.open}
                    mode={dialogState.mode}
                    staff={dialogState.staff}
                    onOpenChange={(open) => {
                        setDialogState({ open, mode: 'add', staff: null })
                        if (!open) fetchStaff()
                    }}
                />

                <DeleteStaffDialog
                    open={deleteDialog.open}
                    staff={deleteDialog.staff}
                    onOpenChange={(open) => setDeleteDialog({ open, staff: null })}
                    onConfirm={() => deleteDialog.staff && deleteStaff(deleteDialog.staff._id)}
                />
            </div>
        </div>
    )
}