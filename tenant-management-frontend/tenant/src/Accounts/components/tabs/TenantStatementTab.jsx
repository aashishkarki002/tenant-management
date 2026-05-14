import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, RefreshCcw, Download, Printer, Mail, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useTenant } from "../../../hooks/use-tenants";
import api from "../../../../plugins/axios";
// Importing your formatter utilities
import { fmtCurrency, fmtAccounting } from "../../../utils/formatter";

export default function TenantStatementPage() {
  const { tenants, loading: tenantsLoading } = useTenant();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tenantId, setTenantId] = useState("");
  const [dateRange, setDateRange] = useState("");

  const fetchLedger = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/api/ledger/get-tenant-ledger/${tenantId}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchLedger();
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tenant Statement</h1>
            <p className="text-sm text-slate-500 mt-0.5">Financial Ledger for {data?.entries?.[0]?.tenant?.name || "Selected Tenant"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> PDF</Button>
            <Button variant="outline" size="sm"><Printer className="w-4 h-4 mr-2" /> Print</Button>
            <Button size="sm"><Mail className="w-4 h-4 mr-2" /> Share</Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filter Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger><SelectValue placeholder={tenantsLoading ? "Loading..." : "Select Tenant"} /></SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Date Range</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="pl-10" placeholder="YYYY-MM-DD" />
                </div>
              </div>
              <Button onClick={fetchLedger} disabled={!tenantId || loading} className="w-full">
                {loading ? <RefreshCcw className="animate-spin mr-2" /> : "Refresh Ledger"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {data && (
          <>
            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <SummaryTile
                title="Total Receivables"
                paisa={data.summary.paisa.totalDebit}
                icon={<ArrowUpRight className="text-red-500" />}
                sub="Total Invoiced"
              />
              <SummaryTile
                title="Total Credits/TDS"
                paisa={data.summary.paisa.totalCredit}
                icon={<ArrowDownLeft className="text-emerald-500" />}
                sub="Payments & Offsets"
              />
              <Card className="bg-slate-900 text-white">
                <CardContent className="pt-6">
                  <p className="text-xs font-medium uppercase opacity-70">Net Position</p>
                  <p className="text-2xl font-bold mt-1">
                    {fmtCurrency(data.summary.paisa.netBalance)}
                  </p>
                  <p className="text-[10px] mt-2 py-1 px-2 bg-white/10 rounded w-fit">
                    {data.summary.paisa.netBalance === 0 ? "ACCOUNT SETTLED" : "OUTSTANDING BALANCE"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Transactions Table */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Ledger Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="px-6 py-4">Date (BS)</th>
                        <th className="px-6 py-4">Account & Description</th>
                        <th className="px-6 py-4 text-right">Debit (+)</th>
                        <th className="px-6 py-4 text-right">Credit (-)</th>
                        <th className="px-6 py-4 text-right">Running Bal.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.entries.map((entry) => (
                        <tr key={entry._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                            {entry.nepaliDate}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{entry.account.name}</div>
                            <div className="text-xs text-slate-500">{entry.description}</div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono">
                            {entry.paisa.debit > 0 ? fmtAccounting(entry.paisa.debit) : "—"}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-emerald-600">
                            {entry.paisa.credit > 0 ? fmtAccounting(entry.paisa.credit) : "—"}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold">
                            {fmtAccounting(entry.paisa.runningBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ title, paisa, sub, icon }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase">{title}</p>
            <p className="text-2xl font-bold">{fmtCurrency(paisa)}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}