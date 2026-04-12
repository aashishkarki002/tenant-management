import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import api from '../../plugins/axios'
import StaffProfileDialog from './components/StaffProfileDialog'
import DeleteStaffDialog from './components/DeleteStaffDialog'
import StaffDrawer from './components/StaffDrawer'
import StaffRow from './components/StaffRow'
import StaffSkeletonRow from './components/StaffSkeletonRow'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, UserPlus } from 'lucide-react'
import { DEPT_CONFIG } from './constants/staffPills.constants'

export default function Staff() {
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [departmentFilter, setDepartmentFilter] = useState('all')
    const [dialogState, setDialogState] = useState({ open: false, mode: 'add', staff: null })
    const [deleteDialog, setDeleteDialog] = useState({ open: false, staff: null })
    const [drawerMember, setDrawerMember] = useState(null)

    const fetchStaff = useCallback(async (dept) => {
        try {
            setLoading(true)
            const params = dept && dept !== 'all' ? { department: dept } : undefined
            const res = await api.get('/api/staff/get-staffs', params ? { params } : undefined)
            setStaff(res.data.data || [])
        } catch {
            toast.error('Could not load staff list')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchStaff(departmentFilter) }, [fetchStaff, departmentFilter])

    const filtered = staff.filter(s => {
        const q = search.toLowerCase()
        const matchesSearch = !search ||
            s.name?.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q) ||
            s.profile?.designation?.toLowerCase().includes(q) ||
            s.profile?.department?.toLowerCase().includes(q)
        const matchesRole = roleFilter === 'all' || s.role === roleFilter
        return matchesSearch && matchesRole
    })

    const deleteStaff = async (id) => {
        try {
            const res = await api.delete(`/api/staff/delete-staff/${id}`)
            if (res.data.success) {
                toast.success(res.data.message || 'Team member removed')
                fetchStaff(departmentFilter)
                setDeleteDialog({ open: false, staff: null })
            } else toast.error(res.data.message)
        } catch (err) {
            toast.error(err.response?.data?.message || 'Couldn\'t remove team member. Please try again.')
        }
    }

    const counts = {
        total: staff.length,
        admin: staff.filter(s => s.role === 'admin').length,
        staff: staff.filter(s => s.role === 'staff').length,
        active: staff.filter(s => s.isActive !== false).length,
    }

    const FILTERS = [
        { key: 'all', label: `All ${counts.total}` },
        { key: 'admin', label: `Admins ${counts.admin}` },
        { key: 'staff', label: `Staff ${counts.staff}` },
    ]

    const DEPARTMENT_FILTERS = [
        { value: 'all', label: 'All Departments' },
        ...['accounts', 'security', 'operations', 'management', 'maintenance', 'other'].map((k) => ({
            value: k,
            label: DEPT_CONFIG[k]?.label || k,
        })),
    ]

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto px-4 sm:px-8 py-10 space-y-6">

                {/* ── Page header ── */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Team</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {counts.active} active member{counts.active !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Button
                        onClick={() => setDialogState({ open: true, mode: 'add', staff: null })}
                        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add member
                    </Button>
                </div>

                {/* ── Search + filter bar ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="relative flex-1 w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search by name, email or designation…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 bg-card border-border text-sm h-9 rounded-xl"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
                        {FILTERS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setRoleFilter(key)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${roleFilter === key
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1">
                        <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v)}>
                            <SelectTrigger className="h-9 w-44 border-0 bg-transparent shadow-none">
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent className="border-border bg-card">
                                {DEPARTMENT_FILTERS.map(({ value, label }) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ── Table ── */}
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="py-3 pl-6 pr-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                                <th className="py-3 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                                <th className="py-3 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                                <th className="py-3 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Status</th>
                                <th className="py-3 pl-4 pr-6" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? [...Array(5)].map((_, i) => <StaffSkeletonRow key={i} />)
                                : filtered.length === 0
                                    ? (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center">
                                                {staff.length === 0 ? (
                                                    <>
                                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-3">
                                                            <UserPlus className="w-5 h-5 text-primary" />
                                                        </div>
                                                        <p className="text-sm font-semibold text-foreground">No team members yet</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Add your first member to get started</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm font-semibold text-muted-foreground">
                                                            {search ? `No results for "${search}"` : 'No members match this filter'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">Try a different name, email or department</p>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                    : filtered.map(member => (
                                        <StaffRow
                                            key={member._id}
                                            member={member}
                                            onView={m => setDrawerMember(m)}
                                            onEdit={m => setDialogState({ open: true, mode: 'edit', staff: m })}
                                            onDelete={m => setDeleteDialog({ open: true, staff: m })}
                                        />
                                    ))
                            }
                        </tbody>
                    </table>
                </div>

                {!loading && filtered.length > 0 && filtered.length < staff.length && (
                    <p className="text-xs text-muted-foreground text-center">
                        Showing {filtered.length} of {staff.length} members
                    </p>
                )}
            </div>

            {/* ── Dialogs ── */}
            <StaffProfileDialog
                open={dialogState.open}
                mode={dialogState.mode}
                staff={dialogState.staff}
                onOpenChange={open => {
                    setDialogState({ open, mode: 'add', staff: null })
                    if (!open) fetchStaff(departmentFilter)
                }}
            />

            <DeleteStaffDialog
                open={deleteDialog.open}
                staff={deleteDialog.staff}
                onOpenChange={open => setDeleteDialog({ open, staff: null })}
                onConfirm={() => deleteDialog.staff && deleteStaff(deleteDialog.staff._id)}
            />

            <StaffDrawer
                member={drawerMember}
                open={!!drawerMember}
                onClose={() => setDrawerMember(null)}
                onEdit={m => {
                    setDrawerMember(null)
                    setDialogState({ open: true, mode: 'edit', staff: m })
                }}
                onDelete={m => {
                    setDrawerMember(null)
                    setDeleteDialog({ open: true, staff: m })
                }}
            />
        </div>
    )
}