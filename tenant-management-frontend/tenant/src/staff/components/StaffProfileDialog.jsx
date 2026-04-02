import { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { toast } from 'sonner'
import api from '../../../plugins/axios'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import RolePill from './RolePill'
import DeptPill from './DeptPill'
import {
    User, Mail, Phone, Lock, Briefcase, DollarSign,
    Building2, Eye, EyeOff, X, Landmark, CreditCard, MapPin, CalendarDays
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENT_OPTIONS = [
    { value: 'accounts', label: 'Accounts' },
    { value: 'security', label: 'Security' },
    { value: 'operations', label: 'Operations' },
    { value: 'management', label: 'Management' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'other', label: 'Other' },
]

const SALARY_TYPE_OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'daily', label: 'Daily' },
    { value: 'hourly', label: 'Hourly' },
]

/** Display paisa as NPR string: 500000 → "NPR 5,000" */
function formatPaisa(paisa) {
    if (paisa == null || paisa === '') return '—'
    const rupees = Number(paisa) / 100
    return `NPR ${rupees.toLocaleString('en-NP')}`
}

/** Returns today as "YYYY-MM-DD" for <input type="date"> default */
function todayISO() {
    return new Date().toISOString().split('T')[0]
}

/** Format a Date/ISO string for display in view mode */
function formatDate(val) {
    if (!val) return '—'
    return new Date(val).toLocaleDateString('en-NP', {
        year: 'numeric', month: 'long', day: 'numeric',
    })
}

// ─── Validation ───────────────────────────────────────────────────────────────

const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    phone: Yup.string().required('Phone number is required'),
    role: Yup.string().oneOf(['admin', 'staff']).required('Role is required'),
    designation: Yup.string().required('Designation is required'),
    joiningDate: Yup.date().required('Joining date is required').typeError('Invalid date'),
    password: Yup.string().when('$isEdit', {
        is: false,
        then: (s) => s.min(8, 'Minimum 8 characters').required('Password is required'),
        otherwise: (s) => s.min(8, 'Minimum 8 characters').nullable(),
    }),
    confirmPassword: Yup.string().when('password', {
        is: (val) => val && val.length > 0,
        then: (s) => s.oneOf([Yup.ref('password')], 'Passwords must match').required('Please confirm password'),
        otherwise: (s) => s.nullable(),
    }),
    salaryAmountPaisa: Yup.number()
        .typeError('Must be a number')
        .min(0, 'Cannot be negative')
        .nullable(),
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }) {
    return (
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            {children}
        </p>
    )
}

function FormField({ label, icon: Icon, required, error, children }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {children}
            {error && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                    <X className="w-3 h-3 flex-shrink-0" />
                    {error}
                </p>
            )}
        </div>
    )
}

function ProfileField({ label, value, icon: Icon }) {
    return (
        <div className="bg-muted/40 px-4 py-3 rounded-xl border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium mb-1">
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
            </div>
            <p className="text-sm text-foreground font-semibold">{value || '—'}</p>
        </div>
    )
}

