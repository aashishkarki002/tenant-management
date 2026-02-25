/**
 * FinancialTotalsDisplay.jsx  (NEW)
 *
 * Live breakdown of gross rent, TDS, net rent, CAM, and total monthly due.
 * Uses the same reverse TDS formula as the backend's calculateUnitLease().
 *
 * Rendered in FinancialTab directly below the unit financials table so the
 * admin can verify numbers before saving.
 */

import { calculateFinancialTotals } from "../utils/financialCalculation";

const fmt = (n) =>
    "Rs. " + n.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const FinancialTotalsDisplay = ({ unitFinancials = {}, tdsPercentage = 10 }) => {
    if (!unitFinancials || Object.keys(unitFinancials).length === 0) return null;

    const t = calculateFinancialTotals(unitFinancials, tdsPercentage);

    if (t.totalSqft === 0) return null;

    return (
        <div className="rounded-lg border bg-blue-50 p-4 space-y-3">
            <h4 className="font-semibold text-blue-900">Monthly Summary</h4>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="text-gray-600">Total Sqft</div>
                <div className="font-medium text-right">{t.totalSqft.toLocaleString()}</div>

                <div className="text-gray-600">Gross Rent</div>
                <div className="font-medium text-right">{fmt(t.grossMonthly)}</div>

                <div className="text-amber-700">TDS ({tdsPercentage}% reverse)</div>
                <div className="font-medium text-amber-700 text-right">- {fmt(t.tdsMonthly)}</div>

                <div className="text-gray-600">Net Rent (landlord receives)</div>
                <div className="font-medium text-right">{fmt(t.netRent)}</div>

                <div className="text-gray-600">CAM Charges</div>
                <div className="font-medium text-right">{fmt(t.camMonthly)}</div>

                <div className="border-t pt-2 text-blue-900 font-semibold">Total Tenant Pays / Month</div>
                <div className="border-t pt-2 font-semibold text-right text-blue-900">
                    {fmt(t.totalMonthlyDue)}
                </div>

                {t.totalSecurityDeposit > 0 && (
                    <>
                        <div className="text-gray-600 pt-2">Security Deposit (one-time)</div>
                        <div className="font-medium text-right pt-2">{fmt(t.totalSecurityDeposit)}</div>
                    </>
                )}
            </div>

            <p className="text-xs text-gray-500 pt-1">
                TDS is withheld by the tenant and remitted to IRD. The landlord books
                Net Rent as income. These numbers are previews — the backend stores
                all values as integer paisa.
            </p>
        </div>
    );
};