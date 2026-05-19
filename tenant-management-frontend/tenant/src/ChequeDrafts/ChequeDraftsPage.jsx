import { useCallback, useMemo, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { C } from "../Loans/loan.constants";
import { useChequeDrafts, useChequeDraftSummary } from "./hooks/useChequeDrafts";
import { ChequeDraftKpiStrip } from "./components/ChequeDraftKpiStrip";
import { ChequeDraftsTable } from "./components/ChequeDraftsTable";
import { DepositDialog } from "./components/DepositDialog";
import { BounceDialog } from "./components/BounceDialog";

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "DEPOSITED", label: "Deposited" },
  { key: "BOUNCED", label: "Bounced" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function ChequeDraftsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Dialog state
  const [depositTarget, setDepositTarget] = useState(null);
  const [bounceTarget, setBounceTarget] = useState(null);
  const [bounceMode, setBounceMode] = useState("bounce"); // "bounce" | "cancel"

  const filters = useMemo(() => {
    const f = {};
    if (statusFilter !== "ALL") f.status = statusFilter;
    return f;
  }, [statusFilter]);

  const { drafts, loading, refetch } = useChequeDrafts(filters);
  const { summary, loading: summaryLoading, refetch: refetchSummary } = useChequeDraftSummary(null);

  const handleRefresh = useCallback(() => { refetch(); refetchSummary(); }, [refetch, refetchSummary]);

  // Status tab counts
  const countsByStatus = useMemo(() => {
    const counts = { ALL: drafts.length };
    for (const d of drafts) {
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return counts;
  }, [drafts]);

  useHeaderSlot(
    () => (
      <Button size="sm" variant="outline" onClick={handleRefresh} className="gap-1.5">
        <RefreshCw size={13} /> Refresh
      </Button>
    ),
    [handleRefresh]
  );

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6 w-full">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: C.infoBg }}
        >
          <FileText size={18} style={{ color: C.info }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: C.text }}>
            Cheque Drafts
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: C.textMuted }}>
            Track pending cheques from issuance to bank clearance.
          </p>
        </div>
      </div>

      {/* ── KPI summary ── */}
      <ChequeDraftKpiStrip summary={summary} loading={summaryLoading} entitySelected={true} />

      {/* ── Data zone: tabs + table (tightly coupled) ── */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 border-b" style={{ borderColor: C.border }}>
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            const count = countsByStatus[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="relative px-4 pb-2.5 text-[12px] font-semibold transition-colors duration-150 flex items-center gap-1.5 focus-visible:outline-none focus-visible:rounded"
                style={{ color: active ? C.accent : C.textMuted }}
              >
                {tab.label}
                {count != null && count > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: active ? C.accent + "22" : C.surface,
                      color: active ? C.accent : C.textMuted,
                    }}
                  >
                    {count}
                  </span>
                )}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: C.accent }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <ChequeDraftsTable
          drafts={drafts}
          loading={loading}
          onDeposit={(d) => setDepositTarget(d)}
          onBounce={(d) => { setBounceMode("bounce"); setBounceTarget(d); }}
          onCancel={(d) => { setBounceMode("cancel"); setBounceTarget(d); }}
        />
      </div>

      {/* ── Dialogs ── */}
      <DepositDialog
        draft={depositTarget}
        open={!!depositTarget}
        onOpenChange={(o) => { if (!o) setDepositTarget(null); }}
        onSuccess={handleRefresh}
      />
      <BounceDialog
        draft={bounceTarget}
        mode={bounceMode}
        open={!!bounceTarget}
        onOpenChange={(o) => { if (!o) setBounceTarget(null); }}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
