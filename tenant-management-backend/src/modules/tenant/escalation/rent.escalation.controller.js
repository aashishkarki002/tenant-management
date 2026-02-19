/**
 * RENT ESCALATION CONTROLLER
 * Thin HTTP layer — all logic lives in rent.escalation.service.js
 */

import * as escalationService from "./rent.escalation.service.js";

// GET /escalation/preview/:tenantId?percentage=5
export const previewEscalation = async (req, res) => {
  try {
    const pct = req.query.percentage
      ? parseFloat(req.query.percentage)
      : undefined;

    const preview = await escalationService.previewEscalation(
      req.params.tenantId,
      pct,
    );
    return res.status(200).json({ success: true, preview });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /escalation/apply/:tenantId
// Body: { overridePercentage?, note? }
export const applyEscalation = async (req, res) => {
  try {
    const { overridePercentage, note } = req.body;
    const result = await escalationService.applyEscalation(
      req.params.tenantId,
      { overridePercentage, note, adminId: req.admin?.id },
    );
    const statusCode = result.success ? 200 : (result.statusCode ?? 400);
    return res.status(statusCode).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /escalation/enable/:tenantId
// Body: { percentageIncrease, intervalMonths?, appliesTo?, startDate? }
export const enableEscalation = async (req, res) => {
  try {
    const result = await escalationService.enableEscalation(
      req.params.tenantId,
      req.body,
    );
    const statusCode = result.success ? 200 : (result.statusCode ?? 400);
    return res.status(statusCode).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /escalation/disable/:tenantId
export const disableEscalation = async (req, res) => {
  try {
    const result = await escalationService.disableEscalation(
      req.params.tenantId,
    );
    const statusCode = result.success ? 200 : (result.statusCode ?? 400);
    return res.status(statusCode).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /escalation/history/:tenantId
export const getEscalationHistory = async (req, res) => {
  try {
    const history = await escalationService.getEscalationHistory(
      req.params.tenantId,
    );
    return res.status(200).json({ success: true, history });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /escalation/data/:tenantId
export const getEscalationData = async (req, res) => {
  try {
    const data = await escalationService.getEscalationData(
      req.params.tenantId,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /escalation/process-due  (called by cron or manually by super-admin)
export const processDueEscalations = async (req, res) => {
  try {
    const asOf = req.body.asOf ? new Date(req.body.asOf) : new Date();
    const summary = await escalationService.processDueEscalations(asOf);
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
