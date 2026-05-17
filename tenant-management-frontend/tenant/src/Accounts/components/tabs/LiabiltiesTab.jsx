import { useState, useEffect, useCallback, useMemo } from "react";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Filter,
    Plus,
    Printer,
    RefreshCw,
} from "lucide-react";

import api from "../../../../plugins/axios";
import { fmtRs } from "../../../utils/formatter";
import { useEntity } from "../../../context/EntityContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs";

import {
    Badge
} from "@/components/ui/badge";

import {
    Progress
} from "@/components/ui/progress";

import {
    Skeleton
} from "@/components/ui/skeleton";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const pct = (part, total) =>
    total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0;

const LOAN_STATUS = {
    ACTIVE: {
        label: "Active",
        style: {
            background: "var(--color-info-bg)",
            color: "var(--color-info)",
            borderColor: "var(--color-info-border)",
        },
    },
    CLOSED: {
        label: "Closed",
        style: {
            background: "var(--color-success-bg)",
            color: "var(--color-success)",
            borderColor: "var(--color-success-border)",
        },
    },
    DEFAULTED: {
        label: "Defaulted",
        style: {
            background: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            borderColor: "var(--color-danger-border)",
        },
    },
};

const REF_LABELS = {
    RENT_EXPENSE: "Rent",
    CAM: "CAM",
    SALARY: "Salary",
    MANUAL: "Manual",
    SECURITY_DEPOSIT: "Deposit",
    LOAN: "Loan",
};

function agingBucket(dateStr) {
    const days = Math.floor(
        (Date.now() - new Date(dateStr)) / 86400000
    );

    if (days <= 30)
        return {
            label: "0–30 days",
            style: {
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                borderColor: "var(--color-success-border)",
            },
        };

    if (days <= 60)
        return {
            label: "31–60 days",
            style: {
                background: "var(--color-warning-bg)",
                color: "var(--color-warning)",
                borderColor: "var(--color-warning-border)",
            },
        };

    if (days <= 90)
        return {
            label: "61–90 days",
            style: {
                background: "var(--color-warning-bg)",
                color: "var(--color-warning)",
                borderColor: "var(--color-warning-border)",
            },
        };

    return {
        label: "90+ days",
        style: {
            background: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            borderColor: "var(--color-danger-border)",
        },
    };
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

function useLiabilities(entityId = null) {
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);

            const params = {};
            if (entityId) params.entityId = entityId;

            const res = await api.get("/api/liabilities", {
                params,
            });

            setAll(res.data?.data ?? []);
        } catch (err) {
            console.error("[useLiabilities]", err);
            setAll([]);
        } finally {
            setLoading(false);
        }
    }, [entityId]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return {
        all,
        loading,
        refetch: fetch,
    };
}

// ─────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────

function Empty({ message = "Nothing to display" }) {
    return (
        <div className="flex flex-col items-center justify-center py-14 text-center">
            <CheckCircle2 className="h-7 w-7 text-muted-foreground/40 mb-2" />

            <p className="text-sm font-medium">{message}</p>

            <p className="text-xs text-muted-foreground mt-1">
                Nothing available for the selected period.
            </p>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    actions,
    children,
}) {
    return (
        <Card className="shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b pb-4">
                <div>
                    <h3 className="text-sm font-semibold">
                        {title}
                    </h3>

                    {subtitle && (
                        <p className="text-xs text-muted-foreground mt-1">
                            {subtitle}
                        </p>
                    )}
                </div>

                {actions}
            </CardHeader>

            <CardContent className="p-4">
                {children}
            </CardContent>
        </Card>
    );
}

