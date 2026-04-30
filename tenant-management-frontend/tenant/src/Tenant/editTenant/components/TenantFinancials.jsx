import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, TrendingDown, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field";

const RS = "Rs.";

function fmt(amount) {
    return amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function calculateFinancials(sqft, pricePerSqft, camRate, tdsPercentage = 10) {
    const s = Number(sqft) || 0;
    const p = Number(pricePerSqft) || 0;
    const c = Number(camRate) || 0;

    if (s <= 0 || p <= 0) return null;

    const grossMonthly = s * p;
    const tds = grossMonthly * (tdsPercentage / 100);
    const netRent = grossMonthly - tds;
    const cam = s * c;
    const totalMonthly = netRent + cam;

    return { grossMonthly, tds, netRent, cam, totalMonthly };
}

function FinancialInput({
    label,
    name,
    formik,
    originalValue,
    showComparison,
    isChanged,
    prefix,
    suffix,
    helperText,
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
                <Label htmlFor={name} className="text-sm font-medium">
                    {label}
                    {required && <span className="ml-0.5 text-destructive">*</span>}
                    {hasChanged && (
                        <span className="ml-2 text-xs font-normal text-amber-600">Modified</span>
                    )}
                </Label>

                {showComparison && hasChanged && originalValue !== undefined && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        Was:{" "}
                        <span className="font-medium">
                            {prefix && `${prefix} `}
                            {originalValue}
                            {suffix && ` ${suffix}`}
                        </span>
                    </span>
                )}
            </div>

            <div className="relative">
                {prefix && (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {prefix}
                    </span>
                )}
                <Input
                    id={name}
                    name={name}
                    type="number"
                    step="0.01"
                    min="0"
                    value={formik.values[name]}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    aria-invalid={!!error}
                    className={cn(
                        prefix && "pl-12",
                        suffix && "pr-14",
                        hasChanged && "bg-white"
                    )}
                />
                {suffix && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {suffix}
                    </span>
                )}
            </div>

            {helperText && (
                <p className="text-xs text-muted-foreground">{helperText}</p>
            )}

            {error && <FieldError>{error}</FieldError>}
        </div>
    );
}

function TenantFinancials({ formik, originalTenant, showComparison, changedFields, financialSummary }) {
    const current = useMemo(
        () =>
            calculateFinancials(
                formik.values.leasedSquareFeet,
                formik.values.pricePerSqft,
                formik.values.camRatePerSqft
            ),
        [formik.values.leasedSquareFeet, formik.values.pricePerSqft, formik.values.camRatePerSqft]
    );

    const prevTotal = financialSummary?.monthlyTotal ?? 0;
    const diff = current ? current.totalMonthly - prevTotal : 0;
    const changed = current && Math.abs(diff) > 0.01;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <FinancialInput
                    label="Leased Square Feet"
                    name="leasedSquareFeet"
                    formik={formik}
                    originalValue={originalTenant?.leasedSquareFeet}
                    showComparison={showComparison}
                    isChanged={changedFields?.leasedSquareFeet}
                    suffix="sq ft"
                    helperText="Total area being leased"
                    required
                />

                <FinancialInput
                    label="Price per Sq. Ft. (Gross)"
                    name="pricePerSqft"
                    formik={formik}
                    originalValue={originalTenant?.pricePerSqft}
                    showComparison={showComparison}
                    isChanged={changedFields?.pricePerSqft}
                    prefix={RS}
                    helperText="Gross rent rate — 10% TDS is deducted automatically"
                    required
                />

                <FinancialInput
                    label="CAM Rate per Sq. Ft."
                    name="camRatePerSqft"
                    formik={formik}
                    originalValue={originalTenant?.camRatePerSqft}
                    showComparison={showComparison}
                    isChanged={changedFields?.camRatePerSqft}
                    prefix={RS}
                    helperText="Common Area Maintenance charge"
                />

                <FinancialInput
                    label="Security Deposit"
                    name="securityDeposit"
                    formik={formik}
                    originalValue={originalTenant?.securityDeposit}
                    showComparison={showComparison}
                    isChanged={changedFields?.securityDeposit}
                    prefix={RS}
                    helperText="Refundable deposit — not included in monthly total"
                />
            </div>

            {/* Live calculation — only shown when both sqft and price are set */}
            {current && (
                <>
                    <Separator />

                    <div
                        className={cn(
                            "rounded-lg border px-4 py-3 space-y-2.5",
                            changed ? "border-blue-200 bg-blue-50/50" : "border-border bg-muted/30"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Calculator className="h-4 w-4 text-muted-foreground" />
                                Monthly Breakdown
                            </div>
                            {changed && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-xs",
                                        diff > 0
                                            ? "border-red-200 bg-red-50 text-red-700"
                                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    )}
                                >
                                    {diff > 0 ? (
                                        <TrendingUp className="mr-1 h-3 w-3" />
                                    ) : (
                                        <TrendingDown className="mr-1 h-3 w-3" />
                                    )}
                                    {diff > 0 ? "+" : ""}
                                    {RS} {fmt(diff)}
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Gross rent</span>
                                <span>{RS} {fmt(current.grossMonthly)}</span>
                            </div>
                            <div className="flex justify-between text-destructive/80">
                                <span>Less: TDS (10%)</span>
                                <span>− {RS} {fmt(current.tds)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Net rent</span>
                                <span>{RS} {fmt(current.netRent)}</span>
                            </div>
                            {current.cam > 0 && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span>CAM charges</span>
                                    <span>{RS} {fmt(current.cam)}</span>
                                </div>
                            )}

                            <Separator className="my-1" />

                            <div className="flex justify-between font-semibold">
                                <span>Total monthly</span>
                                <span>{RS} {fmt(current.totalMonthly)}</span>
                            </div>

                            {changed && (
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Previous total</span>
                                    <span>{RS} {fmt(prevTotal)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Show hint if inputs are missing */}
            {!current && (formik.values.leasedSquareFeet || formik.values.pricePerSqft) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Enter both leased area and price per sq. ft. to see the monthly breakdown.
                </div>
            )}
        </div>
    );
}

export default TenantFinancials;