function getInitials(name) {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffProfileDialog({ open, mode, staff, onOpenChange }) {
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const isEdit = mode === 'edit'
    const isView = mode === 'view'
    const isAdd = mode === 'add'

    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            phone: '',
            role: 'staff',
            department: '',
            designation: '',
            joiningDate: todayISO(),
            salaryType: 'monthly',
            salaryAmountPaisa: '',
            bankName: '',
            accountNumber: '',
            branchName: '',
            password: '',
            confirmPassword: '',
        },
        validationSchema,
        context: { isEdit },
        onSubmit: async (values) => {
            setIsLoading(true)
            try {
                const { confirmPassword, bankName, accountNumber, branchName, salaryAmountPaisa, ...rest } = values

                const payload = {
                    ...rest,
                    ...(salaryAmountPaisa !== '' && { salaryAmountPaisa: Number(salaryAmountPaisa) }),
                    joiningDate: values.joiningDate || todayISO(),
                    bankDetails: {
                        bankName: bankName || null,
                        accountNumber: accountNumber || null,
                        branchName: branchName || null,
                    },
                }

                if (isEdit) {
                    if (!payload.password) delete payload.password
                    const res = await api.put(`/api/staff/update-staff/${staff._id}`, payload)
                    res.data.success ? toast.success(res.data.message) : toast.error(res.data.message)
                } else {
                    const res = await api.post('/api/auth/register-staff', payload)
                    res.data.success ? toast.success(res.data.message) : toast.error(res.data.message)
                }

                onOpenChange(false)
            } catch (err) {
                toast.error(err.response?.data?.message || 'Operation failed')
            } finally {
                setIsLoading(false)
            }
        },
    })

    // Populate form on open
    useEffect(() => {
        if (open && (isEdit || isView) && staff) {
            const p = staff.profile || {}
            formik.setValues({
                name: staff.name || '',
                email: staff.email || '',
                phone: staff.phone || '',
                role: staff.role || 'staff',
                department: p.department || '',
                designation: p.designation || '',
                joiningDate: p.joiningDate
                    ? new Date(p.joiningDate).toISOString().split('T')[0]
                    : todayISO(),
                salaryType: p.salaryType || 'monthly',
                salaryAmountPaisa: p.salaryAmountPaisa != null ? String(p.salaryAmountPaisa) : '',
                bankName: p.bankDetails?.bankName || '',
                accountNumber: p.bankDetails?.accountNumber || '',
                branchName: p.bankDetails?.branchName || '',
                password: '',
                confirmPassword: '',
            })
        } else if (open && isAdd) {
            formik.resetForm()
        }
    }, [open, staff, mode])

    const handleClose = () => {
        onOpenChange(false)
        formik.resetForm()
        setShowPassword(false)
        setShowConfirmPassword(false)
    }

    const dialogTitle = isEdit ? 'Edit Staff Member' : isView ? 'Staff Profile' : 'Add New Team Member'

    // Derived label for department in view mode
    const deptLabel = DEPARTMENT_OPTIONS.find(d => d.value === (staff?.profile?.department || staff?.department))?.label

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-background text-foreground sm:max-w-[620px] p-0 gap-0 overflow-hidden rounded-2xl">

                {/* ── Header ─────────────────────────────────────── */}
                <DialogHeader className="px-6 pt-6 pb-5 border-b border-border">
                    {isView && staff ? (
                        <div className="flex items-center gap-4">
                            <Avatar className="w-14 h-14 border-2 border-border shadow-sm">
                                <AvatarImage src={staff.profilePicture} />
                                <AvatarFallback className="text-base font-bold">
                                    {getInitials(staff.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle className="text-xl font-bold text-foreground leading-tight">
                                    {staff.name}
                                </DialogTitle>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <RolePill role={staff.role} />
                                    {(staff.profile?.department || staff.department) && (
                                        <DeptPill dept={staff.profile?.department || staff.department} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <DialogTitle className="text-lg font-bold text-foreground">
                            {dialogTitle}
                        </DialogTitle>
                    )}
                </DialogHeader>

                {/* ── Body ───────────────────────────────────────── */}
                <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">

                    {/* ── VIEW MODE ──────────────────────────────── */}
                    {isView && staff && (
                        <div className="space-y-5">
                            {/* Contact */}
                            <div>
                                <SectionLabel>Contact</SectionLabel>
                                <div className="grid grid-cols-2 gap-3">
                                    <ProfileField label="Email" value={staff.email} icon={Mail} />
                                    <ProfileField label="Phone" value={staff.phone} icon={Phone} />
                                </div>
                            </div>

                            {/* Role & Work */}
                            <div>
                                <SectionLabel>Role & Work</SectionLabel>
                                <div className="grid grid-cols-2 gap-3">
                                    <ProfileField label="Role" value={staff.role} icon={Briefcase} />
                                    <ProfileField label="Department" value={deptLabel} icon={Building2} />
                                    <ProfileField
                                        label="Designation"
                                        value={staff.profile?.designation}
                                        icon={User}
                                    />
                                    <ProfileField
                                        label="Joining Date"
                                        value={formatDate(staff.profile?.joiningDate)}
                                        icon={CalendarDays}
                                    />
                                </div>
                            </div>

                            {/* Salary */}
                            <div>
                                <SectionLabel>Salary</SectionLabel>
                                <div className="grid grid-cols-2 gap-3">
                                    <ProfileField
                                        label="Salary Type"
                                        value={
                                            SALARY_TYPE_OPTIONS.find(
                                                s => s.value === staff.profile?.salaryType
                                            )?.label
                                        }
                                        icon={DollarSign}
                                    />
                                    <ProfileField
                                        label="Salary Amount"
                                        value={formatPaisa(staff.profile?.salaryAmountPaisa)}
                                        icon={DollarSign}
                                    />
                                </div>
                            </div>

                            {/* Bank Details */}
                            {(staff.profile?.bankDetails?.bankName ||
                                staff.profile?.bankDetails?.accountNumber) && (
                                    <div>
                                        <SectionLabel>Bank Details</SectionLabel>
                                        <div className="grid grid-cols-3 gap-3">
                                            <ProfileField
                                                label="Bank Name"
                                                value={staff.profile.bankDetails.bankName}
                                                icon={Landmark}
                                            />
                                            <ProfileField
                                                label="Account Number"
                                                value={staff.profile.bankDetails.accountNumber}
                                                icon={CreditCard}
                                            />
                                            <ProfileField
                                                label="Branch"
                                                value={staff.profile.bankDetails.branchName}
                                                icon={MapPin}
                                            />
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}

                    {/* ── ADD / EDIT MODE ────────────────────────── */}
                    {!isView && (
                        <form onSubmit={formik.handleSubmit} className="space-y-6">

                            {/* Personal Info */}
                            <div>
                                <SectionLabel>Personal Info</SectionLabel>
                                <FormField
                                    label="Full Name"
                                    icon={User}
                                    required
                                    error={formik.touched.name && formik.errors.name}
                                >
                                    <Input
                                        name="name"
                                        placeholder="e.g. Ramesh Shrestha"
                                        value={formik.values.name}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                    />
                                </FormField>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Contact */}
                            <div>
                                <SectionLabel>Contact</SectionLabel>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        label="Email"
                                        icon={Mail}
                                        required
                                        error={formik.touched.email && formik.errors.email}
                                    >
                                        <Input
                                            name="email"
                                            type="email"
                                            placeholder="email@example.com"
                                            value={formik.values.email}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>
                                    <FormField
                                        label="Phone"
                                        icon={Phone}
                                        required
                                        error={formik.touched.phone && formik.errors.phone}
                                    >
                                        <Input
                                            name="phone"
                                            placeholder="+977 98XXXXXXXX"
                                            value={formik.values.phone}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>
                                </div>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Role & Work */}
                            <div>
                                <SectionLabel>Role & Work</SectionLabel>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        label="Role"
                                        icon={Briefcase}
                                        required
                                        error={formik.touched.role && formik.errors.role}
                                    >
                                        <Select
                                            value={formik.values.role}
                                            onValueChange={(v) => formik.setFieldValue('role', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="staff">Staff</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>

                                    <FormField
                                        label="Department"
                                        icon={Building2}
                                        error={formik.touched.department && formik.errors.department}
                                    >
                                        <Select
                                            value={formik.values.department}
                                            onValueChange={(v) => formik.setFieldValue('department', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DEPARTMENT_OPTIONS.map((d) => (
                                                    <SelectItem key={d.value} value={d.value}>
                                                        {d.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormField>

                                    <FormField
                                        label="Designation"
                                        icon={User}
                                        required
                                        error={formik.touched.designation && formik.errors.designation}
                                    >
                                        <Input
                                            name="designation"
                                            placeholder="e.g. General Manager"
                                            value={formik.values.designation}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>

                                    <FormField
                                        label="Joining Date"
                                        icon={CalendarDays}
                                        required
                                        error={formik.touched.joiningDate && formik.errors.joiningDate}
                                    >
                                        <Input
                                            name="joiningDate"
                                            type="date"
                                            max={todayISO()}
                                            value={formik.values.joiningDate}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>
                                </div>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Salary */}
                            <div>
                                <SectionLabel>Salary</SectionLabel>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        label="Salary Type"
                                        icon={DollarSign}
                                        error={formik.touched.salaryType && formik.errors.salaryType}
                                    >
                                        <Select
                                            value={formik.values.salaryType}
                                            onValueChange={(v) => formik.setFieldValue('salaryType', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SALARY_TYPE_OPTIONS.map((s) => (
                                                    <SelectItem key={s.value} value={s.value}>
                                                        {s.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormField>

                                    <FormField
                                        label="Salary Amount (NPR)"
                                        icon={DollarSign}
                                        error={formik.touched.salaryAmountPaisa && formik.errors.salaryAmountPaisa}
                                    >
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                                                NPR
                                            </span>
                                            <Input
                                                name="salaryAmountPaisa"
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={
                                                    formik.values.salaryAmountPaisa !== ''
                                                        ? Number(formik.values.salaryAmountPaisa) / 100
                                                        : ''
                                                }
                                                onChange={(e) => {
                                                    const rupees = e.target.value
                                                    formik.setFieldValue(
                                                        'salaryAmountPaisa',
                                                        rupees !== '' ? Math.round(Number(rupees) * 100) : ''
                                                    )
                                                }}
                                                onBlur={formik.handleBlur}
                                                className="pl-12"
                                            />
                                        </div>
                                        {formik.values.salaryAmountPaisa !== '' && (
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                Stored as {Number(formik.values.salaryAmountPaisa).toLocaleString()} paisa
                                            </p>
                                        )}
                                    </FormField>
                                </div>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Bank Details */}
                            <div>
                                <SectionLabel>Bank Details</SectionLabel>
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                        label="Bank Name"
                                        icon={Landmark}
                                        error={formik.touched.bankName && formik.errors.bankName}
                                    >
                                        <Input
                                            name="bankName"
                                            placeholder="e.g. NIC Asia"
                                            value={formik.values.bankName}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>

                                    <FormField
                                        label="Account Number"
                                        icon={CreditCard}
                                        error={formik.touched.accountNumber && formik.errors.accountNumber}
                                    >
                                        <Input
                                            name="accountNumber"
                                            placeholder="XXXXXXXXXXXX"
                                            value={formik.values.accountNumber}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>

                                    <FormField
                                        label="Branch"
                                        icon={MapPin}
                                        error={formik.touched.branchName && formik.errors.branchName}
                                    >
                                        <Input
                                            name="branchName"
                                            placeholder="e.g. Newroad"
                                            value={formik.values.branchName}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>
                                </div>
                            </div>

                            <div className="h-px bg-border" />

                            {/* Security */}
                            <div>
                                <SectionLabel>
                                    {isEdit ? 'Change Password (optional)' : 'Security'}
                                </SectionLabel>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        label="Password"
                                        icon={Lock}
                                        required={isAdd}
                                        error={formik.touched.password && formik.errors.password}
                                    >
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                placeholder={isEdit ? 'Leave blank to keep current' : 'Min. 8 characters'}
                                                value={formik.values.password}
                                                onChange={formik.handleChange}
                                                onBlur={formik.handleBlur}
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                tabIndex={-1}
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </FormField>

                                    <FormField
                                        label="Confirm Password"
                                        icon={Lock}
                                        required={isAdd}
                                        error={formik.touched.confirmPassword && formik.errors.confirmPassword}
                                    >
                                        <div className="relative">
                                            <Input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                name="confirmPassword"
                                                placeholder="Re-enter password"
                                                value={formik.values.confirmPassword}
                                                onChange={formik.handleChange}
                                                onBlur={formik.handleBlur}
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                tabIndex={-1}
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </FormField>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────── */}
                {!isView && (
                    <DialogFooter className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
                        <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => formik.handleSubmit()}
                            disabled={isLoading || (!formik.dirty && isEdit)}
                            className="min-w-[120px]"
                        >
                            {isLoading
                                ? <><Spinner className="w-4 h-4 mr-2" /> Saving…</>
                                : isEdit ? 'Save Changes' : 'Add Member'
                            }
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}