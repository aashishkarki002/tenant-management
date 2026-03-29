'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Users, Trash2, Plus, Phone } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import api from '../../plugins/axios'
import { toast } from 'sonner'

import AddStaffDialog from '../Settings/components/AddStaffDialog'

function getInitials(name) {
    if (!name || typeof name !== 'string') return '?'
    return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Staff() {
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [open, setOpen] = useState(false)

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

    const filtered = (staff || []).filter(
        (s) =>
            !search ||
            s.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.email?.toLowerCase().includes(search.toLowerCase())
    )

    const deleteStaff = async (id) => {
        try {
            const res = await api.delete(`/api/staff/delete-staff/${id}`)
            if (res.data.success) {
                toast.success(res.data.message || 'Removed')
                fetchStaff()
            } else toast.error(res.data.message)
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed')
        }
    }

    return (
        <>
            <div className="mb-5">
                <p className="text-2xl font-bold">Staff Management</p>
                <p className="text-sm text-muted-foreground">Manage and view all staff members and their details</p>
            </div>
            <div className="space-y-4">

                <Card className="border-border">
                    <CardHeader className="pb-4 border-b border-border">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center">
                                    <Users className="w-3.5 h-3.5 text-white" />
                                </div>
                                Staff Members
                                <Badge variant="secondary" className="text-[11px] font-semibold">
                                    {staff?.length ?? 0}
                                </Badge>
                            </CardTitle>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-8 w-36 text-xs"
                                />
                                <Button size="sm" className="gap-2 h-8 text-xs px-3" onClick={() => setOpen(true)}>
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Staff
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-2">
                        {loading ? (
                            <p className="text-sm text-muted-foreground text-center py-10">Loading staff…</p>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    {search ? 'No matches' : 'No staff yet'}
                                </p>
                            </div>
                        ) : (
                            filtered.map((m) => (
                                <div
                                    key={m._id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 gap-3 hover:bg-secondary/60 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-9 h-9 border border-border">
                                            <AvatarImage src={m?.profilePicture} />
                                            <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                                                {getInitials(m?.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{m?.name}</p>
                                            <p className="text-[11px] text-muted-foreground">{m?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 sm:ml-auto flex-wrap">
                                        <Badge variant="outline" className="text-[10px] capitalize font-semibold">
                                            {m?.role}
                                        </Badge>
                                        {m?.phone && (
                                            <a href={`tel:${m.phone}`}>
                                                <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs px-2.5">
                                                    <Phone className="w-3 h-3" />
                                                    {m.phone}
                                                </Button>
                                            </a>
                                        )}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove {m.name}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Access will be permanently revoked.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => deleteStaff(m._id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Remove
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
                <AddStaffDialog
                    open={open}
                    onOpenChange={(o) => {
                        setOpen(o)
                        if (!o) fetchStaff()
                    }}
                />
            </div>
        </>
    )
}
