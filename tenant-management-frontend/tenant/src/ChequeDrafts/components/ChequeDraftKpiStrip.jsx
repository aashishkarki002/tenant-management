import { ArrowUpRight, ArrowDownLeft, Clock, TrendingUp } from "lucide-react";
import { C } from "../../Loans/loan.constants";
import { formatPaisa } from "../../utils/formatter";

function KpiCard({ label, value, sub, color, bgColor, icon: Icon }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1.5 border"
      style={{ background: bgColor, borderColor: C.border }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color + "22" }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.textMuted }}>
          {label}
        </span>
      </div>
      <div className="text-xl font-bold font-sans" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px]" style={{ color: C.textMuted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function ChequeDraftKpiStrip({ summary, loading, entitySelected }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl h-[88px] animate-pulse" style={{ background: C.surface }} />
        ))}
      </div>
    );
  }



  if (!summary) return null;

  const { pendingIssued, pendingReceived } = summary;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <KpiCard
        label="Issued Pending"
        value={formatPaisa(pendingIssued.totalAmountPaisa)}
        sub={`${pendingIssued.count} cheque${pendingIssued.count !== 1 ? "s" : ""}`}
        color={C.negative}
        bgColor={C.negativeBg}
        icon={ArrowUpRight}
      />
      <KpiCard
        label="Received Pending"
        value={formatPaisa(pendingReceived.totalAmountPaisa)}
        sub={`${pendingReceived.count} cheque${pendingReceived.count !== 1 ? "s" : ""}`}
        color={C.positive}
        bgColor={C.positiveBg}
        icon={ArrowDownLeft}
      />
      <KpiCard
        label="Total Pending"
        value={String(pendingIssued.count + pendingReceived.count)}
        sub="awaiting clearance"
        color={C.amber}
        bgColor={C.amberBg}
        icon={Clock}
      />
      <KpiCard
        label="Net Exposure"
        value={formatPaisa(Math.abs(pendingReceived.totalAmountPaisa - pendingIssued.totalAmountPaisa))}
        sub={pendingReceived.totalAmountPaisa >= pendingIssued.totalAmountPaisa ? "net receivable" : "net payable"}
        color={C.info}
        bgColor={C.infoBg}
        icon={TrendingUp}
      />
    </div>
  );
}
