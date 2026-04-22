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

// ── OWNERSHIP CONFIG ──────────────────────────────────────────────────────────

import { SystemConfig } from "./SystemConfig.Model.js";

// GET /api/settings/ownership-config
export const getOwnershipConfig = async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ key: "ownershipConfig" })
      .populate("defaultEntityId", "name type chartOfAccountsPrefix")
      .lean();
    return res.status(200).json({
      success: true,
      data: config ?? { systemMode: "private", defaultEntityId: null },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── CRON SETTINGS ─────────────────────────────────────────────────────────────

// GET /api/settings/cron
export const getCronSettingsCtrl = async (req, res) => {
  try {
    const data = await settingsService.getCronSettings();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/settings/cron
export const saveCronSettingsCtrl = async (req, res) => {
  try {
    const result = await settingsService.saveCronSettings(req.body, req.admin?.id);
    if (result.success && result.data?.dailyChecklist) {
      // Dynamically reschedule daily checklist crons with new times/enabled state
      const { scheduleDailyChecklistCron } = await import("../../cron/service/dailyCheck.cron.js");
      scheduleDailyChecklistCron(result.data.dailyChecklist);
    }
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/settings/system-mode
export const updateSystemMode = async (req, res) => {
  try {
    const { systemMode } = req.body;
    if (!["private", "company", "merged"].includes(systemMode)) {
      return res.status(400).json({ success: false, message: "Invalid systemMode" });
    }
    const config = await SystemConfig.findOneAndUpdate(
      { key: "ownershipConfig" },
      { $set: { systemMode, updatedBy: req.admin?.id } },
      { new: true, upsert: true },
    ).lean();
    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
