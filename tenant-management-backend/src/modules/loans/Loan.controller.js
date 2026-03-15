/**
 * Loan.controller.js  (FIXED)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXES:
 *
 * 1. createLoanController — returned 500 for ALL errors including client
 *    validation failures ("Principal must be positive", "entityId is required").
 *    Validation errors must return 400, not 500. Added isValidationError() helper
 *    to distinguish client errors from unexpected server errors.
 *
 * 2. recordPaymentController — returned 400 for ALL errors including unexpected
 *    DB errors that should be 500. Same fix applied: validation / business-rule
 *    errors → 400; unexpected errors → 500.
 *
 * 3. getLoansController — no ObjectId validation on entityId before passing to
 *    Mongoose. An invalid entityId string (e.g. "abc") causes a CastError that
 *    surfaces as a confusing 500. Now validated and returns 400 with a clear
 *    message.
 *
 * 4. getAmortizationController — no ObjectId validation on loanId param. Same
 *    CastError risk. Now validated before the service call.
 *
 * 5. recordPaymentController — no ObjectId validation on loanId param. Fixed.
 *
 * 6. Stale comment removed: controller file had a copy of loan.route.js and an
 *    incorrect mount path comment ("Mount at: /api/v1/finance/loans") — actual
 *    mount in app.js is "/api/loan". Removed.
 */

import mongoose from "mongoose";
import {
  createLoan,
  recordLoanPayment,
  getLoanAmortizationSchedule,
  getLoansByEntity,
} from "./Loan.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether an error is a client-caused validation / business-rule
 * error (→ 400) vs an unexpected server error (→ 500).
 *
 * Covers:
 *   - Our own thrown Error messages that start with known validation phrases
 *   - Mongoose ValidationError
 *   - Mongoose CastError (invalid ObjectId etc.)
 */
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
];

function isClientError(err) {
  if (err.name === "ValidationError") return true; // Mongoose schema validation
  if (err.name === "CastError") return true; // invalid ObjectId, bad type cast
  const msg = (err.message ?? "").toLowerCase();
  return VALIDATION_PHRASES.some((phrase) => msg.includes(phrase));
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
    // FIX 1: validation errors → 400, unexpected errors → 500
    const status = isClientError(err) ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// recordPaymentController
// POST /api/loan/:loanId/payment
// ─────────────────────────────────────────────────────────────────────────────
export async function recordPaymentController(req, res) {
  // FIX 5: validate loanId before hitting the service
  const { loanId } = req.params;
  if (!isValidObjectId(loanId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid loanId: "${loanId}"`,
    });
  }

  try {
    const result = await recordLoanPayment({
      ...req.body,
      loanId,
      createdBy: req.admin.id,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    // FIX 2: business-rule errors (loan CLOSED, fully repaid) → 400
    //         unexpected DB/journal errors → 500
    const status = isClientError(err) ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getAmortizationController
// GET /api/loan/:loanId/schedule
// ─────────────────────────────────────────────────────────────────────────────
export async function getAmortizationController(req, res) {
  // FIX 4: validate loanId param before passing to service
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
// getLoansController
// GET /api/loan?entityId=xxx&status=ACTIVE&propertyId=xxx
// ─────────────────────────────────────────────────────────────────────────────
export async function getLoansController(req, res) {
  const { entityId, status, propertyId } = req.query;

  // entityId is required
  if (!entityId) {
    return res.status(400).json({
      success: false,
      message: "entityId is required",
    });
  }

  // FIX 3: validate entityId is a real ObjectId before Mongoose CastError
  if (!isValidObjectId(entityId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid entityId: "${entityId}"`,
    });
  }

  // Optional: validate propertyId if provided
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
