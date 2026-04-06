import { Label } from "@/components/ui/label";

import { Input } from "@/components/ui/input";

import {

    Select, SelectTrigger, SelectValue,

    SelectContent, SelectItem,

} from "@/components/ui/select";

import {

    PAYMENT_METHODS,

    getLedgerPaymentMethodSelectOptions,

    paymentMethodRequiresBankAccount,

} from "@/constants/paymentMethods.js";

import { getNepaliMonthOptionsWithNumber } from "@/utils/nepaliDate";



const NEPALI_MONTH_OPTIONS = getNepaliMonthOptionsWithNumber({ lang: "en" });



/**

 * Renders the Nepali date + payment method fields that the backend

 * requires whenever a cost is present on a fuel refill or service log.

 *

 * Props:

 *   form          { nepaliDate, nepaliMonth, nepaliYear, paymentMethod, bankAccountId }

 *   onChange      (patch: object) => void   — merges patch into parent form state

 *   bankAccounts  [{ _id, name, accountCode }]  — list from /api/banks or similar

 *   required      boolean  — shows a "Required when cost is entered" hint

 */

export function NepaliDateFields({ form, onChange, bankAccounts = [], required = false }) {

    const needsBank = paymentMethodRequiresBankAccount(form.paymentMethod);



    return (

        <div className="space-y-3 pt-2 border-t border-dashed border-gray-200 mt-1">

            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">

                Accounting{required ? <span className="text-red-400 ml-1">*</span> : " (if cost is entered)"}

            </p>



            {/* Nepali Date (as text — backend accepts ISO string) */}

            <div>

                <Label>Nepali Date</Label>

                <Input

                    type="date"

                    className="mt-1"

                    value={form.nepaliDate || ""}

                    onChange={e => onChange({ nepaliDate: e.target.value })}

                />

            </div>



            <div className="grid grid-cols-2 gap-3">

                {/* Nepali Month */}

                <div>

                    <Label>Nepali Month</Label>

                    <Select

                        value={form.nepaliMonth ? String(form.nepaliMonth) : ""}

                        onValueChange={v => onChange({ nepaliMonth: Number(v) })}

                    >

                        <SelectTrigger className="mt-1"><SelectValue placeholder="Month" /></SelectTrigger>

                        <SelectContent>

                            {NEPALI_MONTH_OPTIONS.map(m => (

                                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>

                            ))}

                        </SelectContent>

                    </Select>

                </div>



                {/* Nepali Year */}

                <div>

                    <Label>Nepali Year</Label>

                    <Input

                        type="number"

                        className="mt-1"

                        placeholder="e.g. 2081"

                        min={2070}

                        max={2100}

                        value={form.nepaliYear || ""}

                        onChange={e => onChange({ nepaliYear: e.target.value })}

                    />

                </div>

            </div>



            {/* Payment Method */}

            <div>

                <Label>Payment Method</Label>

                <Select

                    value={form.paymentMethod || PAYMENT_METHODS.BANK_TRANSFER}

                    onValueChange={v => onChange({ paymentMethod: v, bankAccountId: "" })}

                >

                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>

                    <SelectContent>

                        {getLedgerPaymentMethodSelectOptions().map(m => (

                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>

                        ))}

                    </SelectContent>

                </Select>

            </div>



            {/* Bank Account — only when bank_transfer or cheque */}

            {needsBank && (

                <div>

                    <Label>Bank Account</Label>

                    {bankAccounts.length === 0 ? (

                        <p className="text-xs text-amber-600 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">

                            No bank accounts loaded. Cash will be used as fallback.

                        </p>

                    ) : (

                        <Select

                            value={form.bankAccountId || ""}

                            onValueChange={v => onChange({ bankAccountId: v })}

                        >

                            <SelectTrigger className="mt-1">

                                <SelectValue placeholder="Select bank account" />

                            </SelectTrigger>

                            <SelectContent>

                                {bankAccounts.map(b => (

                                    <SelectItem key={b._id} value={b._id}>

                                        {b.name} {b.accountCode ? `· ${b.accountCode}` : ""}

                                    </SelectItem>

                                ))}

                            </SelectContent>

                        </Select>

                    )}

                </div>

            )}

        </div>

    );

}

