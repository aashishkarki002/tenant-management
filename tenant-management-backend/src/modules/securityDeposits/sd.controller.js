/**
 * sd.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin HTTP layer — validate request, call service, return response.
 * Zero business logic here.
 *
 * ROUTES (register in app.js):
 *
 *   POST  /api/sd/create                  → createSdController
 *   GET   /api/sd/get-sd/:sdId            → getSdByIdController
 *   GET   /api/sd/by-tenant/:tenantId     → getSdByTenantController
 *   GET   /api/sd/all-by-tenant/:tenantId → getAllSdsByTenantController
 *   GET   /api/sd/by-block/:blockId       → getSdsByBlockController
 *   GET   /api/sd/summary/:tenantId       → getSdSummaryController
 *
 * All write routes: admin, super_admin only.
 * All read  routes: admin, super_admin, staff.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  createSd,
  getSdById,
  getSdByTenant,
  getAllSdsByTenant,
  getSdsByBlock,
  getSdSummaryForTenant,
} from "./sd.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/sd/create
export async function createSdController(req, res) {
  try {
    const entityId =
      req.entity?._id ?? req.body?.entityId ?? req.query?.entityId ?? null;
    const result = await createSd(req.body, req.admin?.id, null, entityId);
    const status = result.success ? 201 : 400;
    res.status(status).json({
      success: result.success,
      message: result.message,
      data: result.data ?? null,
      // legacy field — some callers still expect `sd`
      sd: result.data ?? null,
    });
  } catch (error) {
    console.error("createSdController error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/sd/get-sd/:sdId
export async function getSdByIdController(req, res) {
  try {
    const sd = await getSdById(req.params.sdId);
    if (!sd) {
      return res
        .status(404)
        .json({ success: false, message: "Security deposit not found" });
    }
    res.status(200).json({ success: true, data: sd });
  } catch (error) {
    const status = error.message.startsWith("Invalid") ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
}

// GET /api/sd/by-tenant/:tenantId
// Returns the single most-relevant (active) SD for a tenant.
// This is what SecurityDepositTab calls when sdId is not pre-loaded.
export async function getSdByTenantController(req, res) {
  try {
    const sd = await getSdByTenant(req.params.tenantId);
    if (!sd) {
      // 404 is intentional — tab shows empty state
      return res.status(404).json({
        success: false,
        message: "No security deposit found for this tenant",
      });
    }
    res.status(200).json({ success: true, data: sd });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/sd/all-by-tenant/:tenantId
// Returns ALL SDs for a tenant (multiple leases / re-deposits).
export async function getAllSdsByTenantController(req, res) {
  try {
    const sds = await getAllSdsByTenant(req.params.tenantId);
    res.status(200).json({ success: true, count: sds.length, data: sds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/sd/by-block/:blockId?status=paid&nepaliYear=2081&search=Ram
export async function getSdsByBlockController(req, res) {
  try {
    const { status, nepaliYear, search } = req.query;
    const sds = await getSdsByBlock(req.params.blockId, {
      status,
      nepaliYear: nepaliYear ? Number(nepaliYear) : undefined,
      search,
    });
    res.status(200).json({ success: true, count: sds.length, data: sds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/sd/summary/:tenantId
// Lightweight — for tenant list badge (status + remaining balance only).
export async function getSdSummaryController(req, res) {
  try {
    const summary = await getSdSummaryForTenant(req.params.tenantId);
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "No security deposit found for this tenant",
      });
    }
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
