/**
 * SYSTEM SETTINGS SERVICE
 *
 * Central store for all system-wide policies.
 * Currently manages:
 *   - rentEscalationDefaults  → auto-applied when a new tenant is created
 *   - lateFeePolicy           → applied when rent is overdue past grace period
 *
 * All settings stored in SystemConfig (key/value collection).
 * Add new policies here as the system grows.
 */

import { Tenant } from "../tenant/Tenant.Model.js";
import { SystemConfig } from "./SystemConfig.Model.js";
import { enableEscalation } from "../tenant/escalation/rent.escalation.service.js";

const KEYS = {
  ESCALATION: "rentEscalationDefaults",
  LATE_FEE: "lateFeePolicy",
};

// ─────────────────────────────────────────────────────────────────────────────
// READ ALL SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all system settings in a single call.
 * Frontend uses this to populate the entire Settings page on load.
 */
export async function getAllSystemSettings() {
  const [escalationDoc, lateFeeDoc] = await Promise.all([
    SystemConfig.findOne({ key: KEYS.ESCALATION }),
    SystemConfig.findOne({ key: KEYS.LATE_FEE }),
  ]);

  const tenantsWithEscalation = await Tenant.countDocuments({
    "rentEscalation.enabled": true,
  });

  return {
    escalation: {
      enabled: escalationDoc?.value?.enabled ?? false,
      percentageIncrease: escalationDoc?.value?.percentageIncrease ?? 5,
      intervalMonths: escalationDoc?.value?.intervalMonths ?? 12,
      appliesTo: escalationDoc?.value?.appliesTo ?? "rent_only",
      lastUpdatedAt: escalationDoc?.updatedAt ?? null,
      tenantsConfigured: tenantsWithEscalation,
    },
    lateFee: {
      enabled: lateFeeDoc?.value?.enabled ?? false,
      gracePeriodDays: lateFeeDoc?.value?.gracePeriodDays ?? 5,
      type: lateFeeDoc?.value?.type ?? "percentage", // "percentage" | "fixed"
      amount: lateFeeDoc?.value?.amount ?? 2, // 2% or Rs. 500
      appliesTo: lateFeeDoc?.value?.appliesTo ?? "rent", // "rent" | "cam" | "both"
      compounding: lateFeeDoc?.value?.compounding ?? false, // daily compounding?
      maxLateFeeAmount: lateFeeDoc?.value?.maxLateFeeAmount ?? 0, // 0 = no cap
      lastUpdatedAt: lateFeeDoc?.updatedAt ?? null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALATION SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveEscalationSettings(settings, adminId) {
  const {
    percentageIncrease,
    intervalMonths = 12,
    appliesTo = "rent_only",
    enabled,
  } = settings;

  if (enabled && (!percentageIncrease || percentageIncrease <= 0)) {
    return {
      success: false,
      message: "Percentage increase must be a positive number",
      statusCode: 400,
    };
  }

  await SystemConfig.findOneAndUpdate(
    { key: KEYS.ESCALATION },
    {
      key: KEYS.ESCALATION,
      value: {
        enabled,
        percentageIncrease: Number(percentageIncrease),
        intervalMonths: Number(intervalMonths),
        appliesTo,
      },
      updatedBy: adminId ?? null,
    },
    { upsert: true, new: true },
  );

  return { success: true, message: "Escalation defaults saved" };
}

export async function applyEscalationToAllTenants(adminId) {
  const config = await SystemConfig.findOne({ key: KEYS.ESCALATION });
  if (!config?.value?.enabled) {
    return {
      success: false,
      message: "Save and enable escalation defaults first",
      statusCode: 400,
    };
  }

  const { percentageIncrease, intervalMonths, appliesTo } = config.value;
  const tenants = await Tenant.find({
    status: "active",
    isDeleted: false,
  }).select("_id name");

  let applied = 0,
    failed = 0;
  const details = [];

  for (const tenant of tenants) {
    try {
      const result = await enableEscalation(tenant._id.toString(), {
        percentageIncrease,
        intervalMonths,
        appliesTo,
      });
      if (result.success) {
        applied++;
        details.push({ tenantId: tenant._id, name: tenant.name, status: "ok" });
      } else {
        failed++;
        details.push({
          tenantId: tenant._id,
          name: tenant.name,
          status: "failed",
          reason: result.message,
        });
      }
    } catch (err) {
      failed++;
      details.push({
        tenantId: tenant._id,
        name: tenant.name,
        status: "error",
        reason: err.message,
      });
    }
  }

  return {
    success: true,
    message: `Escalation applied to ${applied} tenant(s)${failed ? `, ${failed} failed` : ""}`,
    applied,
    failed,
    details,
  };
}

export async function disableEscalationForAllTenants() {
  const result = await Tenant.updateMany(
    { "rentEscalation.enabled": true },
    { $set: { "rentEscalation.enabled": false } },
  );
  await SystemConfig.findOneAndUpdate(
    { key: KEYS.ESCALATION },
    { $set: { "value.enabled": false } },
  );
  return {
    success: true,
    message: `Escalation disabled for ${result.modifiedCount} tenant(s)`,
    modifiedCount: result.modifiedCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LATE FEE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveLateFeeSettings(settings, adminId) {
  const {
    enabled,
    gracePeriodDays = 5,
    type = "percentage",
    amount,
    appliesTo = "rent",
    compounding = false,
    maxLateFeeAmount = 0,
  } = settings;

  if (enabled) {
    if (!amount || amount <= 0) {
      return {
        success: false,
        message: "Late fee amount must be positive",
        statusCode: 400,
      };
    }
    if (!["percentage", "fixed"].includes(type)) {
      return {
        success: false,
        message: "Type must be 'percentage' or 'fixed'",
        statusCode: 400,
      };
    }
    if (gracePeriodDays < 0) {
      return {
        success: false,
        message: "Grace period cannot be negative",
        statusCode: 400,
      };
    }
    if (type === "percentage" && amount > 100) {
      return {
        success: false,
        message: "Percentage cannot exceed 100",
        statusCode: 400,
      };
    }
  }

  await SystemConfig.findOneAndUpdate(
    { key: KEYS.LATE_FEE },
    {
      key: KEYS.LATE_FEE,
      value: {
        enabled,
        gracePeriodDays: Number(gracePeriodDays),
        type,
        amount: Number(amount),
        appliesTo,
        compounding,
        maxLateFeeAmount: Number(maxLateFeeAmount),
      },
      updatedBy: adminId ?? null,
    },
    { upsert: true, new: true },
  );

  return { success: true, message: "Late fee policy saved" };
}

/**
 * Calculate how much late fee applies to a given overdue amount.
 * Used by the rent processing module when charging late fees.
 *
 * @param {number} overdueAmountPaisa  — the overdue rent in paisa
 * @param {number} daysLate            — how many days past due (after grace period)
 * @returns {number}                   — late fee in paisa (0 if policy disabled/not applicable)
 */
export async function calculateLateFee(overdueAmountPaisa, daysLate) {
  const config = await SystemConfig.findOne({ key: KEYS.LATE_FEE });
  if (!config?.value?.enabled) return 0;

  const { gracePeriodDays, type, amount, compounding, maxLateFeeAmount } =
    config.value;

  const effectiveDaysLate = daysLate - gracePeriodDays;
  if (effectiveDaysLate <= 0) return 0;

  let feeInPaisa = 0;

  if (type === "fixed") {
    // Fixed amount in rupees → convert to paisa
    feeInPaisa = amount * 100;
  } else {
    // Percentage of overdue amount
    if (compounding) {
      // Daily compounding: amount * (1 + rate/100)^days - amount
      const dailyRate = amount / 100;
      feeInPaisa = Math.round(
        overdueAmountPaisa * (Math.pow(1 + dailyRate, effectiveDaysLate) - 1),
      );
    } else {
      // Simple percentage (flat, not per-day)
      feeInPaisa = Math.round(overdueAmountPaisa * (amount / 100));
    }
  }

  // Apply cap if set
  if (maxLateFeeAmount > 0) {
    const capInPaisa = maxLateFeeAmount * 100;
    feeInPaisa = Math.min(feeInPaisa, capInPaisa);
  }

  return feeInPaisa;
}
