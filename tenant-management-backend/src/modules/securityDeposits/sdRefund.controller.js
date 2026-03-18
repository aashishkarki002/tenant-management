/**
 * sdRefund.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin HTTP layer — validates request, calls service, returns response.
 * All business logic lives in sdRefund.service.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  preflightSdRefund,
  createSdRefund,
  confirmAndPost,
  reverseSdRefund,
  getRefundsForSd,
  getSdRefundById,
} from "./sdRefund.service.js";

// ── GET /api/sd-refund/preflight/:sdId ───────────────────────────────────────
export async function preflight(req, res) {
  try {
    const result = await preflightSdRefund(req.params.sdId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ── POST /api/sd-refund/draft ────────────────────────────────────────────────
export async function createDraft(req, res) {
  try {
    // entityId: resolved by resolveEntity middleware, or fallback from body
    const entityId = req.entity?._id ?? req.body?.entityId ?? null;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message:
          "entityId is required (attach resolveEntity middleware or pass in body)",
      });
    }

    const refund = await createSdRefund(req.body, req.admin.id, entityId);
    res.status(201).json({ success: true, data: refund });
  } catch (err) {
    console.error("createDraft error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
}

// ── POST /api/sd-refund/:refundId/confirm ────────────────────────────────────
export async function confirm(req, res) {
  try {
    const entityId = req.entity?._id ?? req.body?.entityId ?? null;
    if (!entityId) {
      return res
        .status(400)
        .json({ success: false, message: "entityId is required" });
    }

    const result = await confirmAndPost(
      req.params.refundId,
      req.admin.id,
      entityId,
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("confirm error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
}

// ── POST /api/sd-refund/:refundId/reverse ────────────────────────────────────
// Requires super_admin (enforced in route via authorize())
export async function reverse(req, res) {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reversal reason is required",
      });
    }

    const result = await reverseSdRefund(
      req.params.refundId,
      reason,
      req.admin.id,
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("reverse error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
}

// ── GET /api/sd-refund/by-sd/:sdId ──────────────────────────────────────────
export async function listBySd(req, res) {
  try {
    const refunds = await getRefundsForSd(req.params.sdId);
    res.status(200).json({ success: true, data: refunds });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/sd-refund/:refundId ─────────────────────────────────────────────
export async function getOne(req, res) {
  try {
    const refund = await getSdRefundById(req.params.refundId);
    if (!refund) {
      return res
        .status(404)
        .json({ success: false, message: "SdRefund not found" });
    }
    res.status(200).json({ success: true, data: refund });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
