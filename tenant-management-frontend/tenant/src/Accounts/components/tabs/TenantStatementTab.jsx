import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import { useTenantStatement } from "../../hooks/useTenantStatement";
import { useTenant } from "../../../hooks/use-tenants";

function fmtPaisa(p = 0) {
  const sign = p < 0 ? "−" : "";
  return `${sign}NPR ${(Math.abs(p) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtNumber(n = 0) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TenantStatementPage() {

  const [dateRange, setDateRange] = useState("01 Shrawan 2080 - 30 Ashoj 2080");
  const { tenants, loading: tenantsLoading } = useTenant();
  const { data, loading, error, refetch } = useTenantStatement(null);

  const balance = data?.closingBalancePaisa ?? 0;
  const isOverdue = balance > 0;

  const openingBalance = data?.openingBalancePaisa ?? 0;
  const totalCharges = data?.totalChargesPaisa ?? 0;
  const totalPayments = data?.totalPaymentsPaisa ?? 0;
  const [form, setForm] = useState({
    tenantId: "",
    amountRupees: "",
    paymentMethod: "bank_transfer",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tenant Statement</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review detailed financial transactions for specific ledger accounts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Statement
            </Button>
            <Button size="sm" className="gap-2 ">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Share via Email
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters Card */}
        <Card className="mb-6 bg-card">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {/* Tenant Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Select Tenant
                </Label>
                <Select
                  value={form.tenantId}
                  onValueChange={(v) => setForm((f) => ({ ...f, tenantId: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Date Range (BS/AD)
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="pl-10"
                    placeholder="01 Shrawan 2080 - 30 Ashoj 2080"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="default" className="flex-1">
                  Apply Filter
                </Button>
                <Button variant="outline" size="icon">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-red-600">{error}</p>
                <Button onClick={refetch} variant="outline" size="sm" className="mt-3">
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Opening Balance */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Opening Balance
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      NPR {fmtNumber(openingBalance / 100)}
                    </p>
                    <p className="text-xs text-slate-500">Starting amount</p>
                  </div>
                </CardContent>
              </Card>

              {/* Total Charges */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Total Charges
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      NPR {fmtNumber(totalCharges / 100)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.chargeCategories?.join(" + ") || "Rent + CAM + Util"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Total Payments */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                      Total Payments
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      NPR {fmtNumber(totalPayments / 100)}
                    </p>
                    <p className="text-xs text-slate-500">Amount received</p>
                  </div>
                </CardContent>
              </Card>

              {/* Closing Balance */}
              <Card className={isOverdue ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}>
                <CardContent className="pt-6">
                  <div className="space-y-1">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isOverdue ? "text-red-600" : "text-emerald-600"}`}>
                      Closing Balance
                      {isOverdue && (
                        <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full">
                          OVERDUE
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-bold ${isOverdue ? "text-red-600" : "text-emerald-600"}`}>
                      NPR {fmtNumber(Math.abs(balance) / 100)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {isOverdue ? "Amount owed" : "Credit balance"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transactions Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-3 px-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Date
                        </th>
                        <th className="py-3 px-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Description
                        </th>
                        <th className="py-3 px-4 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Ref #
                        </th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Debit (Charges)
                        </th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Credit (Payments)
                        </th>
                        <th className="py-3 px-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Running Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.entries ?? []).map((e, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                            {e.nepaliDate ?? e.date?.substring(0, 10)}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-900 font-medium">
                            {e.description}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-500 font-mono">
                            {e.refNumber || "—"}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-mono tabular-nums">
                            {e.debitPaisa ? (
                              <span className="text-slate-900">{fmtNumber(e.debitPaisa / 100)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-mono tabular-nums">
                            {e.creditPaisa ? (
                              <span className="text-emerald-600 font-semibold">
                                {fmtNumber(e.creditPaisa / 100)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-mono font-semibold tabular-nums">
                            <span className={e.runningBalancePaisa > 0 ? "text-red-600" : "text-emerald-600"}>
                              {fmtNumber(Math.abs(e.runningBalancePaisa) / 100)}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Totals Row */}
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan="3" className="py-3 px-4 text-sm text-slate-900 uppercase tracking-wide">
                          Totals (Current Range)
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-mono text-slate-900 tabular-nums">
                          NPR {fmtNumber(totalCharges / 100)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-mono text-emerald-600 tabular-nums">
                          NPR {fmtNumber(totalPayments / 100)}
                        </td>
                        <td className={`py-3 px-4 text-right text-sm font-mono font-bold tabular-nums ${isOverdue ? "text-red-600" : "text-emerald-600"}`}>
                          NPR {fmtNumber(Math.abs(balance) / 100)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Note */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <p>
                    * Statement generated on 2086-07-02 10:45 AM. All figures in Nepali Rupees (NPR).
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span>Verified Entry</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span>Payment Due</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && !error && !data && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-4 text-sm font-medium text-slate-900">No tenant selected</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Select a tenant from the dropdown above to view their statement
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}