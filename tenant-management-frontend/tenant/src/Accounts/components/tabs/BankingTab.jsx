import { Skeleton, Spark } from "../AccountingPrimitives";
import { useFundPositions } from "../../hooks/useFundPositions";
import { useBalanceHistory } from "../../hooks/useBalanceHistory";

const T = {
    border:  "var(--color-border)",
    surface: "var(--color-surface-raised)",
    sub:     "var(--color-text-sub)",
    body:    "var(--color-text-body)",
    strong:  "var(--color-text-strong)",
    info:    "var(--color-info)",
    success: "var(--color-success)",
    danger:  "var(--color-danger)",
    warning: "var(--color-warning)",
};

function toPct(data) {
    if (!data || data.length < 2) return null;
    const first = data[0].balancePaisa;
    const last  = data[data.length - 1].balancePaisa;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
}

function toSparkData(data) {
    return (data ?? []).map((d) => ({ v: d.balancePaisa / 100 }));
}

function TrendBadge({ pct }) {
    if (pct === null) return null;
    const up = pct >= 0;
    return (
        <span
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums"
            style={{ color: up ? T.success : T.danger }}
        >
            {up
                ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M5 2L2 5M5 2L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2V8M5 8L2 5M5 8L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            {up ? "+" : ""}{Math.abs(pct).toFixed(1)}%
        </span>
    );
}

function HistorySlot({ data, color }) {
    const sparkData = toSparkData(data);

    if (sparkData.length < 2) {
        // flat placeholder — shows chart slot exists even with no history
        return (
            <div
                className="flex items-center justify-center rounded-lg mt-3"
                style={{
                    height: 52,
                    border: `1px dashed ${T.border}`,
                    color: T.sub,
                    fontSize: 10,
                    opacity: 0.6,
                }}
            >
                No history yet — charts populate as transactions are recorded
            </div>
        );
    }

    return (
        <div className="mt-3 w-full overflow-hidden" style={{ height: 52 }}>
            <Spark data={sparkData} color={color} h={52} />
        </div>
    );
}

function SectionLabel({ children }) {
    return (
        <div
            className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3"
            style={{ color: T.sub }}
        >
            {children}
        </div>
    );
}

export default function BankingTab({ entityId }) {
    const { data, loading, error, refetch }    = useFundPositions(entityId);
    const { histories, refetch: refetchHist }  = useBalanceHistory(entityId, 30);

    const refresh = () => { refetch(); refetchHist(); };

    if (loading) return <Skeleton h={192} />;

    if (error) {
        return (
            <p className="text-[12px] pt-4" style={{ color: T.danger }}>{error}</p>
        );
    }

    const { cashInHand, bankAccounts = [], totalFundsFormatted } = data ?? {};

    const cashHist  = histories["1000"] ?? [];
    const cashPct   = toPct(cashHist);
    const cashColor = cashPct !== null && cashPct < 0 ? T.danger : T.success;

    return (
        <div className="flex flex-col gap-4">

            {/* info banner */}
            <div
                className="rounded-xl px-4 py-2.5 border-l-2 text-[11px]"
                style={{
                    background: "var(--color-info-bg)",
                    borderLeftColor: T.info,
                    color: T.sub,
                }}
            >
                Balances update automatically when payments and expenses are recorded.
                Charts show last 30 days.
            </div>

            {/* total strip */}
            {data && (
                <div
                    className="rounded-2xl border px-5 py-4 flex items-center justify-between"
                    style={{ background: T.surface, borderColor: T.border }}
                >
                    <span className="text-[11px] font-medium" style={{ color: T.sub }}>
                        Total funds
                    </span>
                    <span
                        className="text-[20px] font-bold tabular-nums"
                        style={{ color: T.strong, letterSpacing: "-0.02em" }}
                    >
                        {totalFundsFormatted}
                    </span>
                </div>
            )}

            {/* cash in hand */}
            <div>
                <SectionLabel>Cash in Hand</SectionLabel>
                <div
                    className="rounded-2xl px-5 pt-4 pb-4"
                    style={{ background: "var(--color-surface-invert)" }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <div
                            className="text-[11px] font-medium"
                            style={{ color: "var(--color-surface-invert-sub, #94a3b8)" }}
                        >
                            Cash on Hand
                        </div>
                        <TrendBadge pct={cashPct} />
                    </div>

                    <div
                        className="text-[28px] font-bold tabular-nums leading-none"
                        style={{
                            color: "var(--color-surface-invert-text, #f8fafc)",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {cashInHand?.balanceFormatted ?? "Rs. 0.00"}
                    </div>

                    <HistorySlot data={cashHist} color={cashColor} />

                    {cashInHand && !cashInHand.hasLedgerAccount && (
                        <div className="text-[11px] mt-2" style={{ color: T.warning }}>
                            No ledger account — run rebuildAccountBalances to initialize.
                        </div>
                    )}
                </div>
            </div>

            {/* bank accounts */}
            {bankAccounts.length > 0 && (
                <div>
                    <SectionLabel>Bank Accounts</SectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {bankAccounts.map((b) => {
                            const hist  = histories[b.accountCode] ?? [];
                            const pct   = toPct(hist);
                            const color = pct !== null && pct < 0 ? T.danger : T.success;

                            return (
                                <div
                                    key={String(b._id)}
                                    className="rounded-2xl border px-5 pt-4 pb-4"
                                    style={{ background: T.surface, borderColor: T.border }}
                                >
                                    <div className="flex items-center justify-between mb-0.5">
                                        <div className="text-[11px] font-medium" style={{ color: T.sub }}>
                                            {b.bankName}
                                        </div>
                                        <TrendBadge pct={pct} />
                                    </div>

                                    <div
                                        className="text-[13px] font-semibold mb-3"
                                        style={{ color: T.body }}
                                    >
                                        {b.accountName}
                                    </div>

                                    <div
                                        className="text-[22px] font-bold tabular-nums leading-none"
                                        style={{ color: T.strong, letterSpacing: "-0.02em" }}
                                    >
                                        {b.balanceFormatted}
                                    </div>

                                    <HistorySlot data={hist} color={color} />

                                    <div className="text-[11px] mt-2" style={{ color: T.sub }}>
                                        {b.accountCode}
                                    </div>

                                    {!b.hasLedgerAccount && (
                                        <div className="text-[11px] mt-1" style={{ color: T.warning }}>
                                            Balance may be 0 — run rebuildAccountBalances.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {bankAccounts.length === 0 && (
                <p className="text-[12px]" style={{ color: T.sub }}>
                    No bank accounts configured. Add in{" "}
                    <span className="font-semibold" style={{ color: T.body }}>
                        Settings → Bank Accounts
                    </span>.
                </p>
            )}

            <button
                onClick={refresh}
                className="self-start text-[11px] font-semibold bg-transparent border-none cursor-pointer hover:opacity-75 transition-opacity underline underline-offset-2"
                style={{ color: T.sub }}
            >
                Refresh balances
            </button>
        </div>
    );
}
