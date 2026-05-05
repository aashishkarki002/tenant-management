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
      const qs = params.toString();
      const res = await api.get(
        `/api/ledger/get-tenant-ledger/${tenantId}${qs ? `?${qs}` : ""}`
      );
      if (res.data.success) {
        setEntries(res.data.data?.entries ?? []);
        setSummary(res.data.data?.summary ?? null);
        setPage(1);
      } else {
        setError(res.data.message || "Failed to load ledger");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const tenantName = tenant?.name ?? "Tenant";
  const filterLabel =
    startDate && endDate
      ? `${startDate} – ${endDate}`
      : startDate
      ? `From ${startDate}`
      : endDate
      ? `Until ${endDate}`
      : "All time";

  const totals = {
    totalRevenue: summary?.totalCredit ?? 0,
    totalExpenses: summary?.totalDebit ?? 0,
    netCashFlow: summary?.netBalance ?? 0,
  };

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = async () => {
    setExporting("csv");
    await new Promise((r) => setTimeout(r, 0));
    exportLedgerCSV(entries, `${tenantName} · ${filterLabel}`, totals, tenantName);
    setExporting(null);
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    await new Promise((r) => setTimeout(r, 0));
    exportLedgerPDF(entries, totals, `${tenantName} · ${filterLabel}`, tenantName);
    setExporting(null);
  };

  return (
    <Card className="border border-border shadow-sm rounded-xl bg-background">
      <CardHeader className="p-4 sm:p-6 pb-4">
        <div className="flex flex-col gap-4">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
                <BookOpen className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg leading-tight">
                  Tenant Ledger
                </CardTitle>
                {summary && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {summary.totalEntries} entries · {filterLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={loading || entries.length === 0 || exporting !== null}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting === "csv" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                disabled={loading || entries.length === 0 || exporting !== null}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                PDF
              </button>
            </div>
          </div>

          {/* Date filter row */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button
              size="sm"
              onClick={fetchLedger}
              disabled={loading}
              className="h-8 text-xs cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : null}
              Apply
            </Button>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Summary chips */}
          {summary && !loading && (
            <div className="flex flex-wrap gap-2">
              <SummaryChip
                label="Total Credits"
                value={summary.formatted?.totalCredit}
                variant="credit"
                icon={<ArrowUpRight className="w-3 h-3" />}
              />
              <SummaryChip
                label="Total Debits"
                value={summary.formatted?.totalDebit}
                variant="debit"
                icon={<ArrowDownRight className="w-3 h-3" />}
              />
              <SummaryChip
                label="Net Balance"
                value={summary.formatted?.netBalance}
                variant="neutral"
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading ledger…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={fetchLedger}
              className="text-xs text-teal-600 hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block sm:hidden px-4 pb-4 space-y-2">
              {pageEntries.map((entry) => (
                <MobileCard key={entry._id} entry={entry} />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-y border-border bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 w-28">
                      Date (BS)
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">
                      Description
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 w-32">
                      Account
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 text-right w-28">
                      Debit (रू)
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 text-right w-28">
                      Credit (रू)
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 text-right w-32">
                      Balance (रू)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageEntries.map((entry, idx) => (
                    <TableRow
                      key={entry._id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                      }`}
                    >
                      <TableCell className="py-3 text-xs font-mono text-muted-foreground">
                        {entry.nepaliDate ?? formatDate(entry.date)}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-foreground max-w-xs">
                        <span className="line-clamp-2">
                          {entry.description || entry.account?.name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">
                            {entry.account?.name ?? "—"}
                          </span>
                          {entry.account?.code && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {entry.account.code}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-sm">
                        {entry.debit ? (
                          <span className="text-red-600 font-medium">
                            {fmtAmt(entry.debit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-sm">
                        {entry.credit ? (
                          <span className="text-emerald-600 font-medium">
                            {fmtAmt(entry.credit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-sm font-semibold">
                        {entry.runningBalance !== undefined ? (
                          <span
                            className={
                              entry.runningBalance < 0
                                ? "text-red-600"
                                : "text-foreground"
                            }
                          >
                            {fmtAmt(entry.runningBalance)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, entries.length)} of{" "}
                  {entries.length} entries
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs px-3 py-1 rounded border border-border bg-muted/30 font-medium">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
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
            className={`font-semibold mt-0.5 ${
              (entry.runningBalance ?? 0) < 0 ? "text-red-600" : "text-foreground"
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
