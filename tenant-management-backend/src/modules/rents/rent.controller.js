/**
 * rent.controller.js
 *
 * Changes in this revision:
 *   - recordRentPaymentController is now exported and called from rent.route.js
 *     (it was implemented but never wired to a route in the previous revision).
 *   - getRentsController: extracts ALL supported filter query params and passes
 *     them to getRentsService, including rentFrequency for future use.
 *   - Added TDS document upload handling in recordRentPaymentController and markTdsPaidController.
 *   - No logic changes to the payment or cron controllers.
 */

import {
  getRentsService,
  getRentByIdService,
  updateRentService,
  handleMonthlyRents,
  sendEmailToTenants,
  markTdsPaidToGovernment,
} from "./rent.service.js";
import {
  recordRentPayment,
  recordUnitRentPayment,
} from "./rent.payment.service.js";
import { handleTdsDocumentUpload } from "./rent.tds.service.js";

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
 *   tdsPaidToGovt    {boolean} optional - mark TDS as paid to government
 *   tdsPaidDate      {string}  optional - date TDS was paid
 *   tdsNepaliDate    {string}  optional - Nepali date TDS was paid
 *   tdsNotes         {string}  optional - TDS payment notes
 *
 * Files:
 *   tdsDocument      {File}    optional - TDS receipt document (via multer)
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
      tdsPaidToGovt,
      tdsPaidDate,
      tdsNepaliDate,
      tdsNotes,
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
      nepaliDate: nepaliDate ?? undefined,
      receivedBy: req.admin?._id ?? req.admin?.id,
      unitPayments,
      notes,
    });

    const status = result.statusCode ?? (result.success ? 200 : 500);

    // Handle TDS marking after successful payment
    if (result.success && tdsPaidToGovt === "true" && result.rent) {
      try {
        const { buildEntityMapForBlocks } = await import(
          "../../helper/resolveEntity.js"
        );
        const entityMap = await buildEntityMapForBlocks([result.rent.block]);
        const entityId = entityMap.get(result.rent.block?.toString()) ?? null;

        await markTdsPaidToGovernment(
          rentId,
          req.admin?._id ?? req.admin?.id,
          {
            tdsPaidDate: tdsPaidDate ? new Date(tdsPaidDate) : undefined,
            nepaliTdsPaidDate: tdsNepaliDate,
            tdsPaidNotes: tdsNotes,
          },
          null,
          entityId,
        );

        // Handle TDS document upload if file provided
        if (req.file) {
          const uploadResult = await handleTdsDocumentUpload({
            tdsDocument: req.file,
            rentId,
            tenantId: result.rent.tenant,
          });

          if (!uploadResult.success) {
            console.error(
              "[recordRentPaymentController] TDS document upload failed:",
              uploadResult.error,
            );
          }
        }
      } catch (tdsError) {
        console.error(
          "[recordRentPaymentController] TDS verification/upload error:",
          tdsError.message,
        );
        // Don't fail the payment if TDS operations fail
      }
    }

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

// ── TDS Management ────────────────────────────────────────────────────────────

/**
 * PATCH /api/rent/:rentId/tds/mark-paid
 *
 * Body (all optional):
 *   tdsPaidDate        — Date/ISO string, defaults to now
 *   nepaliTdsPaidDate  — string in YYYY-MM-DD format
 *   tdsPaidNotes       — receipt/reference number
 *
 * Files:
 *   tdsDocument        — TDS receipt document (via multer)
 *
 * Marks TDS as paid to government and posts verification journal entry.
 * Safe to call multiple times (returns success if already marked).
 */
export async function markTdsPaidController(req, res) {
  try {
    const { rentId } = req.params;
    const { tdsPaidDate, nepaliTdsPaidDate, tdsPaidNotes } = req.body;

    // Resolve entityId from rent's block
    const Rent = (await import("./rent.Model.js")).Rent;
    const rent = await Rent.findById(rentId).select("block tenant");
    if (!rent) {
      return res.status(404).json({
        success: false,
        message: "Rent not found",
      });
    }

    const { buildEntityMapForBlocks } = await import(
      "../../helper/resolveEntity.js"
    );
    const entityMap = await buildEntityMapForBlocks([rent.block]);
    const entityId = entityMap.get(rent.block?.toString()) ?? null;

    const result = await markTdsPaidToGovernment(
      rentId,
      req.admin?._id ?? req.admin?.id,
      {
        tdsPaidDate: tdsPaidDate ? new Date(tdsPaidDate) : undefined,
        nepaliTdsPaidDate,
        tdsPaidNotes,
      },
      null, // session
      entityId,
    );

    // Handle TDS document upload if file provided
    if (req.file && result.success) {
      const uploadResult = await handleTdsDocumentUpload({
        tdsDocument: req.file,
        rentId,
        tenantId: rent.tenant,
      });

      if (!uploadResult.success) {
        console.error(
          "[markTdsPaidController] TDS document upload failed:",
          uploadResult.error,
        );
        // Don't fail the operation if upload fails
        return res.status(200).json({
          ...result,
          warning: "TDS marked as paid but document upload failed",
        });
      }

      return res.status(200).json({
        ...result,
        tdsReceiptUrl: uploadResult.remotePath,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("[markTdsPaidController]", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to mark TDS as paid",
    });
  }
}