function KPI({
    label,
    value,
    sub,
    danger,
    loading,
}) {
    return (
        <div className="flex flex-col gap-1 p-5 border-r last:border-r-0">
            <span className="text-xs text-muted-foreground">
                {label}
            </span>

            {loading ? (
                <Skeleton className="h-7 w-24" />
            ) : (
                <span
                    className="text-2xl font-bold tracking-tight tabular-nums"
                    style={{
                        color: danger
                            ? "var(--color-danger)"
                            : "var(--color-text-strong)",
                    }}
                >
                    {value}
                </span>
            )}

            {!loading && (
                <span className="text-xs text-muted-foreground">
                    {sub}
                </span>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────

function OverviewContent({ all, loading }) {
    const totalPaisa = all.reduce(
        (s, l) => s + l.amountPaisa,
        0
    );

    const loans = all.filter(
        (l) => l.referenceType === "LOAN"
    );

    const deposits = all.filter(
        (l) =>
            l.referenceType === "SECURITY_DEPOSIT"
    );

    const payables = all.filter(
        (l) =>
            l.referenceType !== "LOAN" &&
            l.referenceType !== "SECURITY_DEPOSIT"
    );

    const overdueCount = all.filter(
        (l) =>
            agingBucket(l.date).label === "90+ days"
    ).length;

    const byCategory = useMemo(() => {
        const map = {};

        for (const l of all) {
            const key =
                REF_LABELS[l.referenceType] ??
                l.referenceType;

            if (!map[key]) {
                map[key] = {
                    count: 0,
                    paisa: 0,
                };
            }

            map[key].count++;
            map[key].paisa += l.amountPaisa;
        }

        return Object.entries(map)
            .sort((a, b) => b[1].paisa - a[1].paisa)
            .map(([label, data]) => ({
                label,
                ...data,
            }));
    }, [all]);

    return (
        <div className="space-y-4">
            {/* KPI */}
            <Card className="overflow-hidden shadow-none">
                <div className="grid grid-cols-2 lg:grid-cols-4">
                    <KPI
                        label="Total liabilities"
                        value={fmtRs(totalPaisa)}
                        sub={`${all.length} obligations`}
                        loading={loading}
                    />

                    <KPI
                        label="Loan outstanding"
                        value={fmtRs(
                            loans.reduce(
                                (s, l) => s + l.amountPaisa,
                                0
                            )
                        )}
                        sub={`${loans.length} active loans`}
                        loading={loading}
                    />

                    <KPI
                        label="Deposit obligations"
                        value={fmtRs(
                            deposits.reduce(
                                (s, l) => s + l.amountPaisa,
                                0
                            )
                        )}
                        sub={`${deposits.length} tenants`}
                        loading={loading}
                    />

                    <KPI
                        label="Overdue (90+)"
                        value={String(overdueCount)}
                        sub={
                            overdueCount > 0
                                ? "Needs attention"
                                : "All healthy"
                        }
                        loading={loading}
                        danger={overdueCount > 0}
                    />
                </div>
            </Card>

            {/* Category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel
                    title="By category"
                    subtitle="Where you owe the most"
                >
                    <div className="space-y-4">
                        {loading &&
                            [1, 2, 3].map((i) => (
                                <Skeleton
                                    key={i}
                                    className="h-10 w-full"
                                />
                            ))}

                        {!loading &&
                            byCategory.map((cat) => (
                                <div
                                    key={cat.label}
                                    className="space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {cat.label}
                                            </p>

                                            <p className="text-xs text-muted-foreground">
                                                {cat.count} items
                                            </p>
                                        </div>

                                        <span className="text-sm font-bold tabular-nums">
                                            {fmtRs(cat.paisa)}
                                        </span>
                                    </div>

                                    <Progress
                                        value={pct(
                                            cat.paisa,
                                            totalPaisa
                                        )}
                                    />
                                </div>
                            ))}
                    </div>
                </Panel>

                <Panel
                    title="Aging analysis"
                    subtitle="Outstanding duration"
                >
                    <div className="space-y-4">
                        {[
                            "0–30 days",
                            "31–60 days",
                            "61–90 days",
                            "90+ days",
                        ].map((bucket) => {
                            const amount = all
                                .filter(
                                    (l) =>
                                        agingBucket(l.date)
                                            .label === bucket
                                )
                                .reduce(
                                    (s, l) =>
                                        s + l.amountPaisa,
                                    0
                                );

                            return (
                                <div
                                    key={bucket}
                                    className="space-y-2"
                                >
                                    <div className="flex justify-between">
                                        <span className="text-sm font-medium">
                                            {bucket}
                                        </span>

                                        <span className="text-sm font-bold tabular-nums">
                                            {fmtRs(amount)}
                                        </span>
                                    </div>

                                    <Progress
                                        value={pct(
                                            amount,
                                            totalPaisa
                                        )}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {!loading && overdueCount > 0 && (
                        <div
                            className="mt-5 flex items-center gap-2 rounded-lg border px-3 py-2"
                            style={{
                                background: "var(--color-danger-bg)",
                                color: "var(--color-danger)",
                                borderColor: "var(--color-danger-border)",
                            }}
                        >
                            <AlertTriangle className="h-4 w-4" />

                            <span className="text-xs font-medium">
                                {overdueCount} obligations
                                past 90 days.
                            </span>
                        </div>
                    )}
                </Panel>
            </div>

            {/* Top Payables */}
            <Panel
                title="Top outstanding payables"
                subtitle="Largest unresolved obligations"
            >
                <div className="divide-y">
                    {!loading &&
                        payables
                            .sort(
                                (a, b) =>
                                    b.amountPaisa -
                                    a.amountPaisa
                            )
                            .slice(0, 6)
                            .map((l) => {
                                const bucket =
                                    agingBucket(l.date);

                                return (
                                    <div
                                        key={l._id}
                                        className="flex items-center justify-between py-3"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">
                                                {l.notes ||
                                                    l.tenant?.name ||
                                                    "External"}
                                            </p>

                                            <p className="text-xs text-muted-foreground">
                                                {
                                                    REF_LABELS[
                                                    l.referenceType
                                                    ]
                                                }
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span
                                                className="font-bold tabular-nums"
                                                style={{ color: "var(--color-danger)" }}
                                            >
                                                {fmtRs(
                                                    l.amountPaisa
                                                )}
                                            </span>

                                            <Badge
                                                variant="outline"
                                                style={bucket.style}
                                            >
                                                {bucket.label}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })}
                </div>
            </Panel>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Loans
// ─────────────────────────────────────────────────────────────

function LoansContent({ all, loading }) {
    const loans = all.filter(
        (l) => l.referenceType === "LOAN"
    );

    if (!loading && loans.length === 0) {
        return <Empty message="No loans recorded" />;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading &&
                [1, 2].map((i) => (
                    <Skeleton
                        key={i}
                        className="h-[220px] w-full"
                    />
                ))}

            {!loading &&
                loans.map((loan) => {
                    const status =
                        LOAN_STATUS[
                        loan.loanStatus
                        ] ??
                        LOAN_STATUS.ACTIVE;

                    const repaid =
                        (loan.originalAmountPaisa ??
                            loan.amountPaisa) -
                        loan.amountPaisa;

                    const progress = pct(
                        repaid,
                        loan.originalAmountPaisa ??
                        loan.amountPaisa
                    );

                    return (
                        <Card
                            key={loan._id}
                            className="shadow-none"
                        >
                            <CardHeader className="flex-row items-center justify-between border-b">
                                <div>
                                    <h3 className="text-sm font-semibold">
                                        {loan.notes ||
                                            "Loan"}
                                    </h3>

                                    <p className="text-xs text-muted-foreground mt-1">
                                        {loan.source?.name ??
                                            "—"}
                                    </p>
                                </div>

                                <Badge
                                    variant="outline"
                                    style={status.style}
                                >
                                    {status.label}
                                </Badge>
                            </CardHeader>

                            <CardContent className="space-y-5 pt-5">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Original
                                        </p>

                                        <p className="text-lg font-bold tabular-nums">
                                            {fmtRs(
                                                loan.originalAmountPaisa ??
                                                loan.amountPaisa
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Repaid
                                        </p>

                                        <p
                                            className="text-lg font-bold tabular-nums"
                                            style={{ color: "var(--color-success)" }}
                                        >
                                            {fmtRs(repaid)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Outstanding
                                        </p>

                                        <p
                                            className="text-lg font-bold tabular-nums"
                                            style={{ color: "var(--color-danger)" }}
                                        >
                                            {fmtRs(
                                                loan.amountPaisa
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            Repayment progress
                                        </span>

                                        <span className="font-semibold">
                                            {progress}%
                                        </span>
                                    </div>

                                    <Progress value={progress} />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Payables
// ─────────────────────────────────────────────────────────────

function PayablesContent({
    all,
    loading,
}) {
    const [filterType, setFilterType] =
        useState("ALL");

    const payables = all.filter(
        (l) =>
            l.referenceType !== "LOAN" &&
            l.referenceType !==
            "SECURITY_DEPOSIT"
    );

    const types = [
        "ALL",
        ...new Set(
            payables.map(
                (l) => l.referenceType
            )
        ),
    ];

    const filtered =
        filterType === "ALL"
            ? payables
            : payables.filter(
                (l) =>
                    l.referenceType ===
                    filterType
            );

    return (
        <div className="space-y-4">
            <div className="flex items-center flex-wrap gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />

                {types.map((t) => (
                    <Button
                        key={t}
                        size="sm"
                        variant={
                            filterType === t
                                ? "default"
                                : "outline"
                        }
                        onClick={() =>
                            setFilterType(t)
                        }
                    >
                        {REF_LABELS[t] ?? t}
                    </Button>
                ))}
            </div>

            <Panel
                title="All payables"
                subtitle={`${filtered.length} records`}
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            window.print()
                        }
                    >
                        <Printer className="h-3.5 w-3.5 mr-1" />
                        Print
                    </Button>
                }
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                Payee
                            </TableHead>
                            <TableHead>
                                Type
                            </TableHead>
                            <TableHead>
                                Amount
                            </TableHead>
                            <TableHead>
                                Aging
                            </TableHead>
                            <TableHead>
                                Date
                            </TableHead>
                            <TableHead>
                                Status
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {!loading &&
                            filtered.map((l) => {
                                const bucket =
                                    agingBucket(
                                        l.englishDate
                                    );

                                return (
                                    <TableRow
                                        key={l._id}
                                    >
                                        <TableCell className="font-medium">
                                            {l.payeeType ===
                                                "TENANT"
                                                ? l.tenant?.name
                                                : l.notes}
                                        </TableCell>

                                        <TableCell>
                                            <Badge variant="secondary">
                                                {
                                                    REF_LABELS[
                                                    l.referenceType
                                                    ]
                                                }
                                            </Badge>
                                        </TableCell>

                                        <TableCell
                                            className="font-bold tabular-nums"
                                            style={{ color: "var(--color-danger)" }}
                                        >
                                            {fmtRs(
                                                l.amountPaisa
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                style={bucket.style}
                                            >
                                                {bucket.label}
                                            </Badge>
                                        </TableCell>

                                        <TableCell>
                                            {l.nepaliDate}
                                        </TableCell>

                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                style={
                                                    l.status === "SYNCED"
                                                        ? {
                                                            background: "var(--color-success-bg)",
                                                            color: "var(--color-success)",
                                                            borderColor: "var(--color-success-border)",
                                                        }
                                                        : {
                                                            background: "var(--color-warning-bg)",
                                                            color: "var(--color-warning)",
                                                            borderColor: "var(--color-warning-border)",
                                                        }
                                                }
                                            >
                                                {l.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>

                {!loading &&
                    filtered.length === 0 && (
                        <Empty message="No payables found" />
                    )}
            </Panel>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Deposits
// ─────────────────────────────────────────────────────────────

function DepositsContent({
    all,
    loading,
}) {
    const deposits = all.filter(
        (l) =>
            l.referenceType ===
            "SECURITY_DEPOSIT"
    );

    return (
        <Panel
            title="Deposit obligations"
            subtitle={`${deposits.length} tenants`}
        >
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            Tenant
                        </TableHead>
                        <TableHead>
                            Phone
                        </TableHead>
                        <TableHead>
                            Deposit
                        </TableHead>
                        <TableHead>
                            Date
                        </TableHead>
                        <TableHead>
                            Status
                        </TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {!loading &&
                        deposits.map((l) => (
                            <TableRow
                                key={l._id}
                            >
                                <TableCell className="font-medium">
                                    {l.tenant?.name}
                                </TableCell>

                                <TableCell>
                                    {l.tenant?.phone}
                                </TableCell>

                                <TableCell
                                    className="font-bold tabular-nums"
                                    style={{ color: "var(--color-danger)" }}
                                >
                                    {fmtRs(
                                        l.amountPaisa
                                    )}
                                </TableCell>

                                <TableCell>
                                    {l.nepaliDate}
                                </TableCell>

                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        style={
                                            l.status === "SYNCED"
                                                ? {
                                                    background: "var(--color-success-bg)",
                                                    color: "var(--color-success)",
                                                    borderColor: "var(--color-success-border)",
                                                }
                                                : {
                                                    background: "var(--color-warning-bg)",
                                                    color: "var(--color-warning)",
                                                    borderColor: "var(--color-warning-border)",
                                                }
                                        }
                                    >
                                        {l.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>

            {!loading &&
                deposits.length === 0 && (
                    <Empty message="No deposits found" />
                )}
        </Panel>
    );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export default function LiabilitiesTab() {
    const { activeEntityId } =
        useEntity();

    const {
        all,
        loading,
        refetch,
    } = useLiabilities(activeEntityId);

    const overdueCount = all.filter(
        (l) =>
            agingBucket(l.date).label ===
            "90+ days"
    ).length;

    return (
        <Tabs defaultValue="overview" className="w-full space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <TabsList>
                        <TabsTrigger value="overview">
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="loans">
                            Loans
                        </TabsTrigger>
                        <TabsTrigger value="payables">
                            Payables
                        </TabsTrigger>
                        <TabsTrigger value="deposits">
                            Deposits
                        </TabsTrigger>
                    </TabsList>

                    {overdueCount > 0 && (
                        <Badge
                            variant="outline"
                            style={{
                                background: "var(--color-danger-bg)",
                                color: "var(--color-danger)",
                                borderColor: "var(--color-danger-border)",
                            }}
                        >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {overdueCount} overdue
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={refetch}
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>

                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add liability
                    </Button>
                </div>
            </div>

            <TabsContent value="overview">
                <OverviewContent all={all} loading={loading} />
            </TabsContent>

            <TabsContent value="loans">
                <LoansContent all={all} loading={loading} />
            </TabsContent>

            <TabsContent value="payables">
                <PayablesContent all={all} loading={loading} />
            </TabsContent>

            <TabsContent value="deposits">
                <DepositsContent all={all} loading={loading} />
            </TabsContent>
        </Tabs>
    );
}