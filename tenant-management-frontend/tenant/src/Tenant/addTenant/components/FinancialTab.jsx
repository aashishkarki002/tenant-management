import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PAYMENT_METHODS, SECURITY_DEPOSIT_MODES } from "../constants/tenant.constant";
import { getLedgerPaymentMethodSelectOptions } from "../../../constants/paymentMethods";
import { FinancialTotalsDisplay } from "./FinancialTotalsDisplay";
import { EscalationSection } from "./EscalationSection";
import { getOwnershipLabel } from "@/utils/ownershipEntityDisplay.js";

export const FinancialTab = ({
    formik,
    units,
    bankAccounts = [],
    onNext,
    onPrevious,
    isNextDisabled = false,
    stepErrors = [],  // Array<string> — persistent validation messages from parent
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

                {/* ── Persistent error banner ───────────────────────────────── */}
                {stepErrors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-1">
                        <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Please fix the following before continuing
                        </div>
                        <ul className="pl-6 space-y-0.5">
                            {stepErrors.map((msg, i) => (
                                <li key={i} className="text-xs text-red-600 list-disc">{msg}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* ── Section 1: Rent Details ───────────────────────────────── */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
                        Rent Details
                    </h3>

                    {/* Rent payment method — was missing entirely, caused silent validation wall */}
                    <div className="space-y-2">
                        <Label>Rent Payment Method *</Label>
                        <Select
                            value={formik.values.paymentMethod}
                            onValueChange={(v) => {
                                formik.setFieldValue("paymentMethod", v);
                                if (v !== PAYMENT_METHODS.CHEQUE) {
                                    formik.setFieldValue("chequeAmount", "");
                                    formik.setFieldValue("chequeNumber", "");
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                {getLedgerPaymentMethodSelectOptions().map(({ value, label }) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
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

                    {/* TDS */}
                    <div className="space-y-2">
                        <Label>TDS Percentage</Label>
                        <Input
                            name="tdsPercentage" type="number" step="0.01" min="0" max="100"
                            placeholder="10" value={formik.values.tdsPercentage}
                            onChange={formik.handleChange}
                        />
                        <p className="text-xs text-muted-foreground">
                            Applied using the reverse method — the price/sqft you enter is treated as
                            the gross amount inclusive of TDS.
                        </p>
                    </div>
                </div>

                {/* ── Section 2: Per-unit financials ────────────────────────── */}
                {selectedUnits && selectedUnits.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
                            Unit Financial Details
                        </h3>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
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

                        {/* Mobile stacked cards — prevents horizontal scroll trap */}
                        <div className="md:hidden space-y-3">
                            {selectedUnits.map((unit) => {
                                const uf = formik.values.unitFinancials?.[unit._id] || {};
                                return (
                                    <div key={unit._id} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                                        <p className="text-sm font-semibold text-gray-800">
                                            Unit {unit.unitNumber}
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Sqft *</Label>
                                                <Input type="number" step="0.01" placeholder="Sqft"
                                                    value={uf.sqft || ""}
                                                    onChange={(e) => handleFinancialChange(unit._id, "sqft", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Price/Sqft (gross) *</Label>
                                                <Input type="number" step="0.01" placeholder="Price"
                                                    value={uf.pricePerSqft || ""}
                                                    onChange={(e) => handleFinancialChange(unit._id, "pricePerSqft", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">CAM/Sqft *</Label>
                                                <Input type="number" step="0.01" placeholder="CAM"
                                                    value={uf.camPerSqft || ""}
                                                    onChange={(e) => handleFinancialChange(unit._id, "camPerSqft", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Security Deposit</Label>
                                                <Input type="number" step="0.01" placeholder="Deposit"
                                                    value={uf.securityDeposit || ""}
                                                    onChange={(e) => handleFinancialChange(unit._id, "securityDeposit", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <FinancialTotalsDisplay
                            unitFinancials={formik.values.unitFinancials}
                            tdsPercentage={parseFloat(formik.values.tdsPercentage) || 10}
                        />
                    </div>
                )}

                {/* ── Section 3: Security Deposit ───────────────────────────── */}
                <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                    <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
                        Security Deposit Payment
                    </h3>

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
                                    formik.setFieldValue("sdBankAccountCode", bank?.accountCode || "");
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select bank account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.isArray(bankAccounts) &&
                                        bankAccounts.map((bank) => (
                                            <SelectItem key={bank._id} value={bank._id}>
                                                {getOwnershipLabel(bank.entityId)
                                                    ? `${getOwnershipLabel(bank.entityId)} — ${bank.bankName} — ${bank.accountName}`
                                                    : `${bank.bankName} — ${bank.accountName}`}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {sdMode === SECURITY_DEPOSIT_MODES.BANK_GUARANTEE && (
                        <div className="space-y-2">
                            <Label>Bank Guarantee Document *</Label>
                            <input
                                type="file"
                                className="border-2 p-2 rounded-2xl w-1/4 font-medium  cursor-pointer bg-gray-100 "
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

                {/* ── Section 4: Rent Escalation ───────────────────────────── */}
                <EscalationSection formik={formik} />

                {/* ── Navigation ───────────────────────────────────────────── */}
                <div className="flex justify-between mt-6">
                    <Button type="button" variant="outline" onClick={onPrevious}>Previous</Button>
                    <Button type="button" onClick={onNext} disabled={isNextDisabled}>Next</Button>
                </div>

            </CardContent>
        </Card>
    );
};