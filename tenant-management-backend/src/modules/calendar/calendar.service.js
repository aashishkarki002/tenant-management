import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { ChecklistResult } from "../dailyChecks/checkListResult.model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Rent } from "../rents/rent.Model.js";

/**
 * Aggregate all property events within a date range into a unified event list.
 * Single-property build — no entityId scoping needed.
 *
 * @param {{ startDate: string, endDate: string }} params  ISO date strings
 * @returns {Promise<Array>}  Normalised event objects
 */
export async function getCalendarEvents({ startDate, endDate }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const [maintenanceTasks, checklistResults, tenants, rents] = await Promise.all([
    // Maintenance — by scheduledDate
    Maintenance.find({ scheduledDate: { $gte: start, $lte: end } })
      .select("title status priority scheduledDate type assignedTo amountPaisa description")
      .populate("assignedTo", "name")
      .lean(),

    // Daily check results — by checkDate
    ChecklistResult.find({ checkDate: { $gte: start, $lte: end } })
      .select("checkDate nepaliDate checklistType category status hasIssues failedItems")
      .lean(),

    // Tenants with any date falling in range
    Tenant.find({
      $or: [
        { leaseStartDate: { $gte: start, $lte: end } },
        { leaseEndDate: { $gte: start, $lte: end } },
        { keyHandoverDate: { $gte: start, $lte: end } },
        { "rentEscalation.nextEscalationDate": { $gte: start, $lte: end } },
      ],
    })
      .select(
        "name leaseStartDate leaseEndDate keyHandoverDate " +
        "leaseStartDateNepali leaseEndDateNepali rentEscalation"
      )
      .lean(),

    // Unpaid / overdue rents by due date
    Rent.find({
      englishDueDate: { $gte: start, $lte: end },
      status: { $in: ["pending", "overdue", "partially_paid"] },
    })
      .populate("tenant", "name")
      .select("englishDueDate status grossRentAmountPaisa paidAmountPaisa nepaliDate tenant")
      .lean(),
  ]);

  const events = [];

  // ── Maintenance ────────────────────────────────────────────────────────────
  for (const m of maintenanceTasks) {
    events.push({
      id: `maintenance-${m._id}`,
      type: "MAINTENANCE",
      title: m.title || "Maintenance Task",
      start: m.scheduledDate,
      extendedProps: {
        status: m.status,
        priority: m.priority,
        type: m.type,
        description: m.description,
        assignedTo: m.assignedTo?.name ?? null,
        amountPaisa: m.amountPaisa ?? 0,
      },
    });
  }

  // ── Daily Checks ───────────────────────────────────────────────────────────
  for (const r of checklistResults) {
    const category = r.category?.replace(/_/g, " ") ?? "Check";
    events.push({
      id: `check-${r._id}`,
      type: "DAILY_CHECK",
      title: `${category} Check`,
      start: r.checkDate,
      extendedProps: {
        status: r.status,
        hasIssues: r.hasIssues,
        failedItems: r.failedItems ?? 0,
        nepaliDate: r.nepaliDate,
        checklistType: r.checklistType,
        category: r.category,
      },
    });
  }

  // ── Tenant lease / escalation events ──────────────────────────────────────
  for (const t of tenants) {
    const inRange = (d) => d && new Date(d) >= start && new Date(d) <= end;

    if (inRange(t.leaseStartDate)) {
      events.push({
        id: `lease-start-${t._id}`,
        type: "LEASE_START",
        title: `${t.name} – Lease Start`,
        start: t.leaseStartDate,
        extendedProps: { tenantName: t.name, nepaliDate: t.leaseStartDateNepali },
      });
    }

    if (inRange(t.leaseEndDate)) {
      events.push({
        id: `lease-end-${t._id}`,
        type: "LEASE_END",
        title: `${t.name} – Lease Ends`,
        start: t.leaseEndDate,
        extendedProps: { tenantName: t.name, nepaliDate: t.leaseEndDateNepali },
      });
    }

    if (inRange(t.keyHandoverDate)) {
      events.push({
        id: `handover-${t._id}`,
        type: "LEASE_START",
        title: `${t.name} – Key Handover`,
        start: t.keyHandoverDate,
        extendedProps: { tenantName: t.name, nepaliDate: null },
      });
    }

    const nextEsc = t.rentEscalation?.nextEscalationDate;
    if (inRange(nextEsc)) {
      events.push({
        id: `escalation-${t._id}`,
        type: "RENT_ESCALATION",
        title: `${t.name} – Rent Escalation`,
        start: nextEsc,
        extendedProps: {
          tenantName: t.name,
          nepaliDate: t.rentEscalation?.nextEscalationNepaliDate ?? null,
        },
      });
    }
  }

  // ── Rent due events ────────────────────────────────────────────────────────
  for (const r of rents) {
    const tenantName = r.tenant?.name ?? "Tenant";
    events.push({
      id: `rent-${r._id}`,
      type: r.status === "overdue" ? "RENT_OVERDUE" : "RENT_DUE",
      title: `${tenantName} – Rent`,
      start: r.englishDueDate,
      extendedProps: {
        tenantName,
        status: r.status,
        grossRentAmountPaisa: r.grossRentAmountPaisa,
        paidAmountPaisa: r.paidAmountPaisa,
        nepaliDate: r.nepaliDate,
      },
    });
  }

  return events;
}
