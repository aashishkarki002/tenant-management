/**
 * electricity.rate.controller.js — updated
 *
 * Dual-rate system:
 *   neaRatePerUnit    → what NEA charges the building (your cost)
 *   customRatePerUnit → what you charge tenants (your revenue)
 *
 * Both rates are stored in ElectricityRate. The margin is auto-computed
 * on each reading and surfaces cleanly in the accounting P&L.
 */

import { electricityService } from "./electricity.service.js";

/**
 * GET /api/electricity/rate/:propertyId
 * Returns current rates + full history for the owner dashboard.
 */
export const getElectricityRate = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const data = await electricityService.getPropertyRate(propertyId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching electricity rate:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/electricity/rate/:propertyId
 *
 * Body: {
 *   customRatePerUnit:  number   (rupees — what you charge tenants, e.g. 20)
 *   neaRatePerUnit?:    number   (rupees — what NEA charges you, e.g. 15)
 *   note?:              string   optional — "NEA revision Q1 2082"
 *   meterTypeRates?: {           optional per-type custom rate overrides (rupees)
 *     common_area?: number
 *     parking?:     number
 *     sub_meter?:   number
 *   }
 * }
 *
 * Backward-compat: if body has `ratePerUnit` (old field) and no
 * `customRatePerUnit`, treat `ratePerUnit` as `customRatePerUnit`.
 *
 * Validates: rates > 0, neaRate < customRate (warns if not — not blocked).
 * Appends to rate history — old rates are never overwritten (audit trail).
 */
export const setElectricityRate = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { neaRatePerUnit, note, meterTypeRates } = req.body;

    // Backward-compat: accept either customRatePerUnit or legacy ratePerUnit
    const customRatePerUnit =
      req.body.customRatePerUnit ?? req.body.ratePerUnit;

    if (
      !customRatePerUnit ||
      isNaN(parseFloat(customRatePerUnit)) ||
      parseFloat(customRatePerUnit) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "customRatePerUnit is required and must be a positive number (e.g. 20). " +
          "This is what you charge tenants per kWh.",
      });
    }

    // neaRatePerUnit is optional — margin tracking is disabled when absent
    const parsedNeaRate =
      neaRatePerUnit != null && neaRatePerUnit !== ""
        ? parseFloat(neaRatePerUnit)
        : null;

    if (parsedNeaRate !== null && parsedNeaRate <= 0) {
      return res.status(400).json({
        success: false,
        message: "neaRatePerUnit must be a positive number (e.g. 15).",
      });
    }

    // Warn (not block) if NEA rate >= custom rate — legitimate in some cases
    // but usually indicates a data entry error.
    const warnings = [];
    if (
      parsedNeaRate !== null &&
      parsedNeaRate >= parseFloat(customRatePerUnit)
    ) {
      warnings.push(
        `NEA rate (Rs ${parsedNeaRate}) is >= custom rate (Rs ${customRatePerUnit}). ` +
          `This means no margin or a loss on electricity billing. Please verify.`,
      );
    }

    const result = await electricityService.setPropertyRate(
      propertyId,
      parseFloat(customRatePerUnit),
      parsedNeaRate,
      req.admin.id,
      note ?? "",
      meterTypeRates ?? {},
    );

    res.status(200).json({
      success: true,
      message:
        `Custom rate set to Rs ${parseFloat(customRatePerUnit).toFixed(2)} / kWh` +
        (parsedNeaRate
          ? `. NEA cost rate: Rs ${parsedNeaRate.toFixed(2)} / kWh.`
          : "."),
      warnings: warnings.length ? warnings : undefined,
      data: result,
    });
  } catch (error) {
    console.error("Error setting electricity rate:", error);
    res.status(error.message.includes("Invalid") ? 400 : 500).json({
      success: false,
      message: error.message,
    });
  }
};
