/**
 * SYSTEM SETTINGS CONTROLLER
 * Thin HTTP layer — all logic in system.settings.service.js
 */

import * as settingsService from "./systemSetting.service.js";

// GET /api/settings/system
export const getAllSettings = async (req, res) => {
  try {
    const data = await settingsService.getAllSystemSettings();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── ESCALATION ────────────────────────────────────────────────────────────────

// POST /api/settings/system/escalation
export const saveEscalation = async (req, res) => {
  try {
    const result = await settingsService.saveEscalationSettings(
      req.body,
      req.admin?.id,
    );
    return res
      .status(result.success ? 200 : (result.statusCode ?? 400))
      .json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/settings/system/escalation/apply-all
export const applyEscalationToAll = async (req, res) => {
  try {
    const result = await settingsService.applyEscalationToAllTenants(
      req.admin?.id,
    );
    return res
      .status(result.success ? 200 : (result.statusCode ?? 400))
      .json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/settings/system/escalation/disable-all
export const disableEscalationAll = async (req, res) => {
  try {
    const result = await settingsService.disableEscalationForAllTenants();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── LATE FEE ──────────────────────────────────────────────────────────────────

// POST /api/settings/system/late-fee
export const saveLateFee = async (req, res) => {
  try {
    const result = await settingsService.saveLateFeeSettings(
      req.body,
      req.admin?.id,
    );
    return res
      .status(result.success ? 200 : (result.statusCode ?? 400))
      .json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
