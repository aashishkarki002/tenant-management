import { useState, useEffect } from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarIcon,
  DownloadIcon,
  MailIcon,
  PrinterIcon,
  RefreshCcwIcon,
  UserIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

import { Badge } from "@/components/ui/badge";

import { Skeleton } from "@/components/ui/skeleton";

import { Separator } from "@/components/ui/separator";

import { useTenant } from "../../../hooks/use-tenants";

import api from "../../../../plugins/axios";

import {
  fmtCurrency,
  fmtAccounting,
} from "../../../utils/formatter";

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = "",
  iconClassName = "",
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardDescription className="text-[11px] font-medium uppercase tracking-[0.18em]">
            {title}
          </CardDescription>

          <CardTitle
            className={`text-2xl font-semibold tabular-nums ${valueClassName}`}
          >
            {value}
          </CardTitle>
        </div>

        <div
          className={`rounded-xl border p-2 ${iconClassName}`}
        >
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>

      {subtitle && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton
          key={i}
          className="h-24 w-full rounded-2xl"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-20">
        <div className="rounded-2xl bg-muted p-3">
          <UserIcon className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="mt-4 text-center">
          <h3 className="font-medium">
            No Tenant Selected
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Select a tenant to view the statement
            ledger.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenantStatementPage() {
  const {
    tenants,
    loading: tenantsLoading,
  } = useTenant();

  const [data, setData] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState(null);

  const [tenantId, setTenantId] =
    useState("");

  const [dateRange, setDateRange] =
    useState("");

  const fetchLedger = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await api.get(
        `/api/ledger/get-tenant-ledger/${tenantId}`
      );

      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to load ledger"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchLedger();
    }
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tenant Statement
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Financial ledger and transaction
              history
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <DownloadIcon className="h-4 w-4" />
              PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </Button>

            <Button
              size="sm"
              className="gap-2"
            >
              <MailIcon className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* Filters */}
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">
              Filters
            </CardTitle>

            <CardDescription>
              Filter tenant ledger details
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Tenant */}
              <div className="space-y-2">
                <Label>
                  Tenant
                </Label>

                <Select
                  value={tenantId}
                  onValueChange={setTenantId}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue
                      placeholder={
                        tenantsLoading
                          ? "Loading tenants..."
                          : "Select tenant"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {tenants?.map((tenant) => (
                      <SelectItem
                        key={tenant._id}
                        value={tenant._id}
                      >
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>
                  Date Range
                </Label>

                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={dateRange}
                    onChange={(e) =>
                      setDateRange(
                        e.target.value
                      )
                    }
                    className="h-11 pl-10"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>

              {/* Refresh */}
              <div className="flex items-end">
                <Button
                  onClick={fetchLedger}
                  disabled={
                    !tenantId || loading
                  }
                  className="h-11 w-full gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCcwIcon className="h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCcwIcon className="h-4 w-4" />
                      Refresh Ledger
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>
              Error
            </AlertTitle>

            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {loading && <LoadingState />}

        {/* Empty */}
        {!loading && !data && (
          <EmptyState />
        )}

        {/* Content */}
        {data && !loading && (
          <>
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                title="Total Receivables"
                value={fmtCurrency(
                  data.summary.paisa
                    .totalDebit
                )}
                subtitle="Total invoiced amount"
                icon={ArrowUpRight}
                valueClassName="text-red-500"
                iconClassName="border-red-500/20 bg-red-500/10"
              />

              <SummaryCard
                title="Credits & Payments"
                value={fmtCurrency(
                  data.summary.paisa
                    .totalCredit
                )}
                subtitle="Payments, TDS & offsets"
                icon={ArrowDownLeft}
                valueClassName="text-emerald-600"
                iconClassName="border-emerald-500/20 bg-emerald-500/10"
              />

              <SummaryCard
                title="Net Position"
                value={fmtCurrency(
                  data.summary.paisa
                    .netBalance
                )}
                subtitle={
                  data.summary.paisa
                    .netBalance === 0
                    ? "Account settled"
                    : "Outstanding balance"
                }
                icon={UserIcon}
              />
            </div>

            {/* Ledger */}
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>
                    Ledger Details
                  </CardTitle>

                  <CardDescription className="mt-1">
                    Transaction history and
                    running balances
                  </CardDescription>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tenant
                  </p>

                  <Badge
                    variant="secondary"
                    className="mt-2"
                  >
                    {data.entries?.[0]
                      ?.tenant?.name ||
                      "—"}
                  </Badge>
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>
                          Date
                        </TableHead>

                        <TableHead>
                          Account &
                          Description
                        </TableHead>

                        <TableHead className="text-right">
                          Debit
                        </TableHead>

                        <TableHead className="text-right">
                          Credit
                        </TableHead>

                        <TableHead className="text-right">
                          Running
                          Balance
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {data.entries.map(
                        (entry) => (
                          <TableRow
                            key={entry._id}
                          >
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {
                                entry.nepaliDate
                              }
                            </TableCell>

                            <TableCell>
                              <div className="font-medium">
                                {
                                  entry
                                    .account
                                    .name
                                }
                              </div>

                              <div className="mt-1 text-xs text-muted-foreground">
                                {
                                  entry.description
                                }
                              </div>
                            </TableCell>

                            <TableCell className="text-right tabular-nums">
                              {entry.paisa
                                .debit > 0
                                ? fmtAccounting(
                                  entry
                                    .paisa
                                    .debit
                                )
                                : "—"}
                            </TableCell>

                            <TableCell className="text-right tabular-nums text-emerald-600">
                              {entry.paisa
                                .credit > 0
                                ? fmtAccounting(
                                  entry
                                    .paisa
                                    .credit
                                )
                                : "—"}
                            </TableCell>

                            <TableCell className="text-right font-semibold tabular-nums">
                              {fmtAccounting(
                                entry.paisa
                                  .runningBalance
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}