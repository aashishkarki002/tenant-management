/**
 * TENANT BASIC INFO COMPONENT
 * 
 * Displays personal information fields with:
 * - Visual indication of changed fields
 * - Side-by-side comparison of original vs current values
 * - Real-time validation
 * - Accessible form controls
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Reusable Field Wrapper with comparison
function FieldWithComparison({
    label,
    name,
    type = "text",
    formik,
    originalValue,
    showComparison,
    isChanged,
    children,
}) {
    const error = formik.touched[name] && formik.errors[name];
    const hasChanged = isChanged && originalValue !== formik.values[name];

    return (
        <div className={cn(
            "space-y-2 p-3 rounded-lg transition-colors",
            hasChanged && "bg-yellow-50 border border-yellow-200"
        )}>
            <div className="flex items-center justify-between">
                <Label htmlFor={name} className="text-sm font-medium">
                    {label}
                    {hasChanged && (
                        <span className="ml-2 text-xs text-yellow-600 font-normal">
                            (Modified)
                        </span>
                    )}
                </Label>

                {showComparison && hasChanged && originalValue && (
                    <span className="text-xs text-muted-foreground">
                        Was: <span className="font-medium">{originalValue}</span>
                    </span>
                )}
            </div>

            {children || (
                <Input
                    id={name}
                    name={name}
                    type={type}
                    value={formik.values[name]}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={cn(
                        error && "border-red-500 focus:ring-red-500",
                        hasChanged && "bg-white"
                    )}
                />
            )}

            {error && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                </p>
            )}
        </div>
    );
}

function TenantBasicInfo({
    formik,
    originalTenant,
    showComparison,
    changedFields,
}) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <FieldWithComparison
                    label="Tenant Name"
                    name="name"
                    formik={formik}
                    originalValue={originalTenant?.name}
                    showComparison={showComparison}
                    isChanged={changedFields?.name}
                />

                {/* Email */}
                <FieldWithComparison
                    label="Email Address"
                    name="email"
                    type="email"
                    formik={formik}
                    originalValue={originalTenant?.email}
                    showComparison={showComparison}
                    isChanged={changedFields?.email}
                />

                {/* Phone */}
                <FieldWithComparison
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    formik={formik}
                    originalValue={originalTenant?.phone}
                    showComparison={showComparison}
                    isChanged={changedFields?.phone}
                />

                {/* Status */}
                <FieldWithComparison
                    label="Status"
                    name="status"
                    formik={formik}
                    originalValue={originalTenant?.status}
                    showComparison={showComparison}
                    isChanged={changedFields?.status}
                >
                    <Select
                        value={formik.values.status}
                        onValueChange={(value) => formik.setFieldValue("status", value)}
                    >
                        <SelectTrigger
                            className={cn(
                                changedFields?.status && "bg-white"
                            )}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="vacated">Vacated</SelectItem>
                        </SelectContent>
                    </Select>
                </FieldWithComparison>
            </div>

            {/* Address - Full Width */}
            <FieldWithComparison
                label="Address"
                name="address"
                formik={formik}
                originalValue={originalTenant?.address}
                showComparison={showComparison}
                isChanged={changedFields?.address}
            >
                <textarea
                    id="address"
                    name="address"
                    value={formik.values.address}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    rows={3}
                    className={cn(
                        "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2",
                        formik.touched.address && formik.errors.address && "border-red-500",
                        changedFields?.address && "bg-white"
                    )}
                />
            </FieldWithComparison>

            {/* Info Alert */}
            <Alert>
                <AlertDescription className="text-sm">
                    💡 <strong>Tip:</strong> Changes are highlighted in yellow. Original values
                    are shown above each modified field.
                </AlertDescription>
            </Alert>
        </div>
    );
}

export default TenantBasicInfo;