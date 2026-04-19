import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { getTodayNepali, NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Download,
  CheckCircle2,
  Clock,
  FileText,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const fmtRs = (paisa) =>
  `Rs ${(paisa / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const NEPALI_YEARS = (() => {
  const cur = getTodayNepali().year;
  return Array.from({ length: 5 }, (_, i) => cur - i);
})();

// ── Status badge helpers ──────────────────────────────────────────────────────

const TdsStatusBadge = ({ rent }) => {
  if (rent.tdsPaidToGovernment) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border gap-1 text-[11px] font-medium dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="size-3" />
        Paid to Govt
      </Badge>
    );
  }
  if (rent.tdsRecordedInLedger) {
    return (
      <Badge className="bg-orange-50 text-orange-700 border-orange-200 border gap-1 text-[11px] font-medium dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800">
        <Clock className="size-3" />
        Withheld
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-muted-foreground border border-border text-[11px] font-medium">
      Not Recorded
    </Badge>
  );
};

// ── Mark Paid Dialog ──────────────────────────────────────────────────────────

const MarkTdsPaidDialog = ({ rent, open, onClose, onSuccess }) => {
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const monthName =
    rent?.nepaliMonth != null
      ? NEPALI_MONTH_NAMES[rent.nepaliMonth - 1]
      : "—";

  const handleSubmit = async () => {
    if (!rent) return;
    setLoading(true);
    try {
      const form = new FormData();
      if (notes) form.append("tdsPaidNotes", notes);
      if (file) form.append("tdsDocument", file);

      await api.patch(`/api/rent/${rent._id}/tds/mark-paid`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("TDS marked as paid to government");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to mark TDS as paid");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Mark TDS Paid — {monthName} {rent?.nepaliYear}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground mb-0.5">TDS Amount</p>
            <p className="font-semibold text-foreground tabular-nums">
              {rent ? fmtRs(rent.tdsAmountPaisa) : "—"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Reference / Notes
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Challan number or reference"
              className="w-full h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              TDS Receipt
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <div
                className={cn(
                  "flex items-center gap-2 h-9 px-3 text-sm rounded-md border border-dashed border-border bg-background text-muted-foreground",
                  "group-hover:border-ring group-hover:text-foreground transition-colors w-full",
                  file && "border-emerald-400 text-emerald-700 dark:text-emerald-300",
                )}
              >
                <Upload className="size-3.5 shrink-0" />
                <span className="truncate">
                  {file ? file.name : "Upload receipt (PDF/image)"}
                </span>
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving…" : "Confirm Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Tenant TDS Row (expandable) ───────────────────────────────────────────────

const TenantTdsRow = ({ tenant, rents, onMarkPaid, onCertDownload, certLoading }) => {
  const [expanded, setExpanded] = useState(false);

  const totalTdsPaisa = rents.reduce((s, r) => s + (r.tdsAmountPaisa || 0), 0);
  const allPaid = rents.every((r) => r.tdsPaidToGovernment);
  const anyPaid = rents.some((r) => r.tdsPaidToGovernment);
  const unpaidCount = rents.filter((r) => !r.tdsPaidToGovernment).length;

  return (
    <>
      {/* Tenant summary row */}
      <TableRow
        className="cursor-pointer hover:bg-muted/40 border-b border-border"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="w-8 py-3 px-2">
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="py-3">
          <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rents.length} month{rents.length !== 1 ? "s" : ""} with TDS
          </p>
        </TableCell>
        <TableCell className="py-3 tabular-nums text-sm font-semibold text-foreground">
          {fmtRs(totalTdsPaisa)}
        </TableCell>
        <TableCell className="py-3">
          {allPaid ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-[11px] font-medium dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              All paid
            </Badge>
          ) : anyPaid ? (
            <Badge className="bg-orange-50 text-orange-700 border-orange-200 border text-[11px] font-medium dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800">
              {unpaidCount} pending
            </Badge>
          ) : (
            <Badge className="bg-muted text-muted-foreground border border-border text-[11px] font-medium">
              {unpaidCount} pending
            </Badge>
          )}
        </TableCell>
        <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1.5"
            disabled={certLoading === tenant._id}
            onClick={() => onCertDownload(tenant)}
          >
            <Download className="size-3.5" />
            {certLoading === tenant._id ? "Generating…" : "Certificate"}
          </Button>
        </TableCell>
      </TableRow>

      {/* Expanded: per-month rows */}
      {expanded &&
        rents
          .slice()
          .sort((a, b) => (a.nepaliMonth || 0) - (b.nepaliMonth || 0))
          .map((rent) => {
            const monthName =
              rent.nepaliMonth != null
                ? NEPALI_MONTH_NAMES[rent.nepaliMonth - 1]
                : `Month ${rent.nepaliMonth}`;
            return (
              <TableRow
                key={rent._id}
                className="bg-muted/20 border-b border-border/60"
              >
                <TableCell className="py-2 px-2" />
                <TableCell className="py-2 pl-6">
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground">{monthName} {rent.nepaliYear}</span>
                    {rent.tdsReceiptUrl && (
                      <a
                        href={rent.tdsReceiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Receipt
                      </a>
                    )}
                  </div>
                  {rent.tdsPaidNotes && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                      Ref: {rent.tdsPaidNotes}
                    </p>
                  )}
                </TableCell>
                <TableCell className="py-2 tabular-nums text-xs text-foreground">
                  {fmtRs(rent.tdsAmountPaisa)}
                </TableCell>
                <TableCell className="py-2">
                  <TdsStatusBadge rent={rent} />
                </TableCell>
                <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  {!rent.tdsPaidToGovernment && rent.tdsRecordedInLedger && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300"
                      onClick={() => onMarkPaid(rent)}
                    >
                      <CheckCircle2 className="size-3" />
                      Mark Paid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
    </>
  );
};

// ── Main TdsTab ───────────────────────────────────────────────────────────────

export const TdsTab = () => {
  const currentYear = getTodayNepali().year;
  const [year, setYear] = useState(currentYear);
  const [rents, setRents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [markPaidRent, setMarkPaidRent] = useState(null);
  const [certLoading, setCertLoading] = useState(null); // tenantId being downloaded

  const fetchTdsRents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/rent/get-rents?nepaliYear=${year}`);
      if (res.data.success) {
        const all = res.data.rents || [];
        setRents(all.filter((r) => (r.tdsAmountPaisa || 0) > 0));
      }
    } catch (err) {
      toast.error("Failed to load TDS records");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchTdsRents();
  }, [fetchTdsRents]);

  // Group rents by tenant
  const tenantGroups = useMemo(() => {
    const map = new Map();
    for (const rent of rents) {
      const tid = rent.tenant?._id;
      if (!tid) continue;
      if (!map.has(tid)) {
        map.set(tid, { tenant: rent.tenant, rents: [] });
      }
      map.get(tid).rents.push(rent);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.tenant.name || "").localeCompare(b.tenant.name || ""),
    );
  }, [rents]);

  const totalTdsPaisa = useMemo(
    () => rents.reduce((s, r) => s + (r.tdsAmountPaisa || 0), 0),
    [rents],
  );
  const paidCount = rents.filter((r) => r.tdsPaidToGovernment).length;
  const pendingCount = rents.length - paidCount;

  const handleCertDownload = async (tenant) => {
    setCertLoading(tenant._id);
    try {
      const res = await api.get(
        `/api/rent/tds/certificate/${tenant._id}?nepaliYear=${year}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `TDS-Certificate-${tenant.name.replace(/\s+/g, "-")}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to generate TDS certificate",
      );
    } finally {
      setCertLoading(null);
    }
  };

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            TDS Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tax Deducted at Source — per-tenant certificates and payment status
          </p>
        </div>

        {/* Year selector */}
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground outline-none focus:border-ring cursor-pointer"
        >
          {NEPALI_YEARS.map((y) => (
            <option key={y} value={y}>
              {y} BS
            </option>
          ))}
        </select>
      </header>

      {/* Metrics strip */}
      {!loading && rents.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-y-2 rounded-lg border border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3">
          {[
            { label: "Total TDS for year", value: fmtRs(totalTdsPaisa) },
            { label: "Tenants with TDS", value: String(tenantGroups.length) },
            { label: "Months paid to govt", value: String(paidCount) },
            { label: "Months pending", value: String(pendingCount) },
          ].map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && (
                <div className="hidden sm:block h-8 w-px shrink-0 bg-border self-center" />
              )}
              <div className="flex flex-col gap-0.5 min-w-0 px-3 sm:px-4 first:pl-0 last:pr-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {item.value}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
            {loading ? "Loading…" : `${tenantGroups.length} tenant${tenantGroups.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-md bg-muted/50" style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        ) : tenantGroups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-foreground">No TDS records for {year} BS</p>
            <p className="text-xs text-muted-foreground mt-1">
              Rents with TDS deductions will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 px-2" />
                  <TableHead>Tenant</TableHead>
                  <TableHead>Total TDS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantGroups.map(({ tenant, rents: tenantRents }) => (
                  <TenantTdsRow
                    key={tenant._id}
                    tenant={tenant}
                    rents={tenantRents}
                    onMarkPaid={setMarkPaidRent}
                    onCertDownload={handleCertDownload}
                    certLoading={certLoading}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mark Paid Dialog */}
      <MarkTdsPaidDialog
        rent={markPaidRent}
        open={!!markPaidRent}
        onClose={() => setMarkPaidRent(null)}
        onSuccess={fetchTdsRents}
      />
    </div>
  );
};

export default TdsTab;
