/**
 * audit.controller.js
 *
 * GET-only controllers for the audit log.
 * No POST/PUT/DELETE — the audit log is append-only via auditService.log().
 */

import { auditService } from "./audit.service.js";
import { AuditLog } from "./AuditLog.Model.js";

/**
 * GET /api/audit
 * Query params: entityId, eventType, performedBy, resourceType, resourceId,
 *               startDate, endDate, nepaliYear, nepaliMonth, page, limit
 */
export const getAuditLogs = async (req, res) => {
  try {
    const result = await auditService.queryLogs(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[audit] getAuditLogs:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/audit/event-types
 * Returns the list of valid event types for UI dropdowns.
 */
export const getEventTypes = async (_req, res) => {
  const types = AuditLog.schema.path("eventType").enumValues;
  res.status(200).json({ success: true, data: types });
};
