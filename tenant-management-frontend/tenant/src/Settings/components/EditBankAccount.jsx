/**
 * EditBankAccount.jsx
 *
 * Form for editing an existing bank account. Same fields as AddBankAccount
 * except: no opening balance; shows current balance as read-only.
 * Backend does not allow editing balance via this form.
 *
 * Usage: <EditBankAccount formik={editBankFormik} balanceDisplay="Rs 1,234.00" onCancel={() => close()} />
 */

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function EditBankAccount({ formik, balanceDisplay, onCancel }) {
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
