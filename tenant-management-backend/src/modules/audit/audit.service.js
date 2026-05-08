/**
 * audit.service.js
 *
 * Append-only audit log service.
 * Exposes a single write method: log().
 * All reads go through the controller/route.
 *
 * IMPORTANT: Never call AuditLog.update/findOneAndUpdate anywhere.
 * This service is the sole write path to the AuditLog collection.
 */

import { AuditLog } from "./AuditLog.Model.js";

class AuditService {
  /**
   * Append an audit event.
   *
   * @param {string}           eventType     - AuditLog.eventType enum value
   * @param {string|ObjectId}  performedBy   - Admin._id who triggered the action
   * @param {Object}           [opts]
   * @param {string|ObjectId}  [opts.entityId]
   * @param {string}           [opts.resourceType]  e.g. "Transaction"
   * @param {string|ObjectId}  [opts.resourceId]
   * @param {Object}           [opts.before]        snapshot before change
   * @param {Object}           [opts.after]         snapshot after change
   * @param {number}           [opts.amountPaisa]
   * @param {string}           [opts.reason]
   * @param {string}           [opts.ipAddress]
   * @param {string}           [opts.userAgent]
   * @param {number}           [opts.nepaliYear]
   * @param {number}           [opts.nepaliMonth]
   *
   * @returns {Promise<void>}  — fire-and-forget safe; errors are swallowed
   *                             with a console.error so audit failures never
   *                             break the main transaction path.
   */
  async log(eventType, performedBy, opts = {}) {
    try {
      await AuditLog.create({
        eventType,
        performedBy,
        performedAt: new Date(),
        entityId:     opts.entityId     ?? null,
        resourceType: opts.resourceType ?? null,
        resourceId:   opts.resourceId   ?? null,
        before:       opts.before       ?? null,
        after:        opts.after        ?? null,
        amountPaisa:  opts.amountPaisa  ?? null,
        reason:       opts.reason       ?? null,
        ipAddress:    opts.ipAddress    ?? null,
        userAgent:    opts.userAgent    ?? null,
        nepaliYear:   opts.nepaliYear   ?? null,
        nepaliMonth:  opts.nepaliMonth  ?? null,
      });
    } catch (err) {
      // Audit log failures must not crash the main request
      console.error("[audit] Failed to write audit log:", err.message);
    }
  }

  /**
   * Query audit logs with filtering.
   *
   * @param {Object} filters
   * @param {string}  [filters.entityId]
   * @param {string}  [filters.eventType]
   * @param {string}  [filters.performedBy]
   * @param {string}  [filters.resourceType]
   * @param {string}  [filters.resourceId]
   * @param {string}  [filters.startDate]   ISO date string
   * @param {string}  [filters.endDate]     ISO date string
   * @param {number}  [filters.nepaliYear]
   * @param {number}  [filters.nepaliMonth]
   * @param {number}  [filters.page]        1-based, default 1
   * @param {number}  [filters.limit]       default 50, max 200
   *
   * @returns {Promise<{ logs: AuditLog[], total: number, page: number, pages: number }>}
   */
  async queryLogs(filters = {}) {
    const query = {};

    if (filters.entityId)     query.entityId     = filters.entityId;
    if (filters.eventType)    query.eventType    = filters.eventType;
    if (filters.performedBy)  query.performedBy  = filters.performedBy;
    if (filters.resourceType) query.resourceType = filters.resourceType;
    if (filters.resourceId)   query.resourceId   = filters.resourceId;
    if (filters.nepaliYear)   query.nepaliYear   = Number(filters.nepaliYear);
    if (filters.nepaliMonth)  query.nepaliMonth  = Number(filters.nepaliMonth);

    if (filters.startDate || filters.endDate) {
      query.performedAt = {};
      if (filters.startDate) query.performedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.performedAt.$lte = end;
      }
    }

    const page  = Math.max(1, parseInt(filters.page  ?? 1, 10));
    const limit = Math.min(200, Math.max(1, parseInt(filters.limit ?? 50, 10)));
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ performedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("performedBy", "name email role")
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}

export const auditService = new AuditService();
