import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { getTodayNepali, NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";

const QUARTER_MONTHS = {
  Q1: [1, 2, 3],
  Q2: [4, 5, 6],
  Q3: [7, 8, 9],
  Q4: [10, 11, 12],
};

function deriveChartData(statsRaw, quarter) {
  const cs = statsRaw?.collectionSummary?.thisMonth ?? {};
  const todayNp = getTodayNepali();
  const currentMonth = todayNp.month;
  const months = QUARTER_MONTHS[quarter] ?? [1, 2, 3];

  return months.map((m) => {
    const isCurrentMonth = m === currentMonth;
    return {
      month: NEPALI_MONTH_NAMES[m - 1] ?? `Month ${m}`,
      monthly: isCurrentMonth
        ? Math.round((cs.rentCollectedPaisa ?? 0) / 100)
        : 0,
      quarterly: 0, // quarterly split not yet in API
      booked: isCurrentMonth
        ? Math.round(Math.max(0, (cs.rentBilledPaisa ?? 0) - (cs.rentCollectedPaisa ?? 0)) / 100)
        : 0,
    };
  });
}

function normalize(statsRaw, arrearsRaw) {
  const cs = statsRaw?.collectionSummary?.thisMonth ?? {};
  const ms = statsRaw?.maintenanceSummary ?? {};

  const rentCollectedPaisa = cs.rentCollectedPaisa ?? 0;
  const camCollectedPaisa = cs.camCollectedPaisa ?? 0;
  const rentBilledPaisa = cs.rentBilledPaisa ?? 0;
  const camBilledPaisa = cs.camBilledPaisa ?? 0;
  const totalCollected = rentCollectedPaisa + camCollectedPaisa;
  const totalDue = rentBilledPaisa + camBilledPaisa;
  const collectionRate =
    totalDue > 0
      ? Math.min(100, Math.round((totalCollected / totalDue) * 100))
      : (cs.collectionRate ?? 0);

  const revenue = {
    totalCollected,
    totalDue,
    collectionRate,
    breakdown: {
      rent: { collected: rentCollectedPaisa, due: rentBilledPaisa },
      cam: { collected: camCollectedPaisa, due: camBilledPaisa },
      electricity: { collected: 0, due: 0 },
    },
  };

  const arrearsList = Array.isArray(arrearsRaw) ? arrearsRaw : [];
  const totalArrears = arrearsList.reduce(
    (sum, a) => sum + (a.totalDuePaisa ?? 0),
    0,
  );
  let severe = 0, moderate = 0, mild = 0;
  for (const a of arrearsList) {
    const months = a.consecutiveUnpaidMonths ?? 0;
    const amt = a.totalDuePaisa ?? 0;
    if (months >= 2) severe += amt;
    else if (months === 1) moderate += amt;
    else mild += amt;
  }
  const arrears = {
    totalArrears,
    tenantCount: arrearsList.length,
    aging: { severe, moderate, mild },
  };

  const overdueRents = Array.isArray(statsRaw?.overdueRents)
    ? statsRaw.overdueRents
    : [];
  const maintenanceList = Array.isArray(statsRaw?.maintenance)
    ? statsRaw.maintenance
    : [];
  const openMaintenance = maintenanceList.filter(
    (m) => (m.status ?? "").toUpperCase() === "OPEN",
  );
  const generators = Array.isArray(statsRaw?.generatorsDueService)
    ? statsRaw.generatorsDueService
    : [];
  const contracts = Array.isArray(statsRaw?.contractsEndingSoon)
    ? statsRaw.contractsEndingSoon.filter((c) => (c.daysUntilEnd ?? 999) <= 45)
    : [];

  const alerts = [
    overdueRents.length > 0 && {
      severity: "urgent",
      icon: "AlertTriangle",
      label: `${overdueRents.length} overdue rent${overdueRents.length !== 1 ? "s" : ""}`,
      badge: String(overdueRents.length),
      route: "/rent-payment",
    },
    openMaintenance.length > 0 && {
      severity: "warning",
      icon: "Wrench",
      label: `${openMaintenance.length} open maintenance`,
      badge: String(openMaintenance.length),
      route: "/maintenance",
    },
    generators.length > 0 && {
      severity: "warning",
      icon: "Zap",
      label: `${generators.length} generator${generators.length !== 1 ? "s" : ""} due service`,
      badge: String(generators.length),
      route: "/maintenance",
    },
    contracts.length > 0 && {
      severity: "warning",
      icon: "CalendarClock",
      label: `${contracts.length} lease${contracts.length !== 1 ? "s" : ""} expiring soon`,
      badge: String(contracts.length),
      route: "/tenant",
    },
  ].filter(Boolean);

  const property = {
    occupancy: {
      active: statsRaw?.occupiedUnits ?? 0,
      vacant: Math.max(
        0,
        (statsRaw?.totalUnits ?? 0) - (statsRaw?.occupiedUnits ?? 0),
      ),
      total: statsRaw?.totalUnits ?? 0,
    },
    maintenance: {
      open: ms.open ?? openMaintenance.length,
      inProgress: ms.inProgress ?? 0,
      resolved: ms.completed ?? 0,
    },
  };

  return { revenue, arrears, alerts, property };
}

/**
 * useFinancialDashboard — fetches dashboard + arrears, returns normalized data.
 * quarter: "Q1"|"Q2"|"Q3"|"Q4"
 * fy: "2081-82" string
 */
export function useFinancialDashboard(quarter, fy) {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, arrearsRes] = await Promise.all([
        api.get("/api/payment/dashboard-stats"),
        api.get("/api/tenant/arrears"),
      ]);
      const statsRaw = statsRes.data?.data ?? statsRes.data ?? null;
      const arrearsRaw = arrearsRes.data?.arrears ?? [];
      setData(normalize(statsRaw, arrearsRaw));
      setChartData(deriveChartData(statsRaw, quarter));
    } catch (err) {
      setError(
        err.response?.data?.message ?? err.message ?? "Failed to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, [quarter, fy]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, chartData, loading, error, refetch: fetch };
}

export { QUARTER_MONTHS };
