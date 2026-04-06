/**
 * Bank account creation form (Settings).
 *
 * Fields:
 *   entityId       — required, OwnershipEntity _id (scopes ledger + bank account)
 *   accountCode    — required, chart-of-accounts code (e.g. "1010-NABIL")
 *   openingBalance — optional, in rupees (backend converts to paisa)
 *
 * Usage:
 *   <AddBankAccount formik={bankAccountFormik} />
 *
 * Formik initialValues must include entityId (string, empty until selected).
 */

import React, { useEffect, useMemo } from "react";
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

export default function AddBankAccount({ formik }) {
    const { entities, loading, error } = useOwnership();
    const activeEntities = useMemo(
        () => entities.filter((e) => e.isActive !== false),
        [entities],
    );

    useEffect(() => {
        if (loading || activeEntities.length !== 1) return;
        const onlyId = activeEntities[0]._id;
        if (!onlyId) return;
        const idStr = String(onlyId);
        if (!formik.values.entityId) {
            formik.setFieldValue("entityId", idStr);
        }
        // Formik's `formik` bag is a new object each render; omitting it avoids a loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only entityId + setFieldValue matter here
    }, [loading, activeEntities, formik.values.entityId, formik.setFieldValue]);

    return (
        <form onSubmit={formik.handleSubmit} className="space-y-4">

            {/* Ownership entity */}
            <div className="space-y-1.5">
                <Label htmlFor="entityId">Ownership entity *</Label>
                {error && (
                    <p className="text-xs text-destructive">{error}</p>
                )}
                <Select
                    value={formik.values.entityId || undefined}
                    onValueChange={(v) => formik.setFieldValue("entityId", v)}
                    disabled={loading || activeEntities.length === 0}
                >
                    <SelectTrigger id="entityId" className="w-full">
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
                <p className="text-xs text-slate-500">
                    Bank and chart-of-accounts rows are created for this entity. Account codes must be unique per entity.
                </p>
            </div>

            {/* Bank Name */}
            <div className="space-y-1.5">
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input
                    id="bankName"
                    name="bankName"
                    placeholder="e.g. Nabil Bank"
                    value={formik.values.bankName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                />
            </div>

            {/* Account Name */}
            <div className="space-y-1.5">
                <Label htmlFor="accountName">Account Name *</Label>
                <Input
                    id="accountName"
                    name="accountName"
                    placeholder="e.g. Operations Account"
                    value={formik.values.accountName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                />
            </div>

            {/* Account Number */}
            <div className="space-y-1.5">
                <Label htmlFor="accountNumber">Account Number *</Label>
                <Input
                    id="accountNumber"
                    name="accountNumber"
                    placeholder="e.g. 0012345678"
                    value={formik.values.accountNumber}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                />
            </div>

            {/*
        ── NEW: Account Code ──────────────────────────────────────────────────
        This is the chart-of-accounts code that links this physical bank account
        to the correct ledger account for double-entry journal entries.

        Convention: "1010-{BANK_ABBREVIATION}"
        Each bank account must have a UNIQUE code across the whole system.

        Examples:
          Nabil Bank main account  → 1010-NABIL
          Global IME current a/c   → 1011-GLOBAL-IME
          NIC Asia savings         → 1012-NIC-ASIA

        Why it matters:
          When a tenant pays by bank transfer, the journal builder uses this
          code to DR the correct bank ledger account:
            DR  1010-NABIL          (money received into Nabil)
            CR  Accounts Receivable (tenant owes less)
          Without it, the system cannot distinguish between bank accounts
          in the ledger and will throw an error on payment.
      */}
            <div className="space-y-1.5">
                <Label htmlFor="accountCode">
                    Account Code *{" "}
                    <span className="text-xs font-normal text-slate-500">
                        (Chart of accounts — must be unique)
                    </span>
                </Label>
                <Input
                    id="accountCode"
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

            {/*
        ── NEW: Opening Balance ───────────────────────────────────────────────
        Optional. Enter the current real bank balance in rupees when adding
        the account. The backend converts this to integer paisa.
        Subsequent changes to the balance happen automatically through
        payment and expense journal entries — never edit it directly.
      */}
            <div className="space-y-1.5">
                <Label htmlFor="openingBalance">
                    Opening Balance (Rs){" "}
                    <span className="text-xs font-normal text-slate-500">(Optional)</span>
                </Label>
                <Input
                    id="openingBalance"
                    name="openingBalance"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formik.values.openingBalance}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                />
                <p className="text-xs text-slate-500">
                    Balance updates automatically when payments are recorded.
                    Do not edit this to adjust balances — use a journal entry instead.
                </p>
            </div>

            <Button
                type="submit"
                disabled={formik.isSubmitting}
                className="w-full"
            >
                {formik.isSubmitting ? "Creating..." : "Add Bank Account"}
            </Button>
        </form>
    );
}