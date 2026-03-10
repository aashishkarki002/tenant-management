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
 * @param selectedQuarter  Primary period  (null = last 5 months, or allYear if fiscalYear set)
 * @param compareQuarter   Secondary period (null = compare off)
 * @param fiscalYear       BS year override — when set with no quarter, sends allYear=true
 * @param allYear          Force allYear mode (12-month fiscal year view)
 */
export function useMonthlyChart(
  selectedQuarter,
  compareQuarter = null,
  fiscalYear = null,
  allYear = false,
) {
  const [chartData, setChartData] = useState([]);
  const [compareData, setCompareData] = useState([]);
  const [comparisonStats, setComparisonStats] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);

  const isCompare = compareQuarter !== null;

  const buildParams = (quarter) => {
    const params = {};
    if (fiscalYear) params.fiscalYear = fiscalYear;
    if (quarter) {
      params.quarter = quarter;
    } else if (allYear || fiscalYear) {
      // When viewing a full fiscal year (no specific quarter), request all 12 months
      params.allYear = true;
    }
    return params;
  };

  const load = useCallback(async () => {
    setLoadingChart(true);
    try {
      if (isCompare) {
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
  }, [selectedQuarter, compareQuarter, fiscalYear, allYear]);

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
