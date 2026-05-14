import { useState } from "react";
import api from "../../../plugins/axios";
import { exportLedgerCSV, exportLedgerPDF } from "../../Accounts/utils/exportUtils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

export function TenantLedgerTab({ tenantId, tenant }) {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
      const res = await api.get(`/api/ledger/get-tenant-ledger/${tenantId}?${params}`);
      if (res.data.success) {
        setEntries(res.data.data?.entries ?? []);
        setSummary(res.data.data?.summary ?? null);
        setPage(1);
      }
    } catch {
      setError("Failed to load ledger");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tenantName = tenant?.name ?? "Tenant";

  const filterLabel =
    startDate && endDate ? `${startDate} to ${endDate}` :
    startDate ? `From ${startDate}` :
    endDate ? `Until ${endDate}` : "All entries";

  const totals = {
    totalRevenue: summary?.totalCredit ?? 0,
    totalExpenses: summary?.totalDebit ?? 0,
    netCashFlow: summary?.netBalance ?? 0,
  };

  const handleCSV = () => exportLedgerCSV(entries, filterLabel, totals, tenantName);
  const handlePDF = () => exportLedgerPDF(entries, totals, filterLabel, tenantName);

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Tenant Ledger</p>
            <p className="text-xs text-muted-foreground">
              {tenantName} · {summary?.totalEntries ?? 0} entries
            </p>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <button
              onClick={handleCSV}
              disabled={entries.length === 0}
              className="hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              CSV
            </button>
            <button
              onClick={handlePDF}
              disabled={entries.length === 0}
              className="hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              PDF
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 text-xs w-36"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 text-xs w-36"
          />
          <Button size="sm" onClick={fetchLedger} className="h-8 text-xs">
            Apply
          </Button>
        </div>

        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Cr: {summary.formatted?.totalCredit}</span>
            <span>Dr: {summary.formatted?.totalDebit}</span>
            <span>Net: {summary.formatted?.netBalance}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-10 text-xs text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <p className="py-10 text-xs text-muted-foreground">No entries found</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date (B.S)</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Voucher No</TableHead>
                  <TableHead className="text-xs text-right">Dr</TableHead>
                  <TableHead className="text-xs text-right">Cr</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageEntries.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.nepaliDate ?? formatDate(e.date)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.voucherNo}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.description || e.account?.name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right text-red-600">
                      {e.debit ? fmtAmt(e.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right text-emerald-600">
                      {e.credit ? fmtAmt(e.credit) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {fmtAmt(e.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{page} / {totalPages}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                  >
                    Next
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

function formatDate(date) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function fmtAmt(val) {
  return Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
