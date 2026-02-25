/**
 * FinancialTab.jsx  (FIXED)
 *
 * FIX 1 - BANK_GUARANTEE removed from rent payment method select.
 *   It belongs in the security deposit section.
 *
 * FIX 2 - Added Security Deposit Payment section with:
 *   - SD mode selector (bank_guarantee | cash | bank_transfer | cheque)
 *   - Bank account fields when mode requires a cash/bank entry
 *   - Bank guarantee photo upload when mode is bank_guarantee
 *
 * FIX 3 - FinancialTotalsDisplay now receives tdsPercentage so it can
 *   show the correct TDS breakdown (gross / TDS / net / CAM / total).
 */

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PAYMENT_METHODS, SECURITY_DEPOSIT_MODES } from "../constants/tenant.constant";
import { FinancialTotalsDisplay } from "./FinancialTotalsDisplay";

export const FinancialTab = ({
    formik,
    units,
    bankAccounts = [],
    onNext,
    onPrevious,
}) => {
    const selectedUnits = formik.values.unitNumber
        ?.map((unitId) => units.find((u) => u._id === unitId))
        .filter(Boolean);

    const handleFinancialChange = (unitId, field, value) => {
        formik.setFieldValue("unitFinancials", {
            ...formik.values.unitFinancials,
            [unitId]: {
                ...formik.values.unitFinancials?.[unitId],
                [field]: value,
            },
        });
    };

    const sdMode = formik.values.sdPaymentMethod;
    const sdNeedsBankDetails =
        sdMode === SECURITY_DEPOSIT_MODES.BANK_TRANSFER ||
        sdMode === SECURITY_DEPOSIT_MODES.CHEQUE;

    return (
        <Card className="shadow-sm">
            <CardContent className="p-6 space-y-6">

                {/* ── Rent Payment Method ────────────────────────────────────────── */}
                <div className="space-y-2">
                    <Label>Rent Payment Method *</Label>
                    <Select
                        value={formik.values.paymentMethod}
                        onValueChange={(v) => formik.setFieldValue("paymentMethod", v)}
                    >
                        <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={PAYMENT_METHODS.CASH}>Cash</SelectItem>
                            <SelectItem value={PAYMENT_METHODS.BANK_TRANSFER}>Bank Transfer</SelectItem>
                            <SelectItem value={PAYMENT_METHODS.CHEQUE}>Cheque</SelectItem>
                            <SelectItem value={PAYMENT_METHODS.MOBILE_WALLET}>Mobile Wallet</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {formik.values.paymentMethod === PAYMENT_METHODS.CHEQUE && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cheque Amount *</Label>
                            <Input
                                name="chequeAmount" type="number" placeholder="Enter amount"
                                value={formik.values.chequeAmount} onChange={formik.handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cheque Number *</Label>
                            <Input
                                name="chequeNumber" placeholder="Enter cheque number"
                                value={formik.values.chequeNumber} onChange={formik.handleChange}
                            />
                        </div>
                    </div>
                )}

                {/* ── TDS ───────────────────────────────────────────────────────── */}
                <div className="space-y-2">
                    <Label>TDS Percentage</Label>
                    <Input
                        name="tdsPercentage" type="number" step="0.01" min="0" max="100"
                        placeholder="10" value={formik.values.tdsPercentage}
                        onChange={formik.handleChange}
                    />
                    <p className="text-xs text-muted-foreground">
                        Applied using the reverse method — the price/sqft you enter is treated as the gross
                        amount inclusive of TDS.
                    </p>
                </div>

                {/* ── Per-unit financials ───────────────────────────────────────── */}
                {selectedUnits && selectedUnits.length > 0 && (
                    <>
                        <div className="space-y-3">
                            <h3 className="font-semibold">Unit Financial Details</h3>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Unit</TableHead>
                                            <TableHead>Sqft *</TableHead>
                                            <TableHead>Price/Sqft (gross) *</TableHead>
                                            <TableHead>CAM/Sqft *</TableHead>
                                            <TableHead>Security Deposit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedUnits.map((unit) => {
                                            const uf = formik.values.unitFinancials?.[unit._id] || {};
                                            return (
                                                <TableRow key={unit._id}>
                                                    <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                                                    <TableCell>
                                                        <Input type="number" step="0.01" placeholder="Sqft"
                                                            value={uf.sqft || ""}
                                                            onChange={(e) => handleFinancialChange(unit._id, "sqft", e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input type="number" step="0.01" placeholder="Price"
                                                            value={uf.pricePerSqft || ""}
                                                            onChange={(e) => handleFinancialChange(unit._id, "pricePerSqft", e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input type="number" step="0.01" placeholder="CAM"
                                                            value={uf.camPerSqft || ""}
                                                            onChange={(e) => handleFinancialChange(unit._id, "camPerSqft", e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input type="number" step="0.01" placeholder="Deposit"
                                                            value={uf.securityDeposit || ""}
                                                            onChange={(e) => handleFinancialChange(unit._id, "securityDeposit", e.target.value)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Live TDS breakdown display */}
                        <FinancialTotalsDisplay
                            unitFinancials={formik.values.unitFinancials}
                            tdsPercentage={parseFloat(formik.values.tdsPercentage) || 10}
                        />
                    </>
                )}

                {/* ── Security Deposit Payment ──────────────────────────────────── */}
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                    <h3 className="font-semibold">Security Deposit Payment</h3>

                    <div className="space-y-2">
                        <Label>How is the deposit secured? *</Label>
                        <Select
                            value={formik.values.sdPaymentMethod}
                            onValueChange={(v) => formik.setFieldValue("sdPaymentMethod", v)}
                        >
                            <SelectTrigger><SelectValue placeholder="Select deposit mode" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={SECURITY_DEPOSIT_MODES.CASH}>Cash (received)</SelectItem>
                                <SelectItem value={SECURITY_DEPOSIT_MODES.BANK_TRANSFER}>Bank Transfer</SelectItem>
                                <SelectItem value={SECURITY_DEPOSIT_MODES.CHEQUE}>Cheque</SelectItem>
                                <SelectItem value={SECURITY_DEPOSIT_MODES.BANK_GUARANTEE}>
                                    Bank Guarantee (document only)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {sdMode === SECURITY_DEPOSIT_MODES.BANK_GUARANTEE && (
                            <p className="text-xs text-amber-600">
                                No cash entry will be posted. A bank guarantee document will be attached.
                            </p>
                        )}
                        {sdNeedsBankDetails && (
                            <p className="text-xs text-blue-600">
                                A ledger entry (DR Bank / CR Security Deposit Liability) will be posted on save.
                            </p>
                        )}
                        {sdMode === SECURITY_DEPOSIT_MODES.CASH && (
                            <p className="text-xs text-blue-600">
                                A ledger entry (DR Cash / CR Security Deposit Liability) will be posted on save.
                            </p>
                        )}
                    </div>

                    {/* Bank details - only shown when money changes hands via bank */}
                    {sdNeedsBankDetails && (
                        <div className="space-y-2">
                            <Label>Bank Account *</Label>
                            <Select
                                value={formik.values.sdBankAccountId || ""}
                                onValueChange={(value) => {
                                    const bank = Array.isArray(bankAccounts)
                                        ? bankAccounts.find((b) => b._id === value)
                                        : null;

                                    formik.setFieldValue("sdBankAccountId", bank?._id || "");
                                    formik.setFieldValue(
                                        "sdBankAccountCode",
                                        bank?.accountCode || "",
                                    );
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select bank account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.isArray(bankAccounts) &&
                                        bankAccounts.map((bank) => (
                                            <SelectItem key={bank._id} value={bank._id}>
                                                {bank.bankName} — {bank.accountName}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Bank guarantee photo upload */}
                    {sdMode === SECURITY_DEPOSIT_MODES.BANK_GUARANTEE && (
                        <div className="space-y-2">
                            <Label>Bank Guarantee Document *</Label>
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => formik.setFieldValue("bankGuaranteePhoto", e.target.files?.[0])}
                            />
                            {formik.values.bankGuaranteePhoto && (
                                <p className="text-sm text-gray-600">
                                    Selected: {formik.values.bankGuaranteePhoto.name}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Navigation ───────────────────────────────────────────────── */}
                <div className="flex justify-between mt-6">
                    <Button type="button" variant="outline" onClick={onPrevious}>Previous</Button>
                    <Button type="button" onClick={onNext}>Next</Button>
                </div>

            </CardContent>
        </Card>
    );
};