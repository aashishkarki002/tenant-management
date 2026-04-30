import { Skeleton } from "../AccountingPrimitives";
import { useFundPositions } from "../../hooks/useFundPositions";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
    border:  "var(--color-border)",
    surface: "var(--color-surface-raised)",
    sub:     "var(--color-text-sub)",
    body:    "var(--color-text-body)",
    strong:  "var(--color-text-strong)",
    info:    "var(--color-info)",
    success: "var(--color-success)",
};

function SectionLabel({ children }) {
    return (
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: T.sub }}>
            {children}
        </div>
    );
}

export default function BankingTab({ entityId }) {
    const { data, loading, error, refetch } = useFundPositions(entityId);

    if (loading) return <Skeleton h={192} />;

    if (error) {
        return (
            <p className="text-[12px]" style={{ color: "var(--color-danger)", paddingTop: 16 }}>{error}</p>
        );
    }

    const { cashInHand, bankAccounts = [], totalFundsFormatted } = data ?? {};

    return (
        <div className="flex flex-col gap-4">

            {/* ── Info note ─────────────────────────────────────────────────── */}
            <div
                className="rounded-xl px-4 py-2.5 border-l-2 text-[11px]"
                style={{
                    background: "var(--color-info-bg)",
                    borderLeftColor: T.info,
                    color: T.sub,
                }}
            >
                Balances update automatically when payments and expenses are recorded.
            </div>

            {/* ── Summary strip ─────────────────────────────────────────────── */}
            {data && (
                <div
                    className="rounded-2xl border px-5 py-4 flex items-center justify-between"
                    style={{ background: T.surface, borderColor: T.border }}
                >
                    <span className="text-[11px] font-medium" style={{ color: T.sub }}>
                        Total funds
                    </span>
                    <span className="text-[20px] font-bold tabular-nums" style={{ color: T.strong, letterSpacing: "-0.02em" }}>
                        {totalFundsFormatted}
                    </span>
                </div>
            )}

            {/* ── Cash in hand ──────────────────────────────────────────────── */}
            <div>
                <SectionLabel>Cash in Hand</SectionLabel>
                <div
                    className="rounded-2xl border px-5 py-4"
                    style={{ background: "var(--color-surface-invert)" }}
                >
                    <div className="text-[11px] font-medium mb-1" style={{ color: "var(--color-surface-invert-sub)" }}>
                        Cash on Hand
                    </div>
                    <div className="text-[28px] font-bold tabular-nums leading-none" style={{ color: "var(--color-surface-invert-text)", letterSpacing: "-0.02em" }}>
                        {cashInHand?.balanceFormatted ?? "Rs. 0.00"}
                    </div>
                    {cashInHand && !cashInHand.hasLedgerAccount && (
                        <div className="text-[11px] mt-2" style={{ color: "var(--color-warning)" }}>
                            No ledger account found — run rebuildAccountBalances to initialize.
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bank accounts ─────────────────────────────────────────────── */}
            {bankAccounts.length > 0 && (
                <div>
                    <SectionLabel>Bank Accounts</SectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {bankAccounts.map((b) => (
                            <div
                                key={String(b._id)}
                                className="rounded-2xl border px-5 py-4"
                                style={{ background: T.surface, borderColor: T.border }}
                            >
                                <div className="text-[11px] font-medium mb-0.5" style={{ color: T.sub }}>
                                    {b.bankName}
                                </div>
                                <div className="text-[13px] font-semibold mb-3" style={{ color: T.body }}>
                                    {b.accountName}
                                </div>
                                <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: T.strong, letterSpacing: "-0.02em" }}>
                                    {b.balanceFormatted}
                                </div>
                                <div className="text-[11px] mt-1" style={{ color: T.sub }}>
                                    {b.accountCode}
                                </div>
                                {!b.hasLedgerAccount && (
                                    <div className="text-[11px] mt-2" style={{ color: "var(--color-warning)" }}>
                                        Balance may be 0 — run rebuildAccountBalances.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {bankAccounts.length === 0 && (
                <p className="text-[12px]" style={{ color: T.sub }}>
                    No bank accounts configured. Add them in{" "}
                    <span className="font-semibold" style={{ color: T.body }}>Settings → Bank Accounts</span>.
                </p>
            )}

            {/* ── Refresh ───────────────────────────────────────────────────── */}
            <button
                onClick={refetch}
                className="self-start text-[11px] font-semibold bg-transparent border-none cursor-pointer hover:opacity-75 transition-opacity underline underline-offset-2"
                style={{ color: T.sub }}
            >
                Refresh balances
            </button>

        </div>
    );
}
