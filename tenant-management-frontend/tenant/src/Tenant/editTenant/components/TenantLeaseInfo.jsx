/**
 * TENANT LEASE INFO COMPONENT
 * 
 * Displays lease-related dates with:
 * - Visual indication of changed dates
 * - Comparison with original dates
 * - Date validation
 * - Clear labeling
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "../utils/formatting.js";

function DateFieldWithComparison({
    label,
    name,
    formik,
    originalValue,
    showComparison,
    isChanged,
    helperText = "",
}) {
    const error = formik.touched[name] && formik.errors[name];
    const hasChanged = isChanged && originalValue !== formik.values[name];

    return (
        <div
            className={cn(
                "space-y-2 p-3 rounded-lg transition-colors",
                hasChanged && "bg-yellow-50 border border-yellow-200"
            )}
        >
            <div className="flex items-center justify-between">
                <Label htmlFor={name} className="text-sm font-medium flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {label}
                    {hasChanged && (
                        <span className="text-xs text-yellow-600 font-normal">
                            (Modified)
                        </span>
                    )}
                </Label>

                {showComparison && hasChanged && originalValue && (
                    <span className="text-xs text-muted-foreground">
                        Was: <span className="font-medium">{formatDate(originalValue)}</span>
                    </span>
                )}
            </div>

            <Input
                id={name}
                name={name}
                type="date"
                value={formik.values[name]}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={cn(
                    error && "border-red-500 focus:ring-red-500",
                    hasChanged && "bg-white"
                )}
            />

            {helperText && (
                <p className="text-xs text-muted-foreground">{helperText}</p>
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

function TenantLeaseInfo({
    formik,
    originalTenant,
    showComparison,
    changedFields,
}) {
    return (
        <div className="space-y-4">
            <Alert>
                <AlertDescription className="text-sm">
                    <strong>Note:</strong> All dates are in English calendar format. Ensure
                    lease dates are accurate for rent calculations.
                </AlertDescription>
            </Alert>

            {/* Critical Dates */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    Critical Dates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DateFieldWithComparison
                        label="Lease Start Date"
                        name="leaseStartDate"
                        formik={formik}
                        originalValue={originalTenant?.leaseStartDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.leaseStartDate}
                        helperText="When the lease officially begins"
                    />

                    <DateFieldWithComparison
                        label="Lease End Date"
                        name="leaseEndDate"
                        formik={formik}
                        originalValue={originalTenant?.leaseEndDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.leaseEndDate}
                        helperText="When the lease officially ends"
                    />
                </div>
            </div>

            {/* Agreement & Handover Dates */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    Agreement & Handover
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DateFieldWithComparison
                        label="Agreement Signed Date"
                        name="dateOfAgreementSigned"
                        formik={formik}
                        originalValue={originalTenant?.dateOfAgreementSigned}
                        showComparison={showComparison}
                        isChanged={changedFields?.dateOfAgreementSigned}
                        helperText="Date when lease was signed"
                    />

                    <DateFieldWithComparison
                        label="Key Handover Date"
                        name="keyHandoverDate"
                        formik={formik}
                        originalValue={originalTenant?.keyHandoverDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.keyHandoverDate}
                        helperText="When keys were given to tenant"
                    />

                    <DateFieldWithComparison
                        label="Space Handover Date"
                        name="spaceHandoverDate"
                        formik={formik}
                        originalValue={originalTenant?.spaceHandoverDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.spaceHandoverDate}
                        helperText="When space was handed over (optional)"
                    />

                    <DateFieldWithComparison
                        label="Space Returned Date"
                        name="spaceReturnedDate"
                        formik={formik}
                        originalValue={originalTenant?.spaceReturnedDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.spaceReturnedDate}
                        helperText="When tenant returned space (optional)"
                    />
                </div>
            </div>

            {/* Date Validation Alert */}
            {formik.values.leaseStartDate &&
                formik.values.leaseEndDate &&
                new Date(formik.values.leaseEndDate) < new Date(formik.values.leaseStartDate) && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Lease end date cannot be before lease start date
                        </AlertDescription>
                    </Alert>
                )}
        </div>
    );
}

export default TenantLeaseInfo;