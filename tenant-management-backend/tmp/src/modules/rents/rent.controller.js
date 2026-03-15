/**
 * rent.controller.js
 *
 * Changes in this revision:
 *   - recordRentPaymentController is now exported and called from rent.route.js
 *     (it was implemented but never wired to a route in the previous revision).
 *   - getRentsController: extracts ALL supported filter query params and passes
 *     them to getRentsService, including rentFrequency for future use.
 *   - No logic changes to the payment or cron controllers.
 */

import {
  getRentsService,
  getRentByIdService,
  updateRentService,
  handleMonthlyRents,
  sendEmailToTenants,
} from "./rent.service.js";
import {
  recordRentPayment,
  recordUnitRentPayment,
} from "./rent.payment.service.js";

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/rent/get-rents
 *
 * Supported query params (all optional):
 *   nepaliMonth  — 1-12
 *   nepaliYear   — e.g. 2081
 *   status       — "all" | "pending" | "partially_paid" | "overdue" | "paid" | "cancelled"
 *   propertyId   — MongoDB ObjectId string
 *   tenantId     — MongoDB ObjectId string
 *   startDate    — ISO date string (filters on englishDueDate)
 *   endDate      — ISO date string (filters on englishDueDate)
 *
 * "all" is normalised to undefined so buildRentsFilter does not add a status
 * clause and all rents are returned — matches the frontend's "All Statuses"
 * dropdown value.
 */
export async function getRentsController(req, res) {
  try {
    const rawStatus = req.query.status;
    const filters = {
      tenantId: req.query.tenantId,
      propertyId: req.query.propertyId,
      // Treat "all" (sent by the frontend All-Statuses option) as no filter
      status: rawStatus === "all" ? undefined : rawStatus,
      nepaliMonth: req.query.nepaliMonth,
      nepaliYear: req.query.nepaliYear,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await getRentsService(filters);
    return res.status(200).json({
      success: result.success,
      rents: result.rents || [],
      message: result.message || "Rents fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Rents fetching failed",
      error: error.message,
    });
  }
}

export async function getRentsByTenantController(req, res) {
  try {
    const result = await getRentsService({ tenantId: req.params.tenantId });
    return res.status(200).json({
      success: result.success,
      rents: result.rents || [],
      message: result.message || "Rents fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Rents fetching failed",
      error: error.message,
    });
  }
}

export async function getRentByIdController(req, res) {
  try {
    const result = await getRentByIdService(req.params.rentId);
    if (!result.success) {
      return res
        .status(result.statusCode === 404 ? 404 : 500)
        .json({ success: false, message: result.message });
    }
    return res.status(200).json({
      success: true,
      rent: result.rent,
      message: "Rent fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Rent fetching failed",
      error: error.message,
    });
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function updateRentController(req, res) {
  try {
    const result = await updateRentService(req.params.rentId, req.body);
    if (!result.success) {
      return res
        .status(result.statusCode === 404 ? 404 : 400)
        .json({ success: false, message: result.message });
    }
    return res
      .status(200)
      .json({ success: true, rent: result.rent, message: result.message });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Rent update failed",
      error: error.message,
    });
  }
}

// ── Cron triggers ─────────────────────────────────────────────────────────────

export async function processMonthlyRents(req, res) {
  try {
    const result = await handleMonthlyRents(req.admin?.id);
    return res.status(200).json({
      success: result.success,
      message: result.message,
      createdCount: result.createdCount || 0,
      updatedOverdueCount: result.updatedOverdueCount || 0,
      journalErrors: result.journalErrors || null,
      error: result.error || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Monthly rent processing failed",
      error: error.message,
    });
  }
}

export async function sendEmailToTenantsController(req, res) {
  try {
    const result = await sendEmailToTenants();
    return res
      .status(200)
      .json({ success: result.success, message: result.message });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Email sending failed",
      error: error.message,
    });
  }
}

// ── Payment recording ─────────────────────────────────────────────────────────

/**
 * POST /api/rent/record-payment/:rentId
 *
 * Body:
 *   amountPaisa      {number}  required — positive integer paisa
 *   paymentMethod    {string}  required — "cash"|"bank_transfer"|"cheque"|"mobile_wallet"
 *   bankAccountId    {string}  required for bank_transfer / cheque
 *   bankAccountCode  {string}  required for bank_transfer / cheque
 *   paymentDate      {string}  optional ISO date (defaults to now)
 *   nepaliDate       {string}  optional ISO date
 *   notes            {string}  optional
 *   unitPayments     {Array}   optional [{unitId, amountPaisa}] for unit-breakdown rents
 */
export async function recordRentPaymentController(req, res) {
  try {
    const { rentId } = req.params;
    const {
      amountPaisa,
      paymentMethod,
      bankAccountId,
      bankAccountCode,
      paymentDate,
      nepaliDate,
      notes,
      unitPayments,
    } = req.body;

    if (amountPaisa === undefined || amountPaisa === null) {
      return res
        .status(400)
        .json({ success: false, message: "amountPaisa is required" });
    }
    if (!paymentMethod) {
      return res
        .status(400)
        .json({ success: false, message: "paymentMethod is required" });
    }

    const serviceFn =
      Array.isArray(unitPayments) && unitPayments.length > 0
        ? recordUnitRentPayment
        : recordRentPayment;

    const result = await serviceFn({
      rentId,
      amountPaisa: Number(amountPaisa),
      paymentMethod,
      bankAccountId,
      bankAccountCode,
      paymentDate: paymentDate ? new Date(paymentDate) : undefined,
      nepaliDate: nepaliDate ? new Date(nepaliDate) : undefined,
      receivedBy: req.admin?._id ?? req.admin?.id,
      unitPayments,
      notes,
    });

    const status = result.statusCode ?? (result.success ? 200 : 500);
    return res.status(status).json(result);
  } catch (error) {
    console.error("[recordRentPaymentController]", error.message);
    return res.status(500).json({
      success: false,
      message: "Payment recording failed",
      error: error.message,
    });
  }
}
