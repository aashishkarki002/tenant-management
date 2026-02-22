import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Spinner } from '@/components/ui/spinner'
import api from '../../../plugins/axios'
import { toast } from 'sonner'
import { useState } from 'react'
const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    email: Yup.string().email('Invalid email address').required('Email is required'),
    phone: Yup.string().required('Phone number is required'),
    role: Yup.string().oneOf(['admin', 'staff']).required('Role is required'),
    password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .required('Password is required'),
    confirmPassword: Yup.string()
        .oneOf([Yup.ref('password')], 'Passwords do not match')
        .required('Please confirm the password'),
})

function ErrorMsg({ name, formik }) {
    if (!formik.errors[name] || !formik.touched[name]) return null
    return <p className="text-xs text-red-500 mt-1">{formik.errors[name]}</p>
}

function AddStaffDialog({ open, onOpenChange }) {
    const [isLoading, setIsLoading] = useState(false)
    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            phone: '',
            role: 'staff',
            password: '',
            confirmPassword: '',
        },
        validationSchema,
        onSubmit: async (values) => {
            setIsLoading(true)
            try {
                // Only send what the backend expects — never send confirmPassword.
                const { confirmPassword, ...payload } = values

                const response = await api.post('/api/auth/register-staff', payload)

                if (response.data.success) {
                    toast.success(response.data.message)
                    onOpenChange(false)
                    formik.resetForm()
                } else {
                    toast.error(response.data.message)
                }
            } catch (error) {
                toast.error(
                    error.response?.data?.message || 'Failed to add staff member. Please try again.'
                )
                console.error('Add staff error:', error)
            } finally {
                setIsLoading(false)
            }
        },
    })

    const handleClose = () => {
        onOpenChange(false)
        formik.resetForm()
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="border-border bg-card max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Staff Member</DialogTitle>
                    <DialogDescription>
                        Enter the new staff member&apos;s information below
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-6" onSubmit={formik.handleSubmit}>
                    {/* Full Name & Role */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="staff-name" className="font-semibold">
                                Full Name
                            </Label>
                            <Input
                                id="staff-name"
                                placeholder="Name"
                                name="name"
                                value={formik.values.name}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                className="bg-input border-border placeholder:text-muted-foreground h-10"
                            />
                            <ErrorMsg name="name" formik={formik} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staff-role" className="font-semibold">
                                Role
                            </Label>
                            <Select
                                value={formik.values.role}
                                onValueChange={(value) => formik.setFieldValue('role', value)}
                            >
                                <SelectTrigger
                                    id="staff-role"
                                    className="bg-input border-border h-10"
                                >
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-card">
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                </SelectContent>
                            </Select>
                            <ErrorMsg name="role" formik={formik} />
                        </div>
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="staff-email" className="font-semibold">
                                Email
                            </Label>
                            <Input
                                id="staff-email"
                                name="email"
                                value={formik.values.email}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                type="email"
                                placeholder="abc@example.com"
                                className="bg-input border-border placeholder:text-muted-foreground h-10"
                            />
                            <ErrorMsg name="email" formik={formik} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staff-phone" className="font-semibold">
                                Phone Number
                            </Label>
                            <Input
                                id="staff-phone"
                                name="phone"
                                value={formik.values.phone}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                placeholder="03001234567"
                                className="bg-input border-border placeholder:text-muted-foreground h-10"
                            />
                            <ErrorMsg name="phone" formik={formik} />
                        </div>
                    </div>

                    {/* Password & Confirm Password */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="staff-password" className="font-semibold">
                                Password
                            </Label>
                            <Input
                                id="staff-password"
                                name="password"
                                value={formik.values.password}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                type="password"
                                placeholder="Min 8 characters"
                                className="bg-input border-border placeholder:text-muted-foreground h-10"
                            />
                            <ErrorMsg name="password" formik={formik} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staff-confirm-password" className="font-semibold">
                                Confirm Password
                            </Label>
                            <Input
                                id="staff-confirm-password"
                                name="confirmPassword"
                                value={formik.values.confirmPassword}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                type="password"
                                placeholder="Re-enter password"
                                className="bg-input border-border placeholder:text-muted-foreground h-10"
                            />
                            <ErrorMsg name="confirmPassword" formik={formik} />
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        A verification link will be sent to the staff&apos;s email. They must verify
                        before logging in.
                    </p>

                    <div className="flex gap-3 pt-4 border-t border-border">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1 border-border"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                            {isLoading ? <Spinner /> : 'Add Staff Member'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default AddStaffDialog