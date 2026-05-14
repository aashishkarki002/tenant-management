import { useState, useEffect } from "react";
import api from "../../../plugins/axios";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  exportLedgerCSV,
  exportLedgerPDF,
} from "../../Accounts/utils/exportUtils";

const PAGE_SIZE = 20;

export function TenantLedgerTab({ tenantId, tenant }) {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchLedger = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await api.get(
        `/api/ledger/get-tenant-ledger/${tenantId}?${params}`
      );

      if (res.data.success) {
        setEntries(res.data.data?.entries ?? []);
        setSummary(res.data.data?.summary ?? null);
        setPage(1);
      }
    } catch (e) {
      setError("Failed to load ledger");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tenantName = tenant?.name ?? "Tenant";

  return (
    <Card className="bg-background border-0 shadow-sm rounded-xl">
      {/* HEADER */}
      <CardHeader className="space-y-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium">Tenant Ledger</h2>
            <p className="text-xs text-muted-foreground">
              {tenantName} • {summary?.totalEntries ?? 0} entries
            </p>
          </div>

          <div className="flex gap-2">
            <button className="text-xs text-muted-foreground hover:text-foreground">
              CSV
            </button>
            <button className="text-xs text-muted-foreground hover:text-foreground">
              PDF
            </button>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex items-end gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 text-xs border rounded-md px-2"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 text-xs border rounded-md px-2"
          />
          <button
            onClick={fetchLedger}
            className="h-8 px-3 text-xs bg-foreground text-background rounded-md"
          >
            Apply
          </button>
        </div>

        {/* SUMMARY */}
        {summary && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Cr: {summary.formatted?.totalCredit}</span>
            <span>Dr: {summary.formatted?.totalDebit}</span>
            <span>Net: {summary.formatted?.netBalance}</span>
          </div>
        )}
      </CardHeader>

      {/* CONTENT */}
      <CardContent className="pt-0">
        {loading ? (
          <div className="py-10 text-xs text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="py-10 text-xs text-red-500">{error}</div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-xs text-muted-foreground">
            No entries found
          </div>
        ) : (
          <>
            {/* TABLE */}
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">Date (B.S)</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Voucher No</th>
                    <th className="p-2 text-right">Dr</th>
                    <th className="p-2 text-right">Cr</th>
                    <th className="p-2 text-right">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {pageEntries.map((e) => (
                    <tr
                      key={e._id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="p-2 text-muted-foreground">
                        {e.nepaliDate ?? formatDate(e.date)}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {e.voucherNo}
                      </td>

                      <td className="p-2">
                        {e.description || e.account?.name || "—"}
                      </td>

                      <td className="p-2 text-right text-red-600">
                        {e.debit ? fmtAmt(e.debit) : "—"}
                      </td>

                      <td className="p-2 text-right text-emerald-600">
                        {e.credit ? fmtAmt(e.credit) : "—"}
                      </td>

                      <td className="p-2 text-right font-medium">
                        {fmtAmt(e.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
                <span>
                  {page} / {totalPages}
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MobileCard({ entry }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-foreground line-clamp-2">
          {entry.description || entry.account?.name || "—"}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
          {entry.nepaliDate ?? formatDate(entry.date)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Debit</p>
          <p className="font-semibold text-red-600 mt-0.5">
            {entry.debit ? fmtAmt(entry.debit) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Credit</p>
          <p className="font-semibold text-emerald-600 mt-0.5">
            {entry.credit ? fmtAmt(entry.credit) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Balance</p>
          <p
            className={`font-semibold mt-0.5 ${(entry.runningBalance ?? 0) < 0 ? "text-red-600" : "text-foreground"
              }`}
          >
            {entry.runningBalance !== undefined ? fmtAmt(entry.runningBalance) : "—"}
          </p>
        </div>
      </div>
      {entry.account && (
        <div className="text-[10px] text-muted-foreground font-mono">
          {entry.account.code} · {entry.account.name}
        </div>
      )}
    </div>
  );
}

function SummaryChip({ label, value, variant, icon }) {
  const styles = {
    credit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    debit: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-muted/50 text-foreground border-border",
  };
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${styles[variant]}`}
    >
      {icon}
      <span className="text-[10px] opacity-70">{label}:</span>
      <span className="tabular-nums font-semibold">{value ?? "—"}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No ledger entries</p>
      <p className="text-xs text-muted-foreground mt-1">
        Ledger transactions for this tenant will appear here
      </p>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtAmt(val) {
  return Number(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
