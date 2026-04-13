/**
 * Loan.controller.js  (FIXED — critical issues)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXES IN THIS VERSION (on top of prior status-code fixes):
 *
 * FIX A — recordPaymentController was not forwarding entityId to the service.
 *   entityId is required by recordLoanPayment (for Expense + Liability writes).
 *   It is read from req.body and passed through explicitly.
 *
 * FIX B — recordPaymentController response now surfaces wasAdjusted and
 *   expenseCreated from the service summary, so callers know when the final
 *   EMI was trimmed or when no Expense doc was created (zero-interest loan).
 *
 * FIX C — "Concurrent payment detected" error is a transient 409 Conflict,
 *   not a 400 validation error and not a 500 server error. Added a specific
 *   check for it so clients know to retry rather than treat it as bad input.
 *
 * All prior fixes retained:
 *   - isClientError() distinguishes validation errors (400) from server errors (500)
 *   - isValidObjectId() guards loanId and entityId before Mongoose CastErrors
 *   - getLoansController validates entityId and optional propertyId query params
 *   - getAmortizationController validates loanId param
 */

import mongoose from "mongoose";
import {
  createLoan,
  recordLoanPayment,
  getLoanAmortizationSchedule,
  getLoansByEntity,
  getLoanPayments,
  updateLoan,
} from "./Loan.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALIDATION_PHRASES = [
  "is required",
  "must be",
  "not found",
  "cannot",
  "invalid",
  "already",
  "fully repaid",
  "cannot record payment",
  "does not balance",
  "no entity",
  "entityid",
  "loanid",
  "exceeds outstanding", // FIX 2: overpayment error phrase
  "positive integer", // FIX 2: paisa validation phrase
];

function isClientError(err) {
  if (err.name === "ValidationError") return true;
  if (err.name === "CastError") return true;
  const msg = (err.message ?? "").toLowerCase();
  return VALIDATION_PHRASES.some((phrase) => msg.includes(phrase));
}

function isConcurrentError(err) {
  return (err.message ?? "").toLowerCase().includes("concurrent payment");
}

function isValidObjectId(id) {
  return (
    mongoose.Types.ObjectId.isValid(id) &&
    String(new mongoose.Types.ObjectId(id)) === String(id)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// createLoanController
// POST /api/loan
// ─────────────────────────────────────────────────────────────────────────────
export async function createLoanController(req, res) {
  try {
    const result = await createLoan({
      ...req.body,
      createdBy: req.admin.id,
    });

    return res.status(201).json({
      success: true,
      data: result.loan,
      transaction: result.transaction,
    });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// recordPaymentController
// POST /api/loan/:loanId/payment
// ─────────────────────────────────────────────────────────────────────────────
export async function recordPaymentController(req, res) {
  const { loanId } = req.params;

  if (!isValidObjectId(loanId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid loanId: "${loanId}"`,
    });
  }

  // FIX A: entityId must come from the request body — it was never forwarded
  // before, causing the service to throw "entityId is required" on every call.
  const { entityId } = req.body;
  if (!entityId) {
    return res.status(400).json({
      success: false,
      message: "entityId is required in the request body",
    });
  }
  if (!isValidObjectId(entityId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid entityId: "${entityId}"`,
    });
  }

  try {
    const result = await recordLoanPayment({
      ...req.body,
      loanId,
      createdBy: req.admin.id,
    });

    // FIX B: surface wasAdjusted and expenseCreated to the caller
    return res.status(200).json({
      success: true,
      data: {
        payment: result.payment,
        transaction: result.transaction,
        expense: result.expense ?? null,
        summary: result.summary,
      },
    });
  } catch (err) {
    // FIX C: concurrent payment is a 409 Conflict — client should retry
    if (isConcurrentError(err)) {
      return res.status(409).json({ success: false, message: err.message });
    }
    const status = isClientError(err) ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getAmortizationController
// GET /api/loan/:loanId/schedule
// ─────────────────────────────────────────────────────────────────────────────
export async function getAmortizationController(req, res) {
  const { loanId } = req.params;
  if (!isValidObjectId(loanId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid loanId: "${loanId}"`,
    });
  }

  try {
    const data = await getLoanAmortizationSchedule(loanId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPaymentsController
// GET /api/loan/:loanId/payments
// ─────────────────────────────────────────────────────────────────────────────
export async function getPaymentsController(req, res) {
  const { loanId } = req.params;
  if (!isValidObjectId(loanId)) {
    return res.status(400).json({ success: false, message: `Invalid loanId: "${loanId}"` });
  }
  try {
    const payments = await getLoanPayments(loanId);
    return res.status(200).json({ success: true, data: payments });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateLoanController
// PATCH /api/loan/:loanId
// ─────────────────────────────────────────────────────────────────────────────
export async function updateLoanController(req, res) {
  const { loanId } = req.params;
  if (!isValidObjectId(loanId)) {
    return res.status(400).json({ success: false, message: `Invalid loanId: "${loanId}"` });
  }
  try {
    const updated = await updateLoan(loanId, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    const status = isClientError(err) ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getLoansController
// GET /api/loan?entityId=xxx&status=ACTIVE&propertyId=xxx
// ─────────────────────────────────────────────────────────────────────────────
export async function getLoansController(req, res) {
  const { entityId, status, propertyId } = req.query;

  if (!entityId) {
    return res.status(400).json({
      success: false,
      message: "entityId is required",
    });
  }
  if (!isValidObjectId(entityId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid entityId: "${entityId}"`,
    });
  }
  if (propertyId && !isValidObjectId(propertyId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid propertyId: "${propertyId}"`,
    });
  }

  try {
    const loans = await getLoansByEntity(entityId, { status, propertyId });
    return res.status(200).json({ success: true, data: loans });
  } catch (err) {
    const status_code = isClientError(err) ? 400 : 500;
    return res
      .status(status_code)
      .json({ success: false, message: err.message });
  }
}
