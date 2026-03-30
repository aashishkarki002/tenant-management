'use client'

import { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { toast } from 'sonner'
import api from '../../../plugins/axios'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import {
    User, Mail, Phone, Lock, Briefcase, DollarSign, Building2,
    ArrowLeft, ArrowRight, Check, Eye, EyeOff, Upload, X
} from 'lucide-react'

const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    phone: Yup.string().required('Phone number is required'),
    role: Yup.string().oneOf(['admin', 'staff']).required('Role is required'),
    password: Yup.string().when('$isEdit', {
        is: false,
        then: (schema) => schema.min(8, 'Minimum 8 characters').required('Password is required'),
        otherwise: (schema) => schema.min(8, 'Minimum 8 characters').nullable(),
    }),
    confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Passwords must match'),
})

export default function StaffProfileSheet({ open, mode, staff, onOpenChange }) {
    const [isLoading, setIsLoading] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const isEdit = mode === 'edit'
    const isView = mode === 'view'

    const steps = [
        { id: 'personal', label: 'Personal', icon: User },
        { id: 'contact', label: 'Contact', icon: Mail },
        { id: 'role', label: 'Role & Meta', icon: Briefcase },
        ...(!isEdit ? [{ id: 'security', label: 'Security', icon: Lock }] : []),
    ]

    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            phone: '',
            role: 'staff',
            password: '',
            confirmPassword: '',
            salary: '',
            department: '',
        },
        validationSchema,
        context: { isEdit },
        onSubmit: async (values) => {
            setIsLoading(true)
            try {
                const { confirmPassword, ...payload } = values
                if (isEdit) {
                    const cleanPayload = { ...payload }
                    if (!cleanPayload.password) delete cleanPayload.password
                    const res = await api.put(`/api/staff/update-staff/${staff._id}`, cleanPayload)
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

    useEffect(() => {
        if (open && (isEdit || isView) && staff) {
            formik.setValues({
                name: staff.name || '',
                email: staff.email || '',
                phone: staff.phone || '',
                role: staff.role || 'staff',
                password: '',
                confirmPassword: '',
                salary: staff.salary || '',
                department: staff.department || '',
            })
        } else if (open && mode === 'add') {
            formik.resetForm()
            setCurrentStep(0)
        }
    }, [open, staff, mode])

    const handleClose = () => {
        onOpenChange(false)
        formik.resetForm()
        setCurrentStep(0)
        setShowPassword(false)
        setShowConfirmPassword(false)
    }

    const canProceedToNext = () => {
        if (currentStep === 0) return formik.values.name && !formik.errors.name
        if (currentStep === 1) return formik.values.email && formik.values.phone && !formik.errors.email && !formik.errors.phone
        if (currentStep === 2) return formik.values.role && !formik.errors.role
        return true
    }

    const getInitials = (name) =>
        name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    return (
        <Sheet open={open} onOpenChange={handleClose} position="right" size="lg">
            <SheetContent className="flex flex-col bg-background">
                <SheetHeader className="px-6 pt-6 pb-0">
                    <SheetTitle className="flex items-center justify-between">
                        <span className="text-xl font-bold text-slate-900">
                            {isEdit ? 'Edit Staff' : isView ? 'Staff Profile' : 'New Team Member'}
                        </span>
                        <Button variant="ghost" size="sm" onClick={handleClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </SheetTitle>
                    {isView && staff && (
                        <div className="mt-4 flex items-center gap-4">
                            <Avatar className="w-16 h-16 border border-slate-200 shadow">
                                <AvatarImage src={staff.profilePicture} />
                                <AvatarFallback>{getInitials(staff.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-semibold text-slate-900 text-lg">{staff.name}</h3>
                                <Badge className="mt-1">{staff.role}</Badge>
                            </div>
                        </div>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    {!isView && (
                        <form onSubmit={formik.handleSubmit} className="space-y-6">
                            {currentStep === 0 && (
                                <FormField label="Full Name" icon={User} required error={formik.touched.name && formik.errors.name}>
                                    <Input
                                        name="name"
                                        placeholder="Enter full name"
                                        value={formik.values.name}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                    />
                                </FormField>
                            )}
                            {currentStep === 1 && (
                                <>
                                    <FormField label="Email" icon={Mail} required error={formik.touched.email && formik.errors.email}>
                                        <Input
                                            name="email"
                                            placeholder="email@example.com"
                                            value={formik.values.email}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>
                                    <FormField label="Phone" icon={Phone} required error={formik.touched.phone && formik.errors.phone}>
                                        <Input
                                            name="phone"
                                            placeholder="+1 555-000-0000"
                                            value={formik.values.phone}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>
                                </>
                            )}
                            {currentStep === 2 && (
                                <>
                                    <FormField label="Role" icon={Briefcase} required error={formik.touched.role && formik.errors.role}>
                                        <Select value={formik.values.role} onValueChange={(v) => formik.setFieldValue('role', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="staff">Staff</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                    <FormField label="Department" icon={Building2} error={formik.touched.department && formik.errors.department}>
                                        <Input
                                            name="department"
                                            placeholder="Operations, Finance..."
                                            value={formik.values.department}
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                        />
                                    </FormField>
                                    <FormField label="Salary Type" icon={DollarSign} error={formik.touched.salary && formik.errors.salary}>
                                        <Select value={formik.values.salary} onValueChange={(v) => formik.setFieldValue('salary', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select salary type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="daily">Daily</SelectItem>
                                                <SelectItem value="hourly">Hourly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                </>
                            )}
                            {currentStep === 3 && !isEdit && (
                                <>
                                    <FormField label="Password" icon={Lock} required error={formik.touched.password && formik.errors.password}>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                placeholder="Create password"
                                                value={formik.values.password}
                                                onChange={formik.handleChange}
                                                onBlur={formik.handleBlur}
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            >
                                                {showPassword ? <EyeOff /> : <Eye />}
                                            </button>
                                        </div>
                                    </FormField>
                                    <FormField label="Confirm Password" icon={Lock} required error={formik.touched.confirmPassword && formik.errors.confirmPassword}>
                                        <div className="relative">
                                            <Input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                name="confirmPassword"
                                                placeholder="Confirm password"
                                                value={formik.values.confirmPassword}
                                                onChange={formik.handleChange}
                                                onBlur={formik.handleBlur}
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            >
                                                {showConfirmPassword ? <EyeOff /> : <Eye />}
                                            </button>
                                        </div>
                                    </FormField>
                                </>
                            )}
                        </form>
                    )}

                    {isView && staff && (
                        <div className="grid grid-cols-2 gap-4">
                            <ProfileField label="Email" value={staff.email} icon={Mail} />
                            <ProfileField label="Phone" value={staff.phone} icon={Phone} />
                            <ProfileField label="Role" value={staff.role} icon={Briefcase} />
                            <ProfileField label="Department" value={staff.department} icon={Building2} />
                            {staff.salary && <ProfileField label="Salary Type" value={staff.salary} icon={DollarSign} />}
                        </div>
                    )}
                </div>

                {!isView && (
                    <SheetFooter className="flex justify-between gap-4 px-6 py-4 border-t border-slate-200">
                        <Button variant="outline" onClick={() => (currentStep === 0 ? handleClose() : setCurrentStep(currentStep - 1))}>
                            <ArrowLeft className="w-4 h-4" /> {currentStep === 0 ? 'Cancel' : 'Back'}
                        </Button>
                        <Button
                            onClick={currentStep === steps.length - 1 ? formik.handleSubmit : () => setCurrentStep(currentStep + 1)}
                            disabled={!canProceedToNext() || isLoading}
                        >
                            {isLoading ? <Spinner /> : currentStep === steps.length - 1 ? 'Submit' : 'Next'} <ArrowRight className="w-4 h-4" />
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    )
}

function FormField({ label, icon: Icon, required, error, children }) {
    return (
        <div className="space-y-1">
            <Label className="text-sm font-medium flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-slate-500" />} {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {children}
            {error && <p className="text-xs text-red-500 flex items-center gap-1"><X className="w-3 h-3" />{error}</p>}
        </div>
    )
}

function ProfileField({ label, value, icon: Icon }) {
    return (
        <div className="bg-surface-raised p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                {Icon && <Icon className="w-4 h-4" />}
                <span className="font-medium">{label}</span>
            </div>
            <p className="text-slate-900 font-semibold">{value || 'Not provided'}</p>
        </div>
    )
}