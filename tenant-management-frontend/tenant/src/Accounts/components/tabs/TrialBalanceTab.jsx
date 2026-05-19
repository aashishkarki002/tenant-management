import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import { Skeleton } from "../AccountingPrimitives";
import { useTrialBalance } from "../../hooks/useTrialBalance";
import { useEntity } from "../../../context/EntityContext";
import { fmtRs } from "../../../utils/formatter";

const TYPE_LABELS = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

const TYPE_ORDER = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

function SectionHeader({ type }) {
  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell
        colSpan={4}
        className="pt-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {TYPE_LABELS[type] ?? type}
      </TableCell>
    </TableRow>
  );
}

function AccountRow({ row }) {
  const debit =
    row.balanceSide === "DR" ||
    row.balanceSide === "CR (abnormal)";

  const credit =
    row.balanceSide === "CR" ||
    row.balanceSide === "DR (abnormal)";

  const isAbnormal = row.balanceSide?.includes("abnormal");

  return (
    <TableRow className="h-11">
      <TableCell className="text-xs text-muted-foreground w-[90px]">
        {row.code}
      </TableCell>

      <TableCell className="text-sm font-medium">
        <div className="flex items-center gap-2">
          <span>{row.name}</span>

          {isAbnormal && (
            <AlertTriangleIcon className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
      </TableCell>

      <TableCell className="text-right text-sm tabular-nums">
        {debit ? fmtRs(row.balance?.paisa ?? 0) : "—"}
      </TableCell>

      <TableCell
        className={`text-right text-sm tabular-nums ${isAbnormal ? "text-destructive" : ""
          }`}
      >
        {credit ? fmtRs(row.balance?.paisa ?? 0) : "—"}
      </TableCell>
    </TableRow>
  );
}

export default function TrialBalanceTab({ filterProps = {}, entityId: entityIdProp }) {
  const { activeEntityId } = useEntity();
  const resolvedEntityId = entityIdProp ?? activeEntityId ?? null;

  const {
    data,
    loading,
    error,
    refetch,
  } = useTrialBalance(
    resolvedEntityId,
    filterProps,
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-full rounded-xl"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
          <AlertTriangleIcon className="h-5 w-5 text-destructive" />

          <p className="text-sm text-muted-foreground">
            {error}
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const {
    rows = [],
    totals,
    isBalanced,
    discrepancy,
  } = data;

  const grouped = {};

  for (const row of rows) {
    (grouped[row.type] = grouped[row.type] ?? []).push(
      row,
    );
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">
              Trial Balance
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Debit and credit summary of all ledger
              accounts.
            </p>
          </div>

          <div
            className={`flex items-center gap-2 text-sm font-medium ${isBalanced
                ? "text-green-600"
                : "text-destructive"
              }`}
          >
            {isBalanced ? (
              <>
                <CheckCircle2Icon className="h-4 w-4" />
                Balanced
              </>
            ) : (
              <>
                <AlertTriangleIcon className="h-4 w-4" />
                Difference:{" "}
                {fmtRs(discrepancy?.paisa ?? 0)}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">
                    Code
                  </TableHead>

                  <TableHead>Account</TableHead>

                  <TableHead className="text-right">
                    Debit
                  </TableHead>

                  <TableHead className="text-right">
                    Credit
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {TYPE_ORDER.map((type) =>
                  grouped[type]?.length ? (
                    <>
                      <SectionHeader
                        key={`hdr-${type}`}
                        type={type}
                      />

                      {grouped[type].map((row) => (
                        <AccountRow
                          key={`${row.code}-${type}`}
                          row={row}
                        />
                      ))}
                    </>
                  ) : null,
                )}

                {/* Total */}
                <TableRow className="border-t-2 font-semibold bg-muted/30">
                  <TableCell
                    colSpan={2}
                    className="text-sm"
                  >
                    Grand Total
                  </TableCell>

                  <TableCell className="text-right text-sm tabular-nums">
                    {fmtRs(
                      totals?.totalDebit?.paisa ?? 0,
                    )}
                  </TableCell>

                  <TableCell className="text-right text-sm tabular-nums">
                    {fmtRs(
                      totals?.totalCredit?.paisa ?? 0,
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}