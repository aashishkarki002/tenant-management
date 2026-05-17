/**
 * ArAgingTab.jsx
 *
 * Minimal modern AR Aging dashboard.
 * Cleaner accounting-focused UI with softer hierarchy,
 * better spacing, and improved readability.
 */

import {
  AlertCircleIcon,
  RefreshCwIcon,
  UserIcon,
  CalendarIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Skeleton } from "@/components/ui/skeleton";

import { useArAging } from "../../hooks/useArAging";
import { fmtRs } from "../../../utils/formatter";

const BUCKETS = [
  {
    key: "current",
    label: "Current",
    textClass:
      "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "1_month",
    label: "1 Mo",
    textClass:
      "text-amber-600 dark:text-amber-400",
  },
  {
    key: "2_months",
    label: "2 Mo",
    textClass:
      "text-orange-600 dark:text-orange-400",
  },
  {
    key: "3_months",
    label: "3 Mo",
    textClass: "text-red-500 dark:text-red-400",
  },
  {
    key: "over_3",
    label: "3+ Mo",
    textClass: "text-red-600 dark:text-red-500",
  },
];

function SummaryMetric({
  title,
  value,
  description,
  icon: Icon,
  valueClassName = "",
  iconClassName = "",
}) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardContent className="">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>

            <div
              className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${valueClassName}`}
            >
              {value}
            </div>

            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          <div
            className={`rounded-xl border bg-muted/40 p-2 ${iconClassName}`}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TenantRow({ tenant }) {
  const highestBucket = BUCKETS.reduce(
    (best, bucket) => {
      const amount =
        tenant.buckets?.[bucket.key]?.paisa ?? 0;

      if (amount > best.amount) {
        return {
          amount,
          textClass: bucket.textClass,
        };
      }

      return best;
    },
    {
      amount: 0,
      textClass: "text-foreground",
    }
  );

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="min-w-[240px] py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/40">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-0.5">
            <div className="font-medium text-foreground">
              {tenant.tenantName}
            </div>

            {tenant.propertyName && (
              <div className="text-xs text-muted-foreground">
                {tenant.propertyName}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {BUCKETS.map((bucket) => {
        const amount =
          tenant.buckets?.[bucket.key]?.paisa ?? 0;

        return (
          <TableCell
            key={bucket.key}
            className="py-4 text-right text-sm"
          >
            {amount > 0 ? (
              <span
                className={`font-medium tabular-nums ${bucket.textClass}`}
              >
                {fmtRs(amount)}
              </span>
            ) : (
              <span className="text-muted-foreground">
                —
              </span>
            )}
          </TableCell>
        );
      })}

      <TableCell
        className={`py-4 text-right text-sm font-semibold tabular-nums ${highestBucket.textClass}`}
      >
        {fmtRs(tenant.total?.paisa ?? 0)}
      </TableCell>
    </TableRow>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <Skeleton
          key={i}
          className="h-20 w-full rounded-2xl"
        />
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <Card className="border-red-200 shadow-none dark:border-red-900">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-14">
        <div className="rounded-2xl bg-red-500/10 p-3">
          <AlertCircleIcon className="h-6 w-6 text-red-500" />
        </div>

        <div className="space-y-1 text-center">
          <p className="font-medium text-red-500">
            Failed to load AR Aging
          </p>

          <p className="text-sm text-muted-foreground">
            {error}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCwIcon className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-center justify-center py-20">
        <div className="rounded-2xl bg-emerald-500/10 p-3">
          <UserIcon className="h-6 w-6 text-emerald-500" />
        </div>

        <div className="mt-4 text-center">
          <p className="font-medium">
            No Outstanding Receivables
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            All tenant rent balances are settled.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ArAgingTab({
  entityId,
}) {
  const {
    data,
    loading,
    error,
    refetch,
  } = useArAging(entityId);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={refetch}
      />
    );
  }

  if (!data) return null;

  const {
    tenants = [],
    grandTotal,
    asOf,
  } = data;

  const totalOutstanding =
    grandTotal?.total?.paisa ?? 0;

  const over3Paisa =
    grandTotal?.buckets?.over_3?.paisa ?? 0;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetric
          title="Total Outstanding"
          value={fmtRs(totalOutstanding)}
          description={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""
            } with unpaid balances`}
          icon={UserIcon}
        />

        <SummaryMetric
          title="3+ Months Overdue"
          value={fmtRs(over3Paisa)}
          description={
            over3Paisa > 0
              ? "Requires immediate follow-up"
              : "No critical overdue balances"
          }
          icon={AlertCircleIcon}
          valueClassName={
            over3Paisa > 0
              ? "text-red-500"
              : ""
          }
          iconClassName={
            over3Paisa > 0
              ? "border-red-500/20 bg-red-500/10"
              : ""
          }
        />

        <SummaryMetric
          title="Report Period"
          value={`BS ${asOf?.bsYear}/${String(
            asOf?.bsMonth
          ).padStart(2, "0")}`}
          description="Current accounting month"
          icon={CalendarIcon}
        />
      </div>

      {/* Table */}
      {tenants.length === 0 ? (
        <EmptyState />
      ) : (
        <Card className="border-border/60 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle className="text-base font-semibold">
                Accounts Receivable Aging
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Outstanding balances grouped by overdue
                duration
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="gap-2"
            >
              <RefreshCwIcon className="h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-12 min-w-[240px] px-6">
                      Tenant
                    </TableHead>

                    {BUCKETS.map((bucket) => (
                      <TableHead
                        key={bucket.key}
                        className={`h-12 text-right ${bucket.textClass}`}
                      >
                        {bucket.label}
                      </TableHead>
                    ))}

                    <TableHead className="h-12 pr-6 text-right">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {tenants.map((tenant) => (
                    <TenantRow
                      key={tenant.tenantId}
                      tenant={tenant}
                    />
                  ))}

                  {/* Grand Total */}
                  <TableRow className="border-t bg-muted/40 hover:bg-muted/40">
                    <TableCell className="px-6 py-4 font-semibold uppercase tracking-wide text-muted-foreground">
                      Grand Total
                    </TableCell>

                    {BUCKETS.map((bucket) => {
                      const amount =
                        grandTotal?.buckets?.[
                          bucket.key
                        ]?.paisa ?? 0;

                      return (
                        <TableCell
                          key={bucket.key}
                          className={`py-4 text-right font-semibold tabular-nums ${bucket.textClass}`}
                        >
                          {amount > 0
                            ? fmtRs(amount)
                            : "—"}
                        </TableCell>
                      );
                    })}

                    <TableCell className="pr-6 text-right text-base font-bold tabular-nums">
                      {fmtRs(
                        grandTotal?.total?.paisa ??
                        0
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}