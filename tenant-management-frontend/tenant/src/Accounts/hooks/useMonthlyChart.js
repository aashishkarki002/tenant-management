import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(base, next) {
  if (!base) return null;
  return +(((next - base) / base) * 100).toFixed(2);
}

function sum(arr, key) {
  return arr.reduce((s, x) => s + (x[key] ?? 0), 0);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches monthly chart data from /api/accounting/monthly-chart.
 *
 * Industry standard: one HTTP request → all data.
 * Previously this made N requests (one per month) from the client — that logic
 * now lives entirely in accounting.service.js::getMonthlyChartData().
 *
 * @param selectedQuarter  Primary period  (null = last 5 months)
 * @param compareQuarter   Secondary period (null = compare off)
 * @param fiscalYear       BS year override
 */
export function useMonthlyChart(
  selectedQuarter,
  compareQuarter = null,
  fiscalYear = null,
) {
  const [chartData, setChartData] = useState([]);
  const [compareData, setCompareData] = useState([]);
  const [comparisonStats, setComparisonStats] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);

  const isCompare = compareQuarter !== null;

  const buildParams = (quarter) => {
    const params = {};
    if (quarter) params.quarter = quarter;
    if (fiscalYear) params.fiscalYear = fiscalYear;
    return params;
  };

  const load = useCallback(async () => {
    setLoadingChart(true);
    try {
      if (isCompare) {
        // Two parallel requests — still just 2 HTTP calls (vs N before)
        const [resA, resB] = await Promise.all([
          api.get("/api/accounting/monthly-chart", {
            params: buildParams(selectedQuarter),
          }),
          api.get("/api/accounting/monthly-chart", {
            params: buildParams(compareQuarter),
          }),
        ]);

        const periodA = resA.data.data ?? [];
        const periodB = resB.data.data ?? [];

        const merged = periodA.map((a, i) => ({
          label: `${a.label} / ${periodB[i]?.label ?? "–"}`,
          labelA: a.label,
          labelB: periodB[i]?.label ?? "–",
          revenueA: a.revenue,
          revenueB: periodB[i]?.revenue ?? 0,
          expensesA: a.expenses,
          expensesB: periodB[i]?.expenses ?? 0,
        }));

        const totalARevenue = sum(periodA, "revenue");
        const totalBRevenue = sum(periodB, "revenue");
        const totalAExpenses = sum(periodA, "expenses");
        const totalBExpenses = sum(periodB, "expenses");
        const totalANet = totalARevenue - totalAExpenses;
        const totalBNet = totalBRevenue - totalBExpenses;

        setCompareData(merged);
        setComparisonStats({
          revenue: {
            a: totalARevenue,
            b: totalBRevenue,
            pct: pctChange(totalARevenue, totalBRevenue),
          },
          expenses: {
            a: totalAExpenses,
            b: totalBExpenses,
            pct: pctChange(totalAExpenses, totalBExpenses),
          },
          netCashFlow: {
            a: totalANet,
            b: totalBNet,
            pct: pctChange(totalANet, totalBNet),
          },
        });
        setChartData([]);
      } else {
        const res = await api.get("/api/accounting/monthly-chart", {
          params: buildParams(selectedQuarter),
        });
        setChartData(res.data.data ?? []);
        setCompareData([]);
        setComparisonStats(null);
      }
    } catch (err) {
      console.error("[useMonthlyChart] fetch failed", err);
    } finally {
      setLoadingChart(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuarter, compareQuarter, fiscalYear]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingChart(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoadingChart(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { chartData, compareData, comparisonStats, loadingChart };
}

// ─── Quarter label constants (re-exported for use in AccountingPage) ──────────
export const QUARTER_LABELS = {
  1: "Q1 (Shrawan–Ashwin)",
  2: "Q2 (Kartik–Poush)",
  3: "Q3 (Magh–Chaitra)",
  4: "Q4 (Baisakh–Ashadh)",
};
