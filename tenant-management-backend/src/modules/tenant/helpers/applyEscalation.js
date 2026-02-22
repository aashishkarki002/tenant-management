import { SystemConfig } from "../../systemConfig/SystemConfig.Model.js";
import { enableEscalation } from "../escalation/rent.escalation.service.js";
/**
 * Read system-wide escalation defaults from SystemConfig.
 * If enabled, call enableEscalation on the given tenant.
 *
 * Called fire-and-forget after createTenant transaction commits.
 * Safe to fail — tenant creation is never affected.
 *
 * @param {string} tenantId
 * @returns {Promise<{ applied: boolean }>}
 */
export async function applyEscalationIfEnabled(tenantId) {
  const CONFIG_KEY = "rentEscalationDefaults";

  const config = await SystemConfig.findOne({ key: CONFIG_KEY });

  // No defaults saved yet, or admin disabled the system switch — skip
  if (!config?.value?.enabled) {
    return { applied: false };
  }

  const {
    percentageIncrease,
    intervalMonths = 12,
    appliesTo = "rent_only",
  } = config.value;

  const result = await enableEscalation(tenantId, {
    percentageIncrease,
    intervalMonths,
    appliesTo,
  });

  return { applied: result.success };
}
