import { Card, DarkCard, Lbl, Skeleton } from "../AccountingPrimitives";
import { useFundPositions } from "../../hooks/useFundPositions";

export default function BankingTab({ entityId }) {
    const { data, loading, error, refetch } = useFundPositions(entityId);

    if (loading) return <Skeleton h={192} />;

    if (error) {
        return (
            <p className="text-sm text-[var(--color-danger)] py-4">{error}</p>
        );
    }

    const { cashInHand, bankAccounts = [], totalFundsFormatted } = data ?? {};

    return (
        <div className="flex flex-col gap-6">
            {/* Auto-update note */}
            <div className="text-xs text-[var(--color-text-sub)] border-l-2 border-[var(--color-info)] pl-3 bg-[var(--color-info-bg)] py-2 pr-3 rounded-r-md">
                Balances update automatically when payments and expenses are recorded.
            </div>

            {/* Total funds strip */}
            {data && (
                <p className="text-sm text-[var(--color-text-sub)]">
                    Total funds:{" "}
                    <span className="font-bold text-[var(--color-text-strong)]">
                        {totalFundsFormatted}
                    </span>
                </p>
            )}

            {/* Cash in hand */}
            <section>
                <Lbl>Cash in Hand</Lbl>
                <DarkCard>
                    <p className="text-xs text-white/60 mb-1">Cash on Hand</p>
                    <p className="text-2xl font-bold text-white">
                        {cashInHand?.balanceFormatted ?? "Rs. 0.00"}
                    </p>
                    {cashInHand && !cashInHand.hasLedgerAccount && (
                        <p className="text-xs text-yellow-300 mt-2">
                            No ledger account found — run rebuildAccountBalances script to initialize.
                        </p>
                    )}
                </DarkCard>
            </section>

            {/* Bank accounts */}
            {bankAccounts.length > 0 && (
                <section>
                    <Lbl>Bank Accounts</Lbl>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {bankAccounts.map((b) => (
                            <Card key={String(b._id)}>
                                <p className="text-xs text-[var(--color-text-sub)] mb-0.5">
                                    {b.bankName}
                                </p>
                                <p className="text-sm font-semibold text-[var(--color-text-strong)] mb-2">
                                    {b.accountName}
                                </p>
                                <p className="text-xl font-bold text-[var(--color-text-strong)]">
                                    {b.balanceFormatted}
                                </p>
                                <p className="text-xs text-[var(--color-text-sub)] mt-1">
                                    {b.accountCode}
                                </p>
                                {!b.hasLedgerAccount && (
                                    <p className="text-xs text-yellow-500 mt-2">
                                        Balance may be 0 — run rebuildAccountBalances script.
                                    </p>
                                )}
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {bankAccounts.length === 0 && !loading && (
                <p className="text-sm text-[var(--color-text-sub)]">
                    No bank accounts configured. Add them in{" "}
                    <span className="font-medium">Settings → Bank Accounts</span>.
                </p>
            )}

            {/* Refresh */}
            <button
                onClick={refetch}
                className="self-start text-xs text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] underline underline-offset-2"
            >
                Refresh balances
            </button>
        </div>
    );
}
