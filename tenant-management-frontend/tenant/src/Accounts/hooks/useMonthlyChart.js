import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { NEPALI_MONTHS_FY_ORDER } from "../utils/nepaliCalendar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(base, next) {
  if (!base) return null;
  return +(((next - base) / base) * 100).toFixed(2);
}

function sum(arr, key) {
  return arr.reduce((s, x) => s + (x[key] ?? 0), 0);
}

/**
 * Re-order chart data into Nepal fiscal-year sequence (Shrawan first).
 * API returns calendar order (Baisakh=1 … Chaitra=12).
 * FY order: Shrawan(4)→Bhadra(5)→…→Chaitra(12)→Baisakh(1)→Jestha(2)→Ashadh(3).
 * Matches by the first 3 chars of each label (case-insensitive).
 */
function toFYOrder(data) {
  if (!data || data.length === 0) return data;
  const fyOrder = NEPALI_MONTHS_FY_ORDER.map(m => m.name.toLowerCase());
  return [...data].sort((a, b) => {
    const la = (a.label ?? "").toLowerCase();
    const lb = (b.label ?? "").toLowerCase();
    const ai = fyOrder.findIndex(n => la.startsWith(n.slice(0, 3)));
    const bi = fyOrder.findIndex(n => lb.startsWith(n.slice(0, 3)));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches monthly chart data from /api/accounting/monthly-chart.
 *
 * @param selectedQuarter  Primary period quarter (null = last 5 months, or allYear if fiscalYear set)
 * @param compareQuarter   Secondary period quarter (null = no quarter-level compare)
 * @param fiscalYear       Primary fiscal year (BS)
 * @param allYear          Force allYear mode (12-month fiscal year view)
 * @param entityId         Entity scope — null=merged, "private"=private only, <id>=specific entity
 * @param compareYear      Secondary fiscal year — triggers year-level comparison when set
 */
export function useMonthlyChart(
  selectedQuarter,
  compareQuarter = null,
  fiscalYear = null,
  allYear = false,
  entityId = null,
  compareYear = null,
) {
  const [chartData, setChartData] = useState([]);
  const [compareData, setCompareData] = useState([]);
  const [comparisonStats, setComparisonStats] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);

  // Compare is active when either a quarter or a year is specified for period B
  const isCompare = compareQuarter !== null || compareYear !== null;

  const load = useCallback(async () => {
    /**
     * Build query params for one period.
     * yearOverride replaces fiscalYear for the B period in year-level comparisons.
     */
    const buildParams = (quarter, yearOverride = null) => {
      const params = {};
      const fy = yearOverride ?? fiscalYear;
      if (fy) params.fiscalYear = fy;
      if (quarter) {
        params.quarter = quarter;
      } else if (allYear || fy) {
        params.allYear = true;
      }
      if (entityId) params.entityId = entityId;
      return params;
    };

    setLoadingChart(true);
    try {
      if (isCompare) {
        const [resA, resB] = await Promise.all([
          api.get("/api/accounting/monthly-chart", {
            params: buildParams(selectedQuarter),
          }),
          api.get("/api/accounting/monthly-chart", {
            // For year-level compare, period B uses compareYear as the fiscal year.
            // For quarter-level compare, compareYear is null so fiscalYear is used.
            params: buildParams(compareQuarter, compareYear),
          }),
        ]);

        const periodA = toFYOrder(resA.data.data ?? []);
        const periodB = toFYOrder(resB.data.data ?? []);

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

        // Keep primary period data available for the RevExpChart (shown below the compare chart)
        setChartData(periodA);
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
      } else {
        const res = await api.get("/api/accounting/monthly-chart", {
          params: buildParams(selectedQuarter),
        });
        setChartData(toFYOrder(res.data.data ?? []));
        setCompareData([]);
        setComparisonStats(null);
      }
    } catch (err) {
      console.error("[useMonthlyChart] fetch failed", err);
    } finally {
      setLoadingChart(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuarter, compareQuarter, fiscalYear, allYear, entityId, compareYear]);

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

// ─── Quarter label constants ──────────────────────────────────────────────────
export const QUARTER_LABELS = {
  1: "Q1 (Shrawan–Ashwin)",
  2: "Q2 (Kartik–Poush)",
  3: "Q3 (Magh–Chaitra)",
  4: "Q4 (Baisakh–Ashadh)",
};
