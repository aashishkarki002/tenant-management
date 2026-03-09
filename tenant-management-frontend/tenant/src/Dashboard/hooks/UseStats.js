import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

/**
 * normalizeDashboardStats
 *
 * BUILDINGS normalization:
 * Backend returns raw.buildings — an array of per-Block KPI objects where
 * each Block corresponds to what the UI calls a "Building"
 * (e.g. "Narendra Sadhan", "Birendra Sadhan").
 *
 * Rates are computed server-side; we only apply safe fallbacks here in case
 * of partial data. Never re-derive what the server already computed.
 *
 * Normalized shape per building:
 *   {
 *     _id: string,
 *     name: string,                           ← Block.name e.g. "Narendra Sadhan"
 *     occupancy:  { occupied, total, rate },  ← from Unit.block aggregation
 *     collection: { collected, target, rate },← from Rent.block this npMonth
 *     revenue: number,                        ← = collection.collected (rent paid)
 *     overdueAmount: number,                  ← overdue rent balance for this block
 *   }
 */
function normalizeDashboardStats(raw) {
  if (!raw) return null;

  const rentSummary = raw.rentSummary ?? {};
  const totalCollected = rentSummary.totalCollected ?? 0;
  const totalRent = rentSummary.totalRent ?? 0;
  const totalOutstanding = rentSummary.totalOutstanding ?? 0;

  // ── KPI block — all numbers pre-computed, components stay display-only ──
  //
  // Prefers the new collectionSummary.thisMonth from the backend (which covers
  // both rent + CAM for the current Nepali month). Falls back to rentSummary
  // for older API responses that don't yet return collectionSummary.
  const cs = raw.collectionSummary?.thisMonth ?? null;

  // Always use current-month paisa values from collectionSummary.thisMonth.
  // Never fall back to all-time rentSummary totals — that would make the bar
  // show an all-time figure then jump when cs loads, causing the stale bar bug.
  const rentBilled = cs?.rentBilledPaisa != null ? cs.rentBilledPaisa / 100 : 0;
  const rentCollected =
    cs?.rentCollectedPaisa != null ? cs.rentCollectedPaisa / 100 : 0;
  const camBilled = cs?.camBilledPaisa != null ? cs.camBilledPaisa / 100 : 0;
  const camCollected =
    cs?.camCollectedPaisa != null ? cs.camCollectedPaisa / 100 : 0;

  const totalBilled = rentBilled + camBilled;
  const totalReceived = rentCollected + camCollected;
  const totalRemaining = Math.max(0, totalBilled - totalReceived);

  // Bar segment widths as % of totalBilled (clamped 0–100).
  // rentPct is the rent portion of the full bar.
  // camPct starts where rentPct ends.
  const rentPct =
    totalBilled > 0
      ? Math.min(100, Math.round((rentCollected / totalBilled) * 100))
      : 0;
  const camPct =
    totalBilled > 0
      ? Math.min(100 - rentPct, Math.round((camCollected / totalBilled) * 100))
      : 0;
  // Overall collection rate (both streams combined)
  const collectionRate =
    cs?.collectionRate ??
    (totalBilled > 0
      ? Math.min(100, Math.round((totalReceived / totalBilled) * 100))
      : 0);

  // ── Tenant collection coverage (for the "all clear" state of Outstanding tile) ──
  //
  // When outstanding = 0, "how many tenants have paid?" is the next useful
  // question. We derive it from:
  //   - raw.activeTenants        — total tenants billed this month
  //   - raw.overdueRents         — tenants with a remaining balance (any status)
  //
  // tenantsWithBalance: count of distinct tenants who still owe something this
  //   month. Used as the "pending" count in the all-clear state.
  // tenantsPaid: activeTenants − tenantsWithBalance.
  // tenantCoverageRate: % of active tenants fully paid up (0–100).
  //
  // Note: overdueRents from the backend is a top-3 sample, not the full list.
  // We use overdueRents.length as the displayed overdue count (floor value).
  // Coverage rate uses activeTenants as the denominator.
  const activeTenants = raw.activeTenants ?? 0;
  const overdueRentsList = Array.isArray(raw.overdueRents)
    ? raw.overdueRents
    : [];

  // overdueRents from the backend is a top-3 sample — its .length is never
  // a reliable headcount. Derive tenantsWithBalance from collectionSummary
  // paisa values instead, which reflect the full dataset.
  //
  // Strategy: estimate how many tenants haven't fully paid by dividing total
  // outstanding paisa by the average billing per tenant. ceil() because any
  // partial balance means that tenant hasn't cleared their dues.
  const csTotalOutstandingPaisa = cs?.totalOutstandingPaisa ?? 0;
  const csTotalBilledPaisa = cs?.totalBilledPaisa ?? 0;
  const avgBilledPerTenant =
    activeTenants > 0 && csTotalBilledPaisa > 0
      ? csTotalBilledPaisa / activeTenants
      : 0;
  const tenantsWithBalance =
    avgBilledPerTenant > 0
      ? Math.min(
          activeTenants,
          Math.ceil(csTotalOutstandingPaisa / avgBilledPerTenant),
        )
      : overdueRentsList.length; // last-resort: fall back to sample size

  const tenantsPaid =
    activeTenants > 0 ? Math.max(0, activeTenants - tenantsWithBalance) : 0;
  const tenantCoverageRate =
    activeTenants > 0
      ? Math.min(100, Math.round((tenantsPaid / activeTenants) * 100))
      : 0;

  // ── Vacancy — flip occupancy from % metric to revenue-gap metric ────────────
  //
  // The owner doesn't need to know "87% occupied" — they need to know
  // "3 units vacant, costing ₹42k/mo in lost revenue."
  // When fully occupied, flip to positive signal: days at full occupancy.
  //
  // vacantUnits          — how many units are empty right now
  // vacancyRevenueLostPaisa — estimated monthly revenue gap
  //   = (totalRentPaisa / occupiedUnits) × vacantUnits
  //   Uses average rent per occupied unit as a proxy since per-unit data
  //   isn't in the dashboard payload. Good enough for the KPI tile.
  const totalUnitsRaw = raw.totalUnits ?? 0;
  const occupiedUnitsRaw = raw.occupiedUnits ?? 0;
  const vacantUnits = Math.max(0, totalUnitsRaw - occupiedUnitsRaw);
  const avgRentPerUnit =
    occupiedUnitsRaw > 0
      ? rentBilled / occupiedUnitsRaw // rupees, current month
      : 0;
  const vacancyRevenueLost = Math.round(vacantUnits * avgRentPerUnit); // rupees/mo

  // ── Late Fee summary ──────────────────────────────────────────────────────────
  //
  // Surfaces the late fee engine on the dashboard for the first time.
  // The system accrues late fees daily (master-cron / lateFee.cron) but this
  // data is invisible to the owner at the dashboard level today.
  //
  // Two states for the KPI tile:
  //
  //   HAS ACTIVE FEES → show total outstanding late fees + how many tenants
  //                     are currently being charged. Early warning for tenants
  //                     becoming a collection problem. Bar = % of accrued fees
  //                     that have been collected.
  //
  //   NO FEES         → positive signal: "No late fees this month"
  //                     Reassures the owner tenants are paying on time.
  //                     Completely different meaning from Outstanding=0 (which
  //                     means principal is settled; this means behaviour is clean).
  //
  // feeCollectionRate — what % of accrued late fees have been paid back.
  //   Used for the bar colour: high = good, low = problem growing.
  const lf = raw.lateFeeSummary ?? {};
  const lateFeeAccrued = lf.totalAccrued ?? 0;
  const lateFeeCollected = lf.totalCollected ?? 0;
  const lateFeeOutstanding = lf.totalOutstanding ?? 0;
  const lateFeeTenantsCharged = lf.tenantsCharged ?? 0;
  const lateFeeTenantsPaid = lf.tenantsPaidFees ?? 0;
  const hasActiveFees = lf.hasActiveFees ?? false;
  const feeCollectionRate =
    lateFeeAccrued > 0
      ? Math.min(100, Math.round((lateFeeCollected / lateFeeAccrued) * 100))
      : 0;

  // ── Collection phase ──────────────────────────────────────────────────────────
  //
  // Uses the real englishDueDate from the backend (earliestDueDate = the earliest
  // unpaid rent's due date for this Nepali month). Compared against today's JS
  // Date so no Nepali calendar math is needed here.
  //
  // Three phases:
  //   pending   → today is more than DUE_SOON_WINDOW days before the due date
  //               → neutral tone, nobody is late yet, money is simply expected
  //   due_soon  → today is within DUE_SOON_WINDOW days of the due date
  //               → amber nudge, prepare to collect
  //   overdue   → today is past the due date AND trulyOverdueCount > 0
  //               → red alert, real unpaid rents exist past their due date
  //
  // DUE_SOON_WINDOW: 2 days. Gives the manager just enough warning without
  // triggering false urgency at the start of every month.
  const DUE_SOON_WINDOW = 2;

  const oc = raw.outstandingContext ?? {};
  const trulyOverdueCount = oc.trulyOverdueCount ?? 0;
  const trulyOverdueAmount = (oc.trulyOverdueAmountPaisa ?? 0) / 100;

  // Frequency splits — monthly vs quarterly pending/overdue counts
  // Used only for sub-label copy; never the hero number.
  const pendingMonthly = oc.pendingMonthly ?? 0;
  const pendingQuarterly = oc.pendingQuarterly ?? 0;
  const overdueMonthly = oc.overdueMonthly ?? 0;
  const overdueQuarterly = oc.overdueQuarterly ?? 0;
  const hasMixedBilling =
    (pendingMonthly > 0 && pendingQuarterly > 0) ||
    (overdueMonthly > 0 && overdueQuarterly > 0);

  // Parse earliestDueDate safely — backend sends a JS Date (serialised as ISO
  // string over JSON). null means no unpaid rents exist this month (all clear).
  const earliestDueDateRaw = oc.earliestDueDate ?? null;
  const earliestDueDate = earliestDueDateRaw
    ? new Date(earliestDueDateRaw)
    : null;

  // Today at midnight — strip time so day-difference arithmetic is exact.
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  // daysUntilDue: how many whole days until the earliest unpaid rent is due.
  //   Negative = already past due.
  //   null = no unpaid rents (shouldn't reach phase logic in that case).
  const daysUntilDue =
    earliestDueDate != null
      ? Math.ceil(
          (earliestDueDate.getTime() - todayMidnight.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  const collectionPhase =
    daysUntilDue === null
      ? "all_clear" // no unpaid rents at all
      : daysUntilDue < 0 && trulyOverdueCount > 0
        ? "overdue" // past due, real defaulters
        : daysUntilDue <= DUE_SOON_WINDOW
          ? "due_soon" // within 2 days of due date
          : "pending"; // early in cycle, calm state

  const kpi = {
    // Raw numbers (rupees)
    rentBilled,
    rentCollected,
    rentOutstanding: Math.max(0, rentBilled - rentCollected),
    camBilled,
    camCollected,
    camOutstanding: Math.max(0, camBilled - camCollected),
    totalBilled,
    totalReceived,
    totalRemaining,

    // Bar segments — stacked progress bar in Collected tile
    rentPct,
    camPct,
    collectionRate,

    // Tenant coverage — Outstanding tile "all clear" state
    activeTenants,
    tenantsPaid,
    tenantsWithBalance,
    tenantCoverageRate,

    // Vacancy — Occupancy tile
    totalUnits: totalUnitsRaw,
    occupiedUnits: occupiedUnitsRaw,
    vacantUnits,
    vacancyRevenueLost,
    occupancyRate: raw.occupancyRate ?? 0,

    // Late Fees — 4th KPI tile
    lateFeeAccrued,
    lateFeeCollected,
    lateFeeOutstanding,
    lateFeeTenantsCharged,
    lateFeeTenantsPaid,
    hasActiveFees,
    feeCollectionRate,

    // Derived booleans
    allClear: totalRemaining <= 0,
    fullyOccupied: vacantUnits === 0 && totalUnitsRaw > 0,

    // ── Collection phase — resolves the "1st of month looks alarming" UX bug ──
    collectionPhase, // "pending" | "due_soon" | "overdue" | "all_clear"
    daysUntilDue, // number (can be negative) | null
    earliestDueDate, // Date | null — the actual englishDueDate from the rent record
    trulyOverdueCount, // real overdue headcount, not the capped top-3 sample
    trulyOverdueAmount, // total outstanding on overdue rents (rupees)

    // Billing frequency splits — for sub-label copy only, never hero numbers
    pendingMonthly, // unpaid monthly tenants this cycle
    pendingQuarterly, // unpaid quarterly tenants this cycle
    overdueMonthly, // overdue monthly tenants
    overdueQuarterly, // overdue quarterly tenants
    hasMixedBilling, // true when both billing types are present
  };

  const maintenanceList = Array.isArray(raw.maintenance) ? raw.maintenance : [];
  const openMaintenance = maintenanceList.filter(
    (m) => (m.status || "").toUpperCase() === "OPEN",
  );

  // Normalize overdueRents — use displayStatus (computed by the backend from
  // payment data) instead of the raw status field. The pre-save hook never
  // writes "overdue" to the DB, so raw status on past-due unpaid rents is
  // "pending". displayStatus is always authoritative.
  const overdueRents = Array.isArray(raw.overdueRents)
    ? raw.overdueRents.map((r) => ({
        ...r,
        status: r.displayStatus ?? r.status, // displayStatus wins
      }))
    : [];

  // Total outstanding from the authoritative all-time collection summary.
  // Do NOT sum overdueRents[].remainingPaisa — that is a top-3 sample and
  // would undercount the real total.
  const overdueAmount =
    (raw.collectionSummary?.allTime?.totalOutstandingPaisa ?? 0) / 100;

  const firstMaintenance = openMaintenance[0] || maintenanceList[0];

  const recentActivity = Array.isArray(raw.recentActivity)
    ? raw.recentActivity
    : [];

  // ── Buildings normalization ───────────────────────────────────────────────
  // Each entry is one Block document ("Building" in UI).
  // We normalize defensively but trust server-computed rates.
  const buildings = Array.isArray(raw.buildings)
    ? raw.buildings.map((b) => {
        const occTotal = b.occupancy?.total ?? 0;
        const occOccupied = b.occupancy?.occupied ?? 0;
        const collTarget = b.collection?.target ?? 0;
        const collCollected = b.collection?.collected ?? 0;

        return {
          _id: b._id ?? null,
          name: b.name ?? "Unknown Block",

          occupancy: {
            occupied: occOccupied,
            total: occTotal,
            // Prefer server-computed rate; fall back to client derivation
            rate:
              b.occupancy?.rate ??
              (occTotal > 0 ? Math.round((occOccupied / occTotal) * 100) : 0),
          },

          collection: {
            collected: collCollected,
            target: collTarget,
            rate:
              b.collection?.rate ??
              (collTarget > 0
                ? Math.min(100, Math.round((collCollected / collTarget) * 100))
                : 0),
          },

          // Revenue this month = collected rent for this block this period
          revenue: b.revenue ?? collCollected,

          overdueAmount: b.overdueAmount ?? 0,
        };
      })
    : [];

  return {
    // Spread all raw fields first so nothing is lost
    ...raw,

    // ── Pre-computed KPI block — single source of truth for KpiStrip ──
    kpi,

    collection: {
      totalCollected,
      target: totalRent,
      outstandingBalance: totalOutstanding,
      rent: { collected: totalCollected, target: totalRent },
      cam: raw.collection?.cam ?? {},
      electricity: raw.collection?.electricity ?? {},
    },

    occupancy: {
      rate: raw.occupancyRate ?? 0,
      occupancyRate: raw.occupancyRate ?? 0,
      occupied: raw.occupiedUnits ?? 0,
      occupiedUnits: raw.occupiedUnits ?? 0,
      totalUnits: raw.totalUnits ?? 0,
      total: raw.totalUnits ?? 0,
      vacant: (raw.totalUnits ?? 0) - (raw.occupiedUnits ?? 0),
      vacantUnits: (raw.totalUnits ?? 0) - (raw.occupiedUnits ?? 0),
    },

    attention: {
      urgentCount:
        (overdueRents.length > 0 ? 1 : 0) +
        (openMaintenance.length > 0 ? 1 : 0),
      // overdueCount: how many tenants are overdue.
      // The backend top-3 sample gives us a floor; if allTime outstanding > 0
      // we know at least that many are unpaid. kpi.tenantsWithBalance is a
      // billing estimate — not reliable enough for the attention panel count.
      overdueCount: overdueRents.length,
      overdueAmount,
      overduePayments: overdueRents.length,
      overdueTotal: overdueAmount,
      maintenanceCount: openMaintenance.length,
      maintenanceRequests: maintenanceList.length,
      maintenanceDetail: firstMaintenance?.title ?? "—",
    },

    openRequests: openMaintenance.length,
    activeTenants: raw.activeTenants ?? 0,

    recentActivity,
    recentActivities: recentActivity, // legacy alias

    maintenance: maintenanceList,
    upcomingMaintenance: Array.isArray(raw.upcomingMaintenance)
      ? raw.upcomingMaintenance
      : [],
    generatorsDueService: Array.isArray(raw.generatorsDueService)
      ? raw.generatorsDueService
      : [],
    // Use displayStatus for upcomingRents too — unpaid rents due in the future
    // should show "pending", not whatever stale value the DB has.
    upcomingRents: Array.isArray(raw.upcomingRents)
      ? raw.upcomingRents.map((r) => ({
          ...r,
          status: r.displayStatus ?? r.status,
        }))
      : [],
    overdueRents,
    contractsEndingSoon: Array.isArray(raw.contractsEndingSoon)
      ? raw.contractsEndingSoon
      : [],

    // Per-Block building performance array — empty for single-block setups.
    // BuildingPerformanceGrid returns null when buildings.length === 0.
    buildings,
  };
}

/**
 * useStats — fetches and normalizes dashboard stats from
 * GET /api/payment/dashboard-stats.
 *
 * @returns {{ stats, loading, error, refetch }}
 */
export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/payment/dashboard-stats");
      const raw = response.data?.data ?? response.data ?? null;
      setStats(normalizeDashboardStats(raw));
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch dashboard stats";
      setError(message);
      setStats(null);
      console.error("Error fetching dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export default useStats;
