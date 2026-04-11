import { CheckCircle, XCircle, Ban, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { C, fmtRupees, toBSDate } from "../../Loans/loan.constants";

const STATUS_STYLE = {
  PENDING: { label: "Pending", color: C.amber, bg: C.amberBg },
  DEPOSITED: { label: "Deposited", color: C.positive, bg: C.positiveBg },
  BOUNCED: { label: "Bounced", color: C.negative, bg: C.negativeBg },
  CANCELLED: { label: "Cancelled", color: C.textMuted, bg: C.surface },
};

function Badge({ value, map }) {
  const s = map[value] ?? { label: value, color: C.textMuted, bg: C.surface };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
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
                className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]"
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
              }}
              className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <td className="px-4 py-3 font-mono font-semibold" style={{ color: C.text }}>
                {d.chequeNumber}
              </td>
              <td className="px-4 py-3" style={{ color: C.textMid }}>
                {toBSDate(d.chequeDate)}
              </td>
              <td className="px-4 py-3 max-w-[140px] truncate" style={{ color: C.textMid }}>
                {d.partyName ?? "—"}
              </td>
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
              <td className="px-4 py-3 font-semibold font-sans" style={{ color: C.text }}>
                {fmtRupees(d.amountPaisa)}
              </td>
              <td className="px-4 py-3">
                <Badge value={d.status} map={STATUS_STYLE} />
              </td>
              <td className="px-4 py-3">
                {d.status === "PENDING" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onDeposit(d)}
                      className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                      style={{ background: C.positive }}
                      title="Mark deposited"
                    >
                      <CheckCircle size={11} /> Deposit
                    </button>
                    <button
                      onClick={() => onBounce(d)}
                      className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                      style={{ background: C.negative }}
                      title="Mark bounced"
                    >
                      <XCircle size={11} /> Bounce
                    </button>
                    <button
                      onClick={() => onCancel(d)}
                      className="h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border"
                      style={{ borderColor: C.border, color: C.textMid }}
                      title="Cancel"
                    >
                      <Ban size={11} />
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
