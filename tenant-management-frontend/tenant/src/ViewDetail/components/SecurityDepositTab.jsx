import { useState, useEffect } from "react";
import api from "../../../plugins/axios";
import { useAuth } from "../../context/AuthContext";
import { ShieldOff, AlertCircle, Clock, CheckCircle2, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SdRefundWizard from "./SdRefundWizard";
import SdRefundHistory from "./SdRefundHistory";

function fmtRs(paisa) {
  if (paisa == null) return "—";
  return `रू ${(paisa / 100).toLocaleString("en-IN")}`;
}

const STATUS_META = {
  pending: { icon: Clock, label: "Pending Receipt", color: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { icon: ShieldCheck, label: "Held", color: "bg-blue-50 text-blue-700 border-blue-200" },
  held_as_bg: { icon: ShieldCheck, label: "Bank Guarantee", color: "bg-teal-50 text-teal-700 border-teal-200" },
  partially_refunded: { icon: ArrowRightLeft, label: "Partially Settled", color: "bg-orange-50 text-orange-700 border-orange-200" },
  refunded: { icon: CheckCircle2, label: "Fully Settled", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  adjusted: { icon: CheckCircle2, label: "Adjusted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const MODE_LABELS = {
  cash: "Cash",
  cheque: "Cheque",
  bank_transfer: "Bank Transfer",
  bank_guarantee: "Bank Guarantee",
};

export function SecurityDepositTab({ tenantId, blockId, sdId: sdIdProp }) {
  const { user } = useAuth();
  const canSettle = user?.role === "admin" || user?.role === "super_admin";

  const [sd, setSd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const fetchSd = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = sdIdProp ? `/api/sd/get-sd/${sdIdProp}` : `/api/sd/by-tenant/${tenantId}`;
      const res = await api.get(url);
      setSd(res.data?.data ?? res.data?.sd ?? null);
    } catch (e) {
      if (e.response?.status === 404) setSd(null);
      else setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchSd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, sdIdProp]);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!sd) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <ShieldOff className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No security deposit on record</p>
          <p className="text-xs text-muted-foreground">
            A security deposit record will appear here once collected for this tenant.
          </p>
        </CardContent>
      </Card>
    );
  }

  const meta = STATUS_META[sd.status] ?? STATUS_META.paid;
  const StatusIcon = meta.icon;
  const isFullySettled = sd.status === "refunded" || sd.status === "adjusted";
  const totalPaisa = sd.amountPaisa ?? 0;
  const remainingPaisa = sd.remainingAmountPaisa ?? 0;
  const settledPaisa = totalPaisa - remainingPaisa;
  const settledPct = totalPaisa ? Math.round((settledPaisa / totalPaisa) * 100) : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Badge className={`gap-1.5 ${meta.color}`} variant="outline">
              <StatusIcon className="w-3 h-3" />
              {meta.label}
            </Badge>

            {canSettle && !isFullySettled && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setWizardOpen(true)}>
                Settle Deposit
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Amounts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Deposit", value: fmtRs(totalPaisa) },
              { label: "Remaining", value: fmtRs(remainingPaisa) },
              { label: "Mode", value: MODE_LABELS[sd.mode] ?? sd.mode },
              { label: "Received", value: sd.nepaliDate ? `${sd.nepaliDate} BS` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="text-xs font-medium">{value}</p>
              </div>
            ))}
          </div>

          {/* Balance bar */}
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${settledPct}%` }} />
              <div className="bg-primary h-full transition-all" style={{ width: `${100 - settledPct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Settled — {fmtRs(settledPaisa)} ({settledPct}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                Held — {fmtRs(remainingPaisa)} ({100 - settledPct}%)
              </span>
            </div>
          </div>

          {/* Cheque details */}
          {sd.mode === "cheque" && sd.chequeDetails?.chequeNumber && (
            <div className="flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Cheque</span>
              <span className="font-medium text-foreground">
                #{sd.chequeDetails.chequeNumber}
                {sd.chequeDetails.bankName ? ` — ${sd.chequeDetails.bankName}` : ""}
                {sd.chequeDetails.chequeDate
                  ? ` (${new Date(sd.chequeDetails.chequeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`
                  : ""}
              </span>
            </div>
          )}

          {/* Bank guarantee details */}
          {sd.mode === "bank_guarantee" && sd.bankGuaranteeDetails?.bgNumber && (
            <div className="flex justify-between text-xs text-muted-foreground border-t pt-3">
              <span>Bank Guarantee</span>
              <span className="font-medium text-foreground">
                #{sd.bankGuaranteeDetails.bgNumber}
                {sd.bankGuaranteeDetails.bankName ? ` — ${sd.bankGuaranteeDetails.bankName}` : ""}
                {sd.bankGuaranteeDetails.expiryDate
                  ? ` · Expires ${new Date(sd.bankGuaranteeDetails.expiryDate).toLocaleDateString()}`
                  : ""}
              </span>
            </div>
          )}

          <Separator />

          <SdRefundHistory
            sdId={sd._id}
            onInitiateRefund={canSettle && !isFullySettled ? () => setWizardOpen(true) : undefined}
          />
        </CardContent>
      </Card>

      {wizardOpen && (
        <SdRefundWizard
          sdId={sd._id}
          blockId={blockId}
          onSuccess={() => { setWizardOpen(false); fetchSd(); }}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </>
  );
}
