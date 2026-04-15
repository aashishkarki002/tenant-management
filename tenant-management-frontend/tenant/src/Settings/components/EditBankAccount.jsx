/**
 * EditBankAccount.jsx
 *
 * Form for editing an existing bank account. Same fields as AddBankAccount
 * except: no opening balance; shows current balance as read-only.
 * Includes entity selector so legacy accounts without entityId can be fixed.
 *
 * Usage: <EditBankAccount formik={editBankFormik} balanceDisplay="Rs 1,234.00" onCancel={() => close()} />
 */

import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOwnership } from "../hooks/useOwnership";

function entityOptionLabel(entity) {
    if (!entity || typeof entity !== "object") return "Entity";
    if (entity.name) return entity.name;
    if (entity.type === "head_office") return "Head office";
    if (entity.type === "company") return "Company";
    if (entity.type === "private") return "Private";
    return "Entity";
}

export default function EditBankAccount({ formik, balanceDisplay, onCancel }) {
    const { entities, loading, error } = useOwnership();
    const activeEntities = useMemo(
        () => entities.filter((e) => e.isActive !== false),
        [entities],
    );

    return (
        <form onSubmit={formik.handleSubmit} className="space-y-4">
            {balanceDisplay != null && balanceDisplay !== "" && (
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                        Balance (read-only)
                    </Label>
                    <Input
                        value={balanceDisplay}
                        readOnly
                        disabled
                        className="bg-slate-100 text-slate-600"
                    />
                    <p className="text-xs text-slate-500">
                        Balance changes only through payments and journal entries.
                    </p>
                </div>
            )}

            {/* Ownership entity */}
            <div className="space-y-1.5">
                <Label htmlFor="edit-entityId">Ownership entity *</Label>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Select
                    value={formik.values.entityId || undefined}
                    onValueChange={(v) => formik.setFieldValue("entityId", v)}
                    disabled={loading || activeEntities.length === 0}
                >
                    <SelectTrigger id="edit-entityId" className="w-full">
                        <SelectValue
                            placeholder={
                                loading
                                    ? "Loading entities…"
                                    : activeEntities.length === 0
                                      ? "No entities available"
                                      : "Select entity"
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {activeEntities.map((ent) => (
                            <SelectItem key={String(ent._id)} value={String(ent._id)}>
                                {entityOptionLabel(ent)}
                                {ent.type ? (
                                    <span className="text-muted-foreground text-xs ml-1">
                                        ({ent.type.replace(/_/g, " ")})
                                    </span>
                                ) : null}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="edit-bankName">Bank Name *</Label>
                <Input
                    id="edit-bankName"
                    name="bankName"
                    placeholder="e.g. Nabil Bank"
                    value={formik.values.bankName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="edit-accountName">Account Name *</Label>
                <Input
                    id="edit-accountName"
                    name="accountName"
                    placeholder="e.g. Operations Account"
                    value={formik.values.accountName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="edit-accountNumber">Account Number *</Label>
                <Input
                    id="edit-accountNumber"
                    name="accountNumber"
                    placeholder="e.g. 0012345678"
                    value={formik.values.accountNumber}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="edit-accountCode">
                    Account Code *{" "}
                    <span className="text-xs font-normal text-slate-500">
                        (Chart of accounts — must be unique)
                    </span>
                </Label>
                <Input
                    id="edit-accountCode"
                    name="accountCode"
                    placeholder="e.g. 1010-NABIL"
                    value={formik.values.accountCode}
                    onChange={(e) =>
                        formik.setFieldValue("accountCode", e.target.value.toUpperCase())
                    }
                    onBlur={formik.handleBlur}
                    className="font-mono uppercase"
                    required
                />
                <p className="text-xs text-slate-500">
                    Convention: <code className="bg-slate-100 px-1 rounded">1010-BANKNAME</code>.
                    Used to route payment journal entries to the correct bank ledger account.
                </p>
            </div>

            <div className="flex gap-2 pt-2">
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={formik.isSubmitting}
                    className="flex-1"
                >
                    {formik.isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </form>
    );
}
