/**
 * systemSetting.service.js
 *
 * Central store for all system-wide policies.
 *
 * Late fee policy types:
 *
 *   "percentage"   — one-time flat charge: balance × rate%  (charged once)
 *   "simple_daily" — linear daily growth:  balance × rate% × days
 *   "fixed"        — flat rupee amount, charged once
 *
 *   "percentage" + compounding=true → daily compound interest (exponential)
 *   Note: compounding flag is only meaningful when type="percentage".
 *         For simple_daily and fixed it is ignored.
 */

import { Tenant } from "../tenant/Tenant.Model.js";
import { SystemConfig } from "./SystemConfig.Model.js";
import { enableEscalation } from "../tenant/escalation/rent.escalation.service.js";

const KEYS = {
  ESCALATION: "rentEscalationDefaults",
  LATE_FEE: "lateFeePolicy",
};

const VALID_LATE_FEE_TYPES = ["percentage", "simple_daily", "fixed"];

// ─────────────────────────────────────────────────────────────────────────────
// READ ALL SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

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
      type: lateFeeDoc?.value?.type ?? "simple_daily",
      amount: lateFeeDoc?.value?.amount ?? 2,
      appliesTo: lateFeeDoc?.value?.appliesTo ?? "rent",
      compounding: lateFeeDoc?.value?.compounding ?? false,
      maxLateFeeAmount: lateFeeDoc?.value?.maxLateFeeAmount ?? 0,
      lastUpdatedAt: lateFeeDoc?.updatedAt ?? null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALATION SETTINGS  (unchanged)
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

/**
 * Save the late fee policy to SystemConfig.
 *
 * Supported types:
 *   "percentage"   — flat one-time charge (% of overdue balance)
 *   "simple_daily" — linear daily growth (% × days) ← recommended default
 *   "fixed"        — flat rupee amount once
 *
 *   For "percentage" only: set compounding=true for exponential daily growth.
 */
export async function saveLateFeeSettings(settings, adminId) {
  const {
    enabled,
    gracePeriodDays = 5,
    type = "simple_daily",
    amount,
    appliesTo = "rent",
    compounding = false,
    maxLateFeeAmount = 0,
  } = settings;

  if (enabled) {
    if (!VALID_LATE_FEE_TYPES.includes(type)) {
      return {
        success: false,
        message: `type must be one of: ${VALID_LATE_FEE_TYPES.join(", ")}`,
        statusCode: 400,
      };
    }
    if (!amount || amount <= 0) {
      return {
        success: false,
        message: "Late fee amount must be positive",
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
    if (type === "simple_daily" && amount > 100) {
      return {
        success: false,
        message: "Daily rate cannot exceed 100%",
        statusCode: 400,
      };
    }
    // compounding is only meaningful for "percentage" type
    if (compounding && type !== "percentage") {
      return {
        success: false,
        message:
          `compounding=true is only valid for type="percentage". ` +
          `For daily growth use type="simple_daily" instead.`,
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
        compounding: type === "percentage" ? Boolean(compounding) : false,
        maxLateFeeAmount: Number(maxLateFeeAmount),
      },
      updatedBy: adminId ?? null,
    },
    { upsert: true, new: true },
  );

  return { success: true, message: "Late fee policy saved" };
}

/**
 * Calculate the late fee paisa for a given overdue amount.
 * Used externally when you need a preview without running the cron.
 *
 * Mirrors computeLateFee() in lateFee.cron.js but reads the policy
 * from DB so callers don't need to load it themselves.
 *
 * @param {number} overdueAmountPaisa
 * @param {number} daysLate            — total days past due (grace is subtracted internally)
 * @returns {Promise<number>}          — late fee in paisa (0 if disabled)
 */
export async function calculateLateFee(overdueAmountPaisa, daysLate) {
  const config = await SystemConfig.findOne({ key: KEYS.LATE_FEE });
  if (!config?.value?.enabled) return 0;

  const { gracePeriodDays, type, amount, compounding, maxLateFeeAmount } =
    config.value;

  const effectiveDaysLate = daysLate - gracePeriodDays;
  if (effectiveDaysLate <= 0 || overdueAmountPaisa <= 0) return 0;

  let feeInPaisa = 0;

  if (type === "fixed") {
    feeInPaisa = Math.round(amount * 100);
  } else if (type === "simple_daily") {
    // Linear: balance × rate% × days
    feeInPaisa = Math.round(
      overdueAmountPaisa * (amount / 100) * effectiveDaysLate,
    );
  } else if (type === "percentage" && compounding) {
    // Exponential: P × ((1 + r)^d − 1)
    const r = amount / 100;
    feeInPaisa = Math.round(
      overdueAmountPaisa * (Math.pow(1 + r, effectiveDaysLate) - 1),
    );
  } else {
    // Flat percentage, charged once
    feeInPaisa = Math.round(overdueAmountPaisa * (amount / 100));
  }

  if (maxLateFeeAmount > 0) {
    feeInPaisa = Math.min(feeInPaisa, Math.round(maxLateFeeAmount * 100));
  }

  return Math.max(0, feeInPaisa);
}
