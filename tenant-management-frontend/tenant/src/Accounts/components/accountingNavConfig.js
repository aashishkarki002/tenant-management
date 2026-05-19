import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    Landmark,
    Settings2,
    ShieldCheck,
} from "lucide-react";

// ── Accounting sidebar nav structure ──────────────────────────────────────────

export const NAV_GROUPS = [
    {
        id: "financials",
        label: "Financials",
        Icon: LayoutDashboard,
        tabs: [
            { id: "overview", label: "Overview" },
            { id: "profit-loss", label: "Profit & Loss" },
            { id: "balance-sheet", label: "Balance Sheet" },
            { id: "cash-flow", label: "Cash Flow" },
            { id: "financial-ratios", label: "Ratios" },
            { id: "trial-balance", label: "Trial Balance" },
        ],
    },
    {
        id: "income",
        label: "Income",
        Icon: TrendingUp,
        tabs: [
            { id: "revenue", label: "Revenue" },
            { id: "revenue-collection", label: "Collection" },
            { id: "ar-aging", label: "AR Aging" },
            { id: "tenant-statement", label: "Tenant Statement" },
            { id: "advance-rent", label: "Advance Rent" },
        ],
    },
    {
        id: "expenses",
        label: "Expenses",
        Icon: TrendingDown,
        tabs: [
            { id: "expenses", label: "Expenses" },
            { id: "vendor-bills", label: "Vendor Bills" },


        ],
    },
    {
        id: "banking",
        label: "Banking",
        Icon: Landmark,
        tabs: [
            { id: "banking", label: "Banking" },
            { id: "ledger", label: "Ledger" },
            { id: "bank-reconciliation", label: "Bank Recon" },
        ],
    },
    {
        id: "operations",
        label: "Operations",
        Icon: Settings2,
        tabs: [
            { id: "liabilities", label: "Liabilities" },
            { id: "projections", label: "Projections" },
            { id: "adjustments", label: "Adjustments" },

            { id: "vacate-settlement", label: "Vacate Settlement" },

        ],
    },
    {
        id: "compliance",
        label: "Compliance",
        Icon: ShieldCheck,
        tabs: [
            { id: "tds-filing", label: "TDS Filing" },
            { id: "audit-log", label: "Audit Log" },
            { id: "year-end-close", label: "Year-End Close" },
            { id: "coa-management", label: "Chart of Accounts" },
        ],
    },
];

/** Returns the group that owns `tabId`, or null. */
export function getGroupForTab(tabId) {
    return NAV_GROUPS.find(g => g.tabs.some(t => t.id === tabId))?.id ?? null;
}
