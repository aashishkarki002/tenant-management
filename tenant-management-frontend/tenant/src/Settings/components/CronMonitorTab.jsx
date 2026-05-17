import React, { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Play, ChevronRight, CheckCircle2, XCircle,
  Mail, Clock, FileText, AlertTriangle, DollarSign, Users, Zap,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_META = {
  MONTHLY_RENT:            { label: "Rent Documents",      Icon: FileText,      color: "blue" },
  MONTHLY_CAM:             { label: "CAM Documents",       Icon: FileText,      color: "blue" },
  OVERDUE_MARKING:         { label: "Overdue Marking",     Icon: AlertTriangle, color: "amber" },
  RENT_DEFERRAL_RECOGNITION: { label: "Rent Deferral",    Icon: Clock,         color: "purple" },
  MONTHLY_EMAIL:           { label: "Tenant Emails",       Icon: Mail,          color: "indigo" },
  TENANT_BALANCE_REBUILD:  { label: "Balance Rebuild",     Icon: Zap,           color: "teal" },
  LATE_FEE_APPLICATION:    { label: "Late Fees",           Icon: DollarSign,    color: "orange" },
  LOAN_EMI_REMINDER:       { label: "Loan EMI Reminder",   Icon: Clock,         color: "violet" },
  RENT_REMINDER:           { label: "Admin Reminders",     Icon: Users,         color: "sky" },
  MASTER_CRON:             { label: "Master Cron",         Icon: AlertTriangle, color: "red" },
};

const COLOR_MAP = {
  blue:   { dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  amber:  { dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  purple: { dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  indigo: { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  teal:   { dot: "bg-teal-500",   badge: "bg-teal-50 text-teal-700 border-teal-200" },
  orange: { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  violet: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  sky:    { dot: "bg-sky-500",    badge: "bg-sky-50 text-sky-700 border-sky-200" },
  red:    { dot: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NP", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Email delivery timeline ───────────────────────────────────────────────────

function EmailTimeline({ emails }) {
  if (!emails?.length) return <p className="text-xs text-muted-foreground">No email records.</p>;

  const sent   = emails.filter((e) => e.status === "sent");
  const failed = emails.filter((e) => e.status === "failed");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          {sent.length} sent
        </span>
        {failed.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {failed.length} failed
          </span>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {emails.map((em, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${
              em.status === "sent"
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            {em.status === "sent" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-foreground truncate">{em.name || em.email}</span>
                <span className={`shrink-0 font-semibold uppercase tracking-wide text-[10px] ${
                  em.status === "sent" ? "text-emerald-700" : "text-red-600"
                }`}>
                  {em.status}
                </span>
              </div>
              <p className="text-muted-foreground truncate">{em.email}</p>
              {em.sentAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(em.sentAt)}</p>
              )}
              {em.error && (
                <p className="text-red-600 mt-0.5 break-all">{em.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step card in drawer ───────────────────────────────────────────────────────

function StepCard({ step, isLast }) {
  const [open, setOpen] = useState(false);
  const meta  = STEP_META[step.type] ?? { label: step.type, Icon: Clock, color: "sky" };
  const color = COLOR_MAP[meta.color] ?? COLOR_MAP.sky;
  const Icon  = meta.Icon;
  const hasEmails = step.details?.emails?.length > 0;
  const hasErrors = step.details?.errors?.length > 0;

  return (
    <div className="flex gap-3">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${step.success ? "bg-emerald-500" : "bg-red-500"}`} />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${color.badge}`}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>
            {step.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-500" />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(step.ranAt)}</span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">{step.message}</p>
        {step.count != null && step.count > 0 && (
          <p className="text-[11px] font-semibold text-foreground mt-0.5">{step.count} record{step.count !== 1 ? "s" : ""}</p>
        )}
        {step.error && (
          <p className="mt-1 text-[11px] text-red-600 break-all">{step.error}</p>
        )}

        {/* Expandable details */}
        {(hasEmails || hasErrors) && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
            {hasEmails ? `${step.details.emails.length} email records` : `${step.details.errors.length} errors`}
          </button>
        )}
        {open && hasEmails && (
          <div className="mt-2">
            <EmailTimeline emails={step.details.emails} />
          </div>
        )}
        {open && hasErrors && !hasEmails && (
          <div className="mt-2 space-y-1">
            {step.details.errors.map((e, i) => (
              <div key={i} className="rounded bg-red-50 border border-red-200 px-2 py-1.5 text-[11px] text-red-700">
                {e.rentId && <span className="font-mono mr-1">{e.rentId}:</span>}
                {e.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Run detail drawer ─────────────────────────────────────────────────────────

function RunDetailDrawer({ runId, onClose }) {
  const [steps, setSteps]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    api.get(`/api/cron-logs/runs/${runId}`)
      .then((r) => setSteps(r.data.steps ?? []))
      .catch(() => toast.error("Failed to load run details"))
      .finally(() => setLoading(false));
  }, [runId]);

  return (
    <Sheet open={!!runId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[440px] sm:w-[520px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-base">Run Detail</SheetTitle>
          {steps[0] && (
            <p className="text-xs text-muted-foreground">{fmtDate(steps[0].ranAt)}</p>
          )}
        </SheetHeader>

        <div className="pt-5">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps found.</p>
          ) : (
            <div>
              {steps.map((step, i) => (
                <StepCard key={step._id} step={step} isLast={i === steps.length - 1} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Run row in table ──────────────────────────────────────────────────────────

function RunRow({ run, onSelect }) {
  const allOk = run.failed === 0;
  const typePills = [...new Set(run.types ?? [])].slice(0, 4);

  return (
    <tr
      className="border-b border-border hover:bg-secondary/40 cursor-pointer transition-colors"
      onClick={() => onSelect(run.runId ?? run._id)}
    >
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(run.ranAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {typePills.map((t) => {
            const meta  = STEP_META[t];
            const color = meta ? COLOR_MAP[meta.color] : COLOR_MAP.sky;
            return (
              <span key={t} className={`text-[10px] border rounded-full px-2 py-0.5 font-medium ${color.badge}`}>
                {meta?.label ?? t}
              </span>
            );
          })}
          {(run.types?.length ?? 0) > 4 && (
            <span className="text-[10px] text-muted-foreground">+{run.types.length - 4}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-xs font-medium tabular-nums">{run.steps}</span>
      </td>
      <td className="px-4 py-3">
        {allOk ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> OK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <XCircle className="w-3 h-3" /> {run.failed} error{run.failed !== 1 ? "s" : ""}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
      </td>
    </tr>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function CronMonitorTab() {
  const [runs, setRuns]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);

  const fetchRuns = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/cron-logs/runs?page=${p}&limit=20`);
      setRuns(data.runs ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load cron runs");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchRuns(page); }, [page]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.post("/api/cron-logs/trigger");
      toast.success("Cron triggered — refreshing in 5s…");
      setTimeout(() => fetchRuns(1), 5000);
    } catch {
      toast.error("Failed to trigger cron");
    } finally {
      setTriggering(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Cron Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily automation runs — rent creation, emails, late fees, balance rebuilds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => fetchRuns(page)}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleTrigger}
            disabled={triggering}
            className="h-8 gap-1.5 text-xs"
          >
            <Play className="w-3.5 h-3.5" />
            {triggering ? "Triggering…" : "Run Now"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Steps Run</th>
              <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">#</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="bg-background">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No cron runs recorded yet.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <RunRow
                  key={run._id}
                  run={run}
                  onSelect={(rid) => setSelectedRun(rid)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} total runs</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span>Page {page} / {totalPages}</span>
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <RunDetailDrawer runId={selectedRun} onClose={() => setSelectedRun(null)} />
    </div>
  );
}
