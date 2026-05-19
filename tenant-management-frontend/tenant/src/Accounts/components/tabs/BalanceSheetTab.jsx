import { useState } from "react";
import {
  ScaleIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  RefreshCwIcon,
  DownloadIcon,
  Loader2Icon,
  BookOpenIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  useBalanceSheet,
} from "../../hooks/useBalanceSheet";
import { exportBalanceSheetPDF } from "../../utils/exportUtils";
import { useEntity } from "../../../context/EntityContext";
import { fmtRs } from "../../../utils/formatter";
import HashLoader from "react-spinners/HashLoader";



// ─────────────────────────────────────────────
// Account Row
// ─────────────────────────────────────────────
function AccountRow({ account }) {
  const isSynthetic = account.isSynthetic;
  const isAbnormal = account.balanceSide?.includes("abnormal");
  const isDebit = account.balanceSide?.startsWith("DR");

  return (
    <div
      className={cn(
        "flex justify-between items-center px-3 py-2 rounded-lg",
        isSynthetic ? "border bg-muted" : "hover:bg-muted"
      )}
    >
      <div className="flex gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground">
          {account.code}
        </span>
        <span
          className={cn(
            "text-sm truncate",
            isSynthetic && "italic text-muted-foreground"
          )}
        >
          {account.name}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            isAbnormal ? "text-red-600" : "text-foreground"
          )}
        >
          {fmtRs(account.balance?.paisa ?? 0)}
        </span>

        {account.balanceSide && account.balanceSide !== "NIL" && (
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded font-bold uppercase",
              isDebit
                ? "bg-blue-100 text-blue-600"
                : "bg-emerald-100 text-emerald-600"
            )}
          >
            {account.balanceSide.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section Card
// ─────────────────────────────────────────────
function SectionCard({
  title,
  accent,
  accounts,
  extraRows = [],
  totalLabel,
  totalAmountObj,
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div
        className="px-4 py-3 border-b"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>

      <div className="p-3 space-y-1">
        {[...accounts, ...extraRows].length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No accounts
          </p>
        ) : (
          [...accounts, ...extraRows].map((acc, i) => (
            <AccountRow key={i} account={acc} />
          ))
        )}
      </div>

      <div className="border-t px-3 py-2 flex justify-between text-sm font-bold">
        <span className="text-muted-foreground">{totalLabel}</span>
        <span>{fmtRs(totalAmountObj?.paisa ?? 0)}</span>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Trial Balance
// ─────────────────────────────────────────────
function TrialBalanceStrip({ trialBalance }) {
  if (!trialBalance) return null;

  const { totalDebit, totalCredit, isBalanced, discrepancy } = trialBalance;

  return (
    <div
      className={cn(
        "p-3 rounded-xl border flex justify-between flex-wrap gap-3",
        isBalanced ? "bg-emerald-50" : "bg-red-50"
      )}
    >
      <div className="text-sm font-semibold">Trial Balance</div>

      <div className="flex gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Debit</p>
          <p className="font-bold text-blue-600">
            {totalDebit?.formatted ?? "—"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Credit</p>
          <p className="font-bold text-emerald-600">
            {totalCredit?.formatted ?? "—"}
          </p>
        </div>

        <div
          className={cn(
            "px-2 py-2 rounded-full text-xs font-bold text-white",
            isBalanced ? "bg-emerald-600" : "bg-red-600"
          )}
        >
          {isBalanced
            ? "Balanced"
            : `Off by ${discrepancy?.formatted}`}
        </div>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function BalanceSheetTab({
  entityId,
  filterProps = {},
  filterLabel,
}) {
  const { balanceSheet, loading, error, refetch } =
    useBalanceSheet(entityId, filterProps);

  const [exporting, setExporting] = useState(false);

  const { entities, activeEntityId } = useEntity();
  const entityName =
    entities?.find((e) => e._id === activeEntityId)?.name ?? "";

  if (loading)
    return (
      <div className="flex items-center justify-center h-[70vh] w-full">
        <HashLoader color="#1a5276" />
      </div>
    );

  if (error)
    return (
      <div className="p-3 bg-red-50 border border-red-500 text-red-600 rounded-xl flex justify-between">
        {error}
        <button onClick={refetch} className="underline">
          Retry
        </button>
      </div>
    );

  if (!balanceSheet) return null;

  const {
    assetAccounts,
    liabilityAccounts,
    equityAccounts,
    retainedEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced,
    discrepancy,
    trialBalance,
  } = balanceSheet;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex justify-between items-center">
        {filterLabel && (
          <span className="text-xs px-2 py-1 bg-muted rounded-full">
            {filterLabel}
          </span>
        )}

        <button
          onClick={async () => {
            setExporting(true);
            await new Promise((r) => setTimeout(r, 0));
            exportBalanceSheetPDF(
              balanceSheet,
              filterLabel,
              entityName
            );
            setExporting(false);
          }}
          className="text-xs px-3 py-1 border rounded flex items-center gap-1"
        >
          {exporting ? (
            <Loader2Icon className="animate-spin" size={12} />
          ) : (
            <DownloadIcon size={12} />
          )}
          Export
        </button>
      </div>



      {/* sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard
          title="Assets"

          accounts={assetAccounts}
          totalLabel="Total Assets"
          totalAmountObj={totalAssets}
        />

        <SectionCard
          title="Liabilities"

          accounts={liabilityAccounts}
          totalLabel="Total Liabilities"
          totalAmountObj={totalLiabilities}
        />

        <SectionCard
          title="Equity"

          accounts={equityAccounts}
          extraRows={retainedEarnings ? [retainedEarnings] : []}
          totalLabel="Total Equity"
          totalAmountObj={totalEquity}
        />
      </div>

      <TrialBalanceStrip trialBalance={trialBalance} />

    </div>
  );
}