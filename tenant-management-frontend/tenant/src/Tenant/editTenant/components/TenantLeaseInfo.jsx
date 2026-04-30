import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field";
import { formatDate } from "../utils/formatting.js";

// Max date: 50 years from now, to prevent obviously-wrong entries
const MAX_DATE = new Date(Date.now() + 50 * 365.25 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

function DateFieldWithComparison({
    label,
    name,
    formik,
    originalValue,
    showComparison,
    isChanged,
    helperText,
    min,
    max,
    required,
}) {
    const error = formik.touched[name] && formik.errors[name];
    const hasChanged = isChanged && originalValue !== formik.values[name];

    return (
        <div
            className={cn(
                "space-y-1.5 rounded-lg p-3 transition-colors",
                hasChanged && "border border-amber-200 bg-amber-50/50"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={name} className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {label}
                    {required && <span className="text-destructive">*</span>}
                    {hasChanged && (
                        <span className="text-xs font-normal text-amber-600">Modified</span>
                    )}
                </Label>

                {showComparison && hasChanged && originalValue && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        Was: <span className="font-medium">{formatDate(originalValue)}</span>
                    </span>
                )}
            </div>

            <Input
                id={name}
                name={name}
                type="date"
                value={formik.values[name] || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                min={min}
                max={max ?? MAX_DATE}
                aria-invalid={!!error}
                className={cn(hasChanged && "bg-white")}
            />

            {helperText && (
                <p className="text-xs text-muted-foreground">{helperText}</p>
            )}

            {error && <FieldError>{error}</FieldError>}
        </div>
    );
}

function TenantLeaseInfo({ formik, originalTenant, showComparison, changedFields }) {
    const startDate = formik.values.leaseStartDate;
    const endDate = formik.values.leaseEndDate;

    // Only compare dates when both are valid strings
    const startValid = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate);
    const endValid = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate);
    const endBeforeStart =
        startValid && endValid && new Date(endDate) < new Date(startDate);

    return (
        <div className="space-y-4">
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                    All dates are in English (AD) calendar format. Lease start and end dates
                    directly affect rent charge calculations.
                </AlertDescription>
            </Alert>

            {/* Critical dates */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Critical Dates
                </h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <DateFieldWithComparison
                        label="Lease Start"
                        name="leaseStartDate"
                        formik={formik}
                        originalValue={originalTenant?.leaseStartDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.leaseStartDate}
                        helperText="When the lease officially begins"
                        required
                    />

                    <DateFieldWithComparison
                        label="Lease End"
                        name="leaseEndDate"
                        formik={formik}
                        originalValue={originalTenant?.leaseEndDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.leaseEndDate}
                        helperText="When the lease officially ends"
                        min={startDate || undefined}
                        required
                    />
                </div>

                {endBeforeStart && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Lease end date cannot be before lease start date.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Agreement & handover dates */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Agreement &amp; Handover
                </h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <DateFieldWithComparison
                        label="Agreement Signed"
                        name="dateOfAgreementSigned"
                        formik={formik}
                        originalValue={originalTenant?.dateOfAgreementSigned}
                        showComparison={showComparison}
                        isChanged={changedFields?.dateOfAgreementSigned}
                        helperText="Date the lease agreement was signed"
                    />

                    <DateFieldWithComparison
                        label="Key Handover"
                        name="keyHandoverDate"
                        formik={formik}
                        originalValue={originalTenant?.keyHandoverDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.keyHandoverDate}
                        helperText="When keys were handed over to tenant"
                    />

                    <DateFieldWithComparison
                        label="Space Handover"
                        name="spaceHandoverDate"
                        formik={formik}
                        originalValue={originalTenant?.spaceHandoverDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.spaceHandoverDate}
                        helperText="When physical space was handed over (optional)"
                    />

                    <DateFieldWithComparison
                        label="Space Returned"
                        name="spaceReturnedDate"
                        formik={formik}
                        originalValue={originalTenant?.spaceReturnedDate}
                        showComparison={showComparison}
                        isChanged={changedFields?.spaceReturnedDate}
                        helperText="When tenant returned the space (optional)"
                    />
                </div>
            </div>
        </div>
    );
}

export default TenantLeaseInfo;
