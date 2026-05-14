import { CheckCircle, XCircle, Ban, ArrowUpRight, ArrowDownLeft, FileText, Clock } from "lucide-react";
import { C, fmtRupees, toBSDate } from "../../Loans/loan.constants";

const STATUS_STYLE = {
  PENDING: { label: "Pending", color: C.amber, bg: C.amberBg, icon: Clock },
  DEPOSITED: { label: "Deposited", color: C.positive, bg: C.positiveBg, icon: CheckCircle },
  BOUNCED: { label: "Bounced", color: C.negative, bg: C.negativeBg, icon: XCircle },
  CANCELLED: { label: "Cancelled", color: C.textMuted, bg: C.surface, icon: Ban },
};

function StatusBadge({ value }) {
  const s = STATUS_STYLE[value] ?? { label: value, color: C.textMuted, bg: C.surface, icon: Clock };
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      <Icon size={9} />
      {s.label}
    </span>
  );
}

/** Show extra context for non-PENDING rows */
function StatusDetail({ draft }) {
  if (draft.status === "DEPOSITED" && draft.depositedAt) {
    return (
      <p className="text-[10px] mt-0.5" style={{ color: C.positive }}>
        Cleared {toBSDate(draft.depositedAt)}
        {draft.depositNotes ? ` · ${draft.depositNotes}` : ""}
      </p>
    );
  }
  if (draft.status === "BOUNCED" && draft.bounceReason) {
    return (
      <p className="text-[10px] mt-0.5" style={{ color: C.negative }}>
        {draft.bounceReason}
      </p>
    );
  }
  return null;
}

export function ChequeDraftsTable({ drafts, loading, onDeposit, onBounce, onCancel }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: C.surface }} />
        ))}
      </div>
    );
  }

  if (!drafts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.surface }}>
          <FileText size={18} style={{ color: C.textMuted }} />
        </div>
        <p className="text-[13px]" style={{ color: C.textMuted }}>No cheque drafts found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: C.border }}>
      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            {["Cheque #", "Date", "Party", "Direction", "Amount", "Status", "Actions"].map((h) => (
              <th
                key={h}
                className={`px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] ${h === "Amount" ? "text-right" : "text-left"}`}
                style={{ color: C.textMuted }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drafts.map((d, i) => (
            <tr
              key={d._id}
              style={{
                borderBottom: i < drafts.length - 1 ? `1px solid ${C.border}` : "none",
                opacity: d.status === "CANCELLED" ? 0.6 : 1,
              }}
              className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150"
            >
              {/* Cheque # */}
              <td className="px-4 py-3 font-mono font-semibold" style={{ color: C.text }}>
                {d.chequeNumber}
              </td>

              {/* Date */}
              <td className="px-4 py-3" style={{ color: C.textMid }}>
                {toBSDate(d.chequeDate)}
              </td>

              {/* Party */}
              <td className="px-4 py-3 max-w-[140px] truncate" style={{ color: C.textMid }}>
                {d.partyName ?? "—"}
              </td>

              {/* Direction */}
              <td className="px-4 py-3">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold"
                  style={{ color: d.direction === "ISSUED" ? C.negative : C.positive }}
                >
                  {d.direction === "ISSUED"
                    ? <><ArrowUpRight size={11} /> Issued</>
                    : <><ArrowDownLeft size={11} /> Received</>
                  }
                </span>
              </td>

              {/* Amount */}
              <td className="px-4 py-3 font-semibold font-sans text-right tabular-nums" style={{ color: C.text }}>
                {fmtRupees(d.amountPaisa)}
              </td>

              {/* Status + detail */}
              <td className="px-4 py-3">
                <StatusBadge value={d.status} />
                <StatusDetail draft={d} />
              </td>

              {/* Actions */}
              <td className="px-4 py-3 whitespace-nowrap">
                {d.status === "PENDING" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onDeposit(d)}
                      className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                      style={{ background: C.positive }}
                      title="Mark deposited — clears to bank"
                    >
                      <CheckCircle size={11} /> Deposit
                    </button>
                    <button
                      onClick={() => onBounce(d)}
                      className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                      style={{ background: C.negative }}
                      title="Mark bounced — reverses journal"
                    >
                      <XCircle size={11} /> Bounce
                    </button>
                    <button
                      onClick={() => onCancel(d)}
                      className="h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border"
                      style={{ borderColor: C.border, color: C.textMid }}
                      title="Cancel cheque — reverses journal"
                    >
                      <Ban size={11} /> Cancel
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
