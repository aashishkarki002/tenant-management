import { useState, useEffect } from "react";
import api from "../../../plugins/axios";
import { ChevronDown, Wrench, Home, Building, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_LABELS = {
  CASH_REFUND:                 "Cash Refund",
  MAINTENANCE_ADJUSTMENT:      "Maintenance Deduction",
  MAINTENANCE_EXPENSE_OFFSET:  "Expense Offset",
  RENT_ADJUSTMENT:             "Rent Adjustment",
  CAM_ADJUSTMENT:              "CAM Adjustment",
  ELECTRICITY_ADJUSTMENT:      "Electricity Adjustment",
};

const TYPE_ICONS = {
  CASH_REFUND:                 <span className="text-[10px] font-mono">RS</span>,
  MAINTENANCE_ADJUSTMENT:      <Wrench className="w-3 h-3" />,
  MAINTENANCE_EXPENSE_OFFSET:  <Wrench className="w-3 h-3" />,
  RENT_ADJUSTMENT:             <Home className="w-3 h-3" />,
  CAM_ADJUSTMENT:              <Building className="w-3 h-3" />,
  ELECTRICITY_ADJUSTMENT:      <Lightbulb className="w-3 h-3" />,
};

const STATUS_STYLES = {
  DRAFT:     "bg-muted text-muted-foreground border-border",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  POSTED:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVERSED:  "bg-red-50 text-red-700 border-red-200",
};

function fmtRs(paisa) {
  if (!paisa && paisa !== 0) return "—";
  return `रू ${(paisa / 100).toLocaleString("en-IN")}`;
}

export default function SdRefundHistory({ sdId, onInitiateRefund }) {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!sdId) return;
    api
      .get(`api/sd-refund/by-sd/${sdId}`)
      .then((r) => setRefunds(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, [sdId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Settlement History</p>
        {onInitiateRefund && (
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onInitiateRefund}>
            + New Settlement
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : refunds.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No settlements recorded yet.</p>
      ) : (
        <div className="space-y-1">
          {refunds.map((r) => {
            const isOpen = expanded === r._id;
            const statusStyle = STATUS_STYLES[r.status] ?? STATUS_STYLES.DRAFT;

            return (
              <div
                key={r._id}
                className="rounded-lg border bg-background overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : r._id)}
                >
                  <div className="flex items-center gap-2.5">
                    <Badge className={`text-[10px] ${statusStyle}`} variant="outline">
                      {r.status}
                    </Badge>
                    <div>
                      <p className="text-xs font-medium">{r.nepaliDate} BS</p>
                      <p className="text-[11px] text-muted-foreground">by {r.processedBy?.name ?? "Admin"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{fmtRs(r.totalAmountPaisa)}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-3 py-2.5 space-y-2 bg-muted/20">
                    {r.lineItems?.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{TYPE_ICONS[item.type] ?? "•"}</span>
                        <span className="flex-1 text-muted-foreground">
                          {TYPE_LABELS[item.type] ?? item.type}
                          {item.note ? ` — ${item.note}` : ""}
                        </span>
                        <span className="font-medium">{fmtRs(item.amountPaisa)}</span>
                      </div>
                    ))}
                    {r.internalNotes && (
                      <p className="text-[11px] text-muted-foreground pt-1 border-t">{r.internalNotes}</p>
                    )}
                    {r.status === "REVERSED" && (
                      <p className="text-[11px] text-red-600 pt-1 border-t">
                        Reversed on {r.reversedAt ? new Date(r.reversedAt).toLocaleDateString() : "—"}
                        {r.reversalReason ? ` — ${r.reversalReason}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
