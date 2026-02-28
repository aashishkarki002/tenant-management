import React, { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import {
    Drawer, DrawerTrigger, DrawerContent,
    DrawerHeader, DrawerTitle, DrawerClose
} from '@/components/ui/drawer'
import {
    Dialog, DialogTrigger, DialogContent, DialogHeader,
    DialogTitle, DialogClose, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { useFormik } from 'formik'
import api from '../../../plugins/axios'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import {
    Globe, Lock, Save, User, CreditCard, Mail, Phone,
    MapPin, Building, Plus, Trash2, Pencil, Camera,
    Upload, Trash, ImageOff, Loader2
} from "lucide-react";
import AddBankAccount from './AddBankAccount'
import EditBankAccount from './EditBankAccount'

// ─── Avatar with dropdown ─────────────────────────────────────────────────────
function ProfileAvatar({ user, onUpdated }) {
    const fileInputRef = useRef(null)
    const [preview, setPreview] = useState(null)          // local blob preview
    const [pendingFile, setPendingFile] = useState(null)  // File object awaiting upload
    const [uploading, setUploading] = useState(false)
    const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)

    // Reset preview when user prop changes (e.g. after save)
    useEffect(() => {
        setPreview(null)
        setPendingFile(null)
    }, [user?.profilePicture])

    const displaySrc = preview || user?.profilePicture || null
    const initials = user?.name
        ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
        : "?"

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5 MB")
            return
        }
        setPendingFile(file)
        setPreview(URL.createObjectURL(file))
        // Reset input so same file can be re-selected
        e.target.value = ""
    }

    const handleUpload = async () => {
        if (!pendingFile) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("profilePicture", pendingFile)
            // Do NOT set Content-Type: axios sets multipart/form-data with boundary automatically
            const res = await api.patch("/api/auth/update-profile-picture", formData)
            if (res.data.success) {
                toast.success("Profile picture updated")
                setPendingFile(null)
                setPreview(null)
                onUpdated?.()
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || "Upload failed")
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = async () => {
        setUploading(true)
        try {
            const res = await api.patch("/api/auth/remove-profile-picture")
            if (res.data.success) {
                toast.success("Profile picture removed")
                setConfirmRemoveOpen(false)
                onUpdated?.()
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || "Remove failed")
        } finally {
            setUploading(false)
        }
    }

    const cancelPreview = () => {
        setPreview(null)
        setPendingFile(null)
    }

    return (
        <div className="flex flex-col items-center gap-3">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Avatar + dropdown trigger */}
            <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100 flex items-center justify-center">
                    {displaySrc ? (
                        <img
                            src={displaySrc}
                            alt={user?.name || "Profile"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-2xl font-bold text-slate-400">{initials}</span>
                    )}
                </div>

                {/* Camera icon overlay — opens dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="
                                absolute inset-0 rounded-full
                                bg-black/0 hover:bg-black/40
                                flex items-center justify-center
                                opacity-0 group-hover:opacity-100
                                transition-all duration-200
                                cursor-pointer
                            "
                            aria-label="Change profile picture"
                        >
                            <Camera className="w-6 h-6 text-white drop-shadow" />
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="center" className="w-44">
                        <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-4 h-4" />
                            Change photo
                        </DropdownMenuItem>

                        {(user?.profilePicture || preview) && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
                                    onClick={() => {
                                        if (preview) {
                                            cancelPreview()
                                        } else {
                                            setConfirmRemoveOpen(true)
                                        }
                                    }}
                                >
                                    <Trash className="w-4 h-4" />
                                    {preview ? "Cancel preview" : "Remove photo"}
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Pending upload bar */}
            {pendingFile && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
                    <ImageOff className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-[140px]">{pendingFile.name}</span>
                    <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs ml-1"
                        disabled={uploading}
                        onClick={handleUpload}
                    >
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                    </Button>
                    <button
                        type="button"
                        onClick={cancelPreview}
                        className="text-blue-400 hover:text-blue-600 ml-1"
                    >
                        ✕
                    </button>
                </div>
            )}

            <p className="text-xs text-slate-400">Click avatar to change</p>

            {/* Confirm remove dialog */}
            <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Profile Picture</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove your profile picture? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmRemoveOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" disabled={uploading} onClick={handleRemove}>
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── Main SettingTab ──────────────────────────────────────────────────────────
function SettingTab({
    user,
    bankAccounts = [],
    bankAccountFormik,
    languages,
    selectedLanguage,
    setSelectedLanguage,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordError,
    passwordSuccess,
    handlePasswordChange,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    setAccountToDelete,
    confirmDelete,
    handleDeleteClick,
    GetBankAccounts,
    addBankCloseRef,
}) {
    const usemobile = useIsMobile()
    const { fetchMe } = useAuth()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)

    useEffect(() => {
        if (!addBankCloseRef) return
        addBankCloseRef.current = () => {
            setDrawerOpen(false)
            setDialogOpen(false)
        }
        return () => { addBankCloseRef.current = null }
    }, [addBankCloseRef])

    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [accountToEdit, setAccountToEdit] = useState(null)

    const editBankFormik = useFormik({
        enableReinitialize: true,
        initialValues: {
            accountNumber: accountToEdit?.accountNumber || "",
            accountName: accountToEdit?.accountName || "",
            bankName: accountToEdit?.bankName || "",
            accountCode: accountToEdit?.accountCode || "",
        },
        onSubmit: async (values) => {
            if (!accountToEdit?._id) return
            try {
                const res = await api.patch(`/api/bank/update-bank-account/${accountToEdit._id}`, {
                    accountNumber: values.accountNumber,
                    accountName: values.accountName,
                    bankName: values.bankName,
                    accountCode: values.accountCode?.trim()
                        ? values.accountCode.toUpperCase().trim()
                        : undefined,
                })
                if (res.data.success) {
                    toast.success(res.data.message)
                    setEditDialogOpen(false)
                    setAccountToEdit(null)
                    GetBankAccounts?.()
                }
            } catch (error) {
                toast.error(error?.response?.data?.message || "Failed to update bank account")
            }
        },
    })

    const handleEditClick = (account) => {
        setAccountToEdit(account)
        setEditDialogOpen(true)
    }

    const formik = useFormik({
        enableReinitialize: true,
        initialValues: {
            name: user?.name || "",
            email: user?.email || "",
            phone: user?.phone || "",
            address: user?.address || "",
            company: user?.company || "",
        },
        onSubmit: async (values) => {
            try {
                const res = await api.patch("/api/auth/update-admin", values)
                if (res.data.success) {
                    toast.success(res.data.message)
                    setIsEditingProfile(false)
                    await fetchMe(true)
                }
            } catch (error) {
                toast.error(error?.response?.data?.message || "Failed to update profile")
            }
        },
    })

    return (
        <div className="space-y-6">

            {/* ── Administrator Profile Card ─────────────────────────────── */}
            <Card>
                <form onSubmit={formik.handleSubmit}>
                    <div className="space-y-6 p-4">

                        {/* Header */}
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-900">Administrator Profile</h4>
                                <p className="text-sm text-slate-500">
                                    These details will be used for official communications
                                </p>
                            </div>
                        </div>

                        {/* Avatar + fields layout */}
                        <div className="flex flex-col sm:flex-row gap-8 items-start">

                            {/* Left: Avatar */}
                            <div className="flex flex-col items-center self-center sm:self-start shrink-0">
                                <ProfileAvatar user={user} onUpdated={() => fetchMe(true)} />
                            </div>

                            {/* Right: Fields */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <User className="w-4 h-4" /> Full Name
                                    </label>
                                    <Input
                                        name="name"
                                        value={formik.values.name}
                                        onChange={formik.handleChange}
                                        readOnly={!isEditingProfile}
                                        className={!isEditingProfile ? "bg-slate-50" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Mail className="w-4 h-4" /> Email Address
                                    </label>
                                    <Input
                                        name="email"
                                        value={formik.values.email}
                                        onChange={formik.handleChange}
                                        readOnly={!isEditingProfile}
                                        className={!isEditingProfile ? "bg-slate-50" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Phone className="w-4 h-4" /> Phone Number
                                    </label>
                                    <Input
                                        name="phone"
                                        value={formik.values.phone}
                                        onChange={formik.handleChange}
                                        readOnly={!isEditingProfile}
                                        className={!isEditingProfile ? "bg-slate-50" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <Building className="w-4 h-4" /> Company Name
                                    </label>
                                    <Input
                                        name="company"
                                        value={formik.values.company}
                                        onChange={formik.handleChange}
                                        readOnly={!isEditingProfile}
                                        className={!isEditingProfile ? "bg-slate-50" : ""}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Office Address
                                    </label>
                                    <Input
                                        name="address"
                                        value={formik.values.address}
                                        onChange={formik.handleChange}
                                        readOnly={!isEditingProfile}
                                        className={!isEditingProfile ? "bg-slate-50" : ""}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 flex gap-3">
                            {!isEditingProfile ? (
                                <Button type="button" onClick={(e) => {
                                    e.preventDefault()
                                    setIsEditingProfile(true)
                                }}>
                                    Edit Profile
                                </Button>
                            ) : (
                                <>
                                    <Button type="submit" icon={Save} disabled={formik.isSubmitting}>
                                        {formik.isSubmitting ? "Saving..." : "Save Changes"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            formik.resetForm()
                                            setIsEditingProfile(false)
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </form>
            </Card>

            {/* ── Bank Accounts Card ─────────────────────────────────────── */}
            <Card>
                <div className="space-y-6 p-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900">Financial Accounts</h4>
                            <p className="text-sm text-slate-500">Configure bank details for automated payments</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {bankAccounts.map((account) => (
                            <div
                                key={account._id}
                                className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                        <Building className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-slate-900">{account.bankName}</h5>
                                        <p className="text-xs text-slate-500">
                                            {account.accountName} • {account.accountNumber}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                        onClick={() => handleEditClick(account)}
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => handleDeleteClick(account._id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-2">
                        {usemobile ? (
                            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                                <DrawerTrigger asChild>
                                    <Button variant="outline" icon={Plus} onClick={() => setDrawerOpen(true)}>
                                        Add New Bank Account
                                    </Button>
                                </DrawerTrigger>
                                <DrawerContent>
                                    <DrawerHeader>
                                        <DrawerTitle>Add New Bank Account</DrawerTitle>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Add the bank account details for rent collection and security deposits
                                        </p>
                                    </DrawerHeader>
                                    <div className="px-4 pb-4">
                                        <AddBankAccount formik={bankAccountFormik} />
                                        <DrawerClose asChild>
                                            <Button type="button" variant="ghost" className="w-full mt-2">Cancel</Button>
                                        </DrawerClose>
                                    </div>
                                </DrawerContent>
                            </Drawer>
                        ) : (
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" icon={Plus}>Add New Bank Account</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add New Bank Account</DialogTitle>
                                        <DialogDescription>
                                            Add the bank account details for rent collection and security deposits
                                        </DialogDescription>
                                    </DialogHeader>
                                    <AddBankAccount formik={bankAccountFormik} />
                                    <div className="flex justify-end pt-2">
                                        <DialogClose asChild>
                                            <Button type="button" variant="ghost">Cancel</Button>
                                        </DialogClose>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>
            </Card>

            {/* ── Security / Password Card ───────────────────────────────── */}
            <Card>
                <form onSubmit={handlePasswordChange} className="space-y-4 p-4">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Lock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900">Change Password</h4>
                            <p className="text-sm text-slate-500">Ensure your password is strong and secure</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-2">
                                Current Password
                            </label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter your current password"
                            />
                        </div>
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">
                                New Password
                            </label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter your new password"
                            />
                            <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters long</p>
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                                Confirm New Password
                            </label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your new password"
                            />
                        </div>

                        {passwordError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {passwordError}
                            </div>
                        )}
                        {passwordSuccess && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                                Password changed successfully!
                            </div>
                        )}

                        <div className="pt-2 flex space-x-3">
                            <Button type="submit" icon={Save}>Update Password</Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setCurrentPassword("")
                                    setNewPassword("")
                                    setConfirmPassword("")
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>

            {/* ── Edit Bank Account Dialog ───────────────────────────────── */}
            <Dialog open={editDialogOpen} onOpenChange={(open) => {
                setEditDialogOpen(open)
                if (!open) setAccountToEdit(null)
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Bank Account</DialogTitle>
                        <DialogDescription>Update account details. Balance cannot be changed.</DialogDescription>
                    </DialogHeader>
                    <EditBankAccount
                        formik={editBankFormik}
                        balanceDisplay={accountToEdit
                            ? (accountToEdit.balanceFormatted ?? accountToEdit.balance ?? "-")
                            : ""}
                        onCancel={() => {
                            setEditDialogOpen(false)
                            setAccountToEdit(null)
                        }}
                    />
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm Dialog ──────────────────────────────────── */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Bank Account</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this bank account? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setDeleteConfirmOpen(false)
                            setAccountToDelete(null)
                        }}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default SettingTab