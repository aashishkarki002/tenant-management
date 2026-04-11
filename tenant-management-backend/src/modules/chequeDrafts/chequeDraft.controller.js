/**
 * chequeDraft.controller.js
 *
 * Thin HTTP layer — validates input, delegates to chequeDraft.service.js,
 * and sends a consistent JSON response.
 */

import mongoose from "mongoose";
import {
  getChequeDrafts,
  getChequeDraftById,
  getChequeDraftSummary,
  markDeposited,
  markBounced,
  markCancelled,
} from "./chequeDraft.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_ERROR_PHRASES = [
  "is required",
  "not found",
  "not in pending",
  "must be",
  "invalid",
  "cannot",
];

function isClientError(err) {
  if (err.name === "ValidationError") return true;
  if (err.name === "CastError") return true;
  const msg = (err.message ?? "").toLowerCase();
  return CLIENT_ERROR_PHRASES.some((p) => msg.includes(p));
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

export async function listChequeDraftsController(req, res) {
  try {
    const result = await getChequeDrafts(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}

export async function getChequeDraftSummaryController(req, res) {
  try {
    const { entityId } = req.query;
    if (!entityId || !isValidId(entityId)) {
      return res.status(400).json({
        success: false,
        message: "Valid entityId query param is required",
      });
    }
    const summary = await getChequeDraftSummary(entityId);
    res.status(200).json({ success: true, data: summary });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}

export async function getChequeDraftByIdController(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const draft = await getChequeDraftById(id);
    res.status(200).json({ success: true, data: draft });
  } catch (err) {
    const status = isClientError(err) ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}

export async function depositChequeDraftController(req, res) {
  try {
    const { id } = req.params;

    const { depositDate, depositNotes } = req.body;
    const depositedBy = req.admin.id;

    const { draft } = await markDeposited(id, {
      depositedBy,
      depositDate,
      depositNotes,
    });
    res.status(200).json({
      success: true,
      message: "Cheque marked as deposited",
      data: draft,
    });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}

export async function bounceChequeDraftController(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const { bounceReason } = req.body;
    const bouncedBy = req.admin.id;

    const { draft } = await markBounced(id, { bouncedBy, bounceReason });
    res.status(200).json({
      success: true,
      message: "Cheque marked as bounced",
      data: draft,
    });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}

export async function cancelChequeDraftController(req, res) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const { cancelReason } = req.body;
    const cancelledBy = req.admin.id;

    const { draft } = await markCancelled(id, { cancelledBy, cancelReason });
    res
      .status(200)
      .json({ success: true, message: "Cheque cancelled", data: draft });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}
