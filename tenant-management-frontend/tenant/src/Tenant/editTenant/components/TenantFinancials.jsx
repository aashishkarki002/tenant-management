/**
 * TENANT FINANCIALS COMPONENT
 * 
 * Features:
 * - Real-time financial calculations
 * - Visual breakdown of rent components
 * - Automatic TDS calculation
 * - Monthly vs Quarterly comparisons
 * - Industry standard: Show calculations transparently
 */

import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, TrendingUp, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";


// Helper function to calculate financials
function calculateFinancials(sqft, pricePerSqft, camRate, tdsPercentage = 10) {
    if (!sqft || !pricePerSqft) return null;

    const grossMonthly = sqft * pricePerSqft;
    const tds = grossMonthly * (tdsPercentage / 100);
    const netRent = grossMonthly - tds;
    const cam = sqft * (camRate || 0);
    const totalMonthly = netRent + cam;

    return {
        grossMonthly,
        tds,
        netRent,
        cam,
        totalMonthly,
    };
}

function FieldWithComparison({
    label,
    name,
    formik,
    originalValue,
    showComparison,
    isChanged,
    prefix = "",
    suffix = "",
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
                        Was:{" "}
                        <span className="font-medium">
                            {prefix}
                            {originalValue}
                            {suffix}
                        </span>
                    </span>
                )}
            </div>

            <div className="relative">
                {prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {prefix}
                    </span>
                )}
                <Input
                    id={name}
                    name={name}
                    type="number"
                    step="0.01"
                    value={formik.values[name]}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={cn(
                        error && "border-red-500",
                        hasChanged && "bg-white",
                        prefix && "pl-8",
                        suffix && "pr-12"
                    )}
                />
                {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {suffix}
                    </span>
                )}
            </div>

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

function TenantFinancials({
    formik,
    originalTenant,
    showComparison,
    changedFields,
    financialSummary,
}) {
    // Real-time calculation based on current form values
    const currentCalculation = useMemo(() => {
        return calculateFinancials(
            Number(formik.values.leasedSquareFeet) || 0,
            Number(formik.values.pricePerSqft) || 0,
            Number(formik.values.camRatePerSqft) || 0
        );
    }, [
        formik.values.leasedSquareFeet,
        formik.values.pricePerSqft,
        formik.values.camRatePerSqft,
    ]);

    // Detect if calculations have changed
    const calculationsChanged =
        currentCalculation &&
        (Math.abs(currentCalculation.totalMonthly - financialSummary.monthlyTotal) >
            0.01 ||
            Math.abs(currentCalculation.netRent - financialSummary.monthlyRent) >
            0.01);

    return (
        <div className="space-y-6">
            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldWithComparison
                    label="Leased Square Feet"
                    name="leasedSquareFeet"
                    formik={formik}
                    originalValue={originalTenant?.leasedSquareFeet}
                    showComparison={showComparison}
                    isChanged={changedFields?.leasedSquareFeet}
                    suffix="sq ft"
                    helperText="Total area being leased"
                />

                <FieldWithComparison
                    label="Price Per Sqft (Gross)"
                    name="pricePerSqft"
                    formik={formik}
                    originalValue={originalTenant?.pricePerSqft}
                    showComparison={showComparison}
                    isChanged={changedFields?.pricePerSqft}
                    prefix="₹"
                    helperText="Includes 10% TDS"
                />

                <FieldWithComparison
                    label="CAM Rate Per Sqft"
                    name="camRatePerSqft"
                    formik={formik}
                    originalValue={originalTenant?.camRatePerSqft}
                    showComparison={showComparison}
                    isChanged={changedFields?.camRatePerSqft}
                    prefix="₹"
                    helperText="Common Area Maintenance"
                />

                <FieldWithComparison
                    label="Security Deposit"
                    name="securityDeposit"
                    formik={formik}
                    originalValue={originalTenant?.securityDeposit}
                    showComparison={showComparison}
                    isChanged={changedFields?.securityDeposit}
                    prefix="₹"
                    helperText="Refundable deposit"
                />
            </div>

            <Separator />

            {/* Real-time Calculation Display */}
            {currentCalculation && (
                <Card
                    className={cn(
                        "p-4 space-y-3",
                        calculationsChanged && "border-blue-200 bg-blue-50"
                    )}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-blue-600" />
                            <h3 className="font-semibold">
                                {calculationsChanged ? "New " : ""}Monthly Calculation
                            </h3>
                        </div>
                        {calculationsChanged && (
                            <Badge variant="secondary" className="bg-blue-100">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Updated
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Gross Rent:</span>
                            <span className="font-medium">
                                ₹{currentCalculation.grossMonthly.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>

                        <div className="flex justify-between items-center text-red-600">
                            <span>Less: TDS (10%):</span>
                            <span className="font-medium">
                                - ₹{currentCalculation.tds.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Net Rent:</span>
                            <span className="font-medium">
                                ₹{currentCalculation.netRent.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">CAM Charges:</span>
                            <span className="font-medium">
                                ₹{currentCalculation.cam.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>

                        <Separator />

                        <div className="flex justify-between items-center text-lg font-bold">
                            <span>Total Monthly:</span>
                            <span className="text-green-600">
                                ₹{currentCalculation.totalMonthly.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>
                    </div>

                    {/* Show comparison with original if changed */}
                    {calculationsChanged && (
                        <div className="pt-2 border-t">
                            <div className="flex justify-between items-center text-sm text-muted-foreground">
                                <span>Previous Monthly Total:</span>
                                <span>
                                    ₹{financialSummary.monthlyTotal.toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium mt-1">
                                <span>Difference:</span>
                                <span
                                    className={cn(
                                        currentCalculation.totalMonthly >
                                            financialSummary.monthlyTotal
                                            ? "text-red-600"
                                            : "text-green-600"
                                    )}
                                >
                                    {currentCalculation.totalMonthly >
                                        financialSummary.monthlyTotal
                                        ? "+"
                                        : ""}
                                    ₹{(
                                        currentCalculation.totalMonthly -
                                        financialSummary.monthlyTotal
                                    ).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Formula Explanation */}
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                        <strong>Calculation:</strong>
                        <div className="mt-1 font-mono">
                            ({formik.values.leasedSquareFeet || 0} sq ft ×{" "}
                            ₹{formik.values.pricePerSqft || 0}) - 10% TDS +{" "}
                            ({formik.values.leasedSquareFeet || 0} sq ft ×{" "}
                            ₹{formik.values.camRatePerSqft || 0})
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}

export default TenantFinancials;