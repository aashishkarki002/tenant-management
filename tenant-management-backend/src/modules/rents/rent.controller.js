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

import mongoose from "mongoose";
import {
  getRentsService,
  getRentByIdService,
  updateRentService,
  handleMonthlyRents,
  sendEmailToTenants,
  markTdsPaidToGovernment,
  backfillTenantRents,
} from "./rent.service.js";
import {
  recordRentPayment,
  recordUnitRentPayment,
} from "./rent.payment.service.js";
import { handleTdsDocumentUpload } from "./rent.tds.service.js";
import { generateTdsCertificate } from "../../utils/tdsCertificateGenerator.js";
import { generateRentRollPDF } from "../../utils/rentRollPdfGenerator.js";

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
      nepaliMonthStart: req.query.nepaliMonthStart,
      nepaliMonthEnd: req.query.nepaliMonthEnd,
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
    // tdsPaidToGovt may arrive as boolean true (JSON body) or string "true" (form data)
    const tdsPaidToGovtFlag = tdsPaidToGovt === true || tdsPaidToGovt === "true";
    if (result.success && tdsPaidToGovtFlag && result.rent) {
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

// ── Admin backfill ────────────────────────────────────────────────────────────

/**
 * POST /api/rent/backfill-tenant-rents
 *
 * Body:
 *   tenantId  {string}   required — MongoDB ObjectId
 *   months    {Array}    required — [{ nepaliYear: number, nepaliMonth: number }]
 *                         nepaliMonth is 1-based (1=Baisakh … 12=Chaitra)
 */
export async function backfillTenantRentsController(req, res) {
  try {
    const { tenantId, months } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: "tenantId is required" });
    }
    if (!Array.isArray(months) || !months.length) {
      return res.status(400).json({ success: false, message: "months must be a non-empty array" });
    }
    for (const m of months) {
      if (!Number.isInteger(m.nepaliYear) || !Number.isInteger(m.nepaliMonth) ||
          m.nepaliMonth < 1 || m.nepaliMonth > 12) {
        return res.status(400).json({
          success: false,
          message: "Each month entry must have integer nepaliYear and nepaliMonth (1-12)",
        });
      }
    }

    const result = await backfillTenantRents(tenantId, months, req.admin?._id ?? req.admin?.id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("[backfillTenantRentsController]", error.message);
    return res.status(500).json({ success: false, message: "Backfill failed", error: error.message });
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

/**
 * POST /api/rent/tds/batch-mark-paid
 *
 * Body: { rentIds: string[], tdsPaidDate: string, nepaliTdsPaidDate?: string, tdsPaidNotes?: string }
 *
 * Marks multiple rents' TDS as paid in a single atomic transaction.
 * Rolls back all changes if any individual mark fails (other than skip-eligible).
 */
export async function batchMarkTdsPaidController(req, res) {
  const { rentIds, tdsPaidDate, nepaliTdsPaidDate, tdsPaidNotes } = req.body;

  if (!Array.isArray(rentIds) || rentIds.length === 0) {
    return res.status(400).json({ success: false, message: "rentIds must be a non-empty array" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { Rent } = await import("./rent.Model.js");
    const { buildEntityMapForBlocks } = await import("../../helper/resolveEntity.js");

    // Resolve all blocks up-front for entity map
    const rents = await Rent.find({ _id: { $in: rentIds } }).select("block tenant").session(session);
    const blockIds = [...new Set(rents.map((r) => r.block?.toString()).filter(Boolean))];
    const entityMap = await buildEntityMapForBlocks(blockIds);

    const adminId = req.admin?._id ?? req.admin?.id;
    const data = {
      tdsPaidDate: tdsPaidDate ? new Date(tdsPaidDate) : undefined,
      nepaliTdsPaidDate,
      tdsPaidNotes,
    };

    const results = { success: 0, skipped: 0 };

    for (const rentId of rentIds) {
      const rent = rents.find((r) => r._id.toString() === rentId);
      const entityId = rent ? (entityMap.get(rent.block?.toString()) ?? null) : null;
      const result = await markTdsPaidToGovernment(rentId, adminId, data, session, entityId);
      if (result.skipped) results.skipped++;
      else results.success++;
    }

    await session.commitTransaction();
    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    await session.abortTransaction();
    console.error("[batchMarkTdsPaidController]", error.message);
    return res.status(500).json({ success: false, message: error.message || "Batch TDS mark-paid failed" });
  } finally {
    session.endSession();
  }
}

/**
 * POST /api/rent/:rentId/tds/upload-document
 *
 * Files:
 *   tdsDocument — required TDS receipt document (via multer)
 *
 * Uploads the TDS document and stores its FTP path on rent.tdsReceiptUrl.
 */
export async function uploadTdsDocumentController(req, res) {
  try {
    const { rentId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No TDS document uploaded",
      });
    }

    const Rent = (await import("./rent.Model.js")).Rent;
    const rent = await Rent.findById(rentId).select("tenant");
    if (!rent) {
      return res.status(404).json({
        success: false,
        message: "Rent not found",
      });
    }

    const uploadResult = await handleTdsDocumentUpload({
      tdsDocument: req.file,
      rentId,
      tenantId: rent.tenant,
    });

    if (!uploadResult.success) {
      return res.status(400).json({
        success: false,
        message: uploadResult.error || "TDS document upload failed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "TDS document uploaded successfully",
      data: {
        rentId,
        tdsReceiptUrl: uploadResult.remotePath,
      },
    });
  } catch (error) {
    console.error("[uploadTdsDocumentController]", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload TDS document",
    });
  }
}

/**
 * GET /api/rent/tds/certificate/:tenantId?nepaliYear=2081
 *
 * Generates a TDS deduction certificate PDF for a tenant for the given Nepali year.
 * Streams the PDF directly to the client as a download.
 */
export async function generateTdsCertificateController(req, res) {
  try {
    const { tenantId } = req.params;
    const { nepaliYear } = req.query;

    if (!nepaliYear) {
      return res.status(400).json({ success: false, message: "nepaliYear query param is required" });
    }

    const Rent = (await import("./rent.Model.js")).Rent;
    const Tenant = (await import("../tenant/Tenant.Model.js")).Tenant;

    const tenant = await Tenant.findById(tenantId).select("name address panNumber").lean();
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    const rents = await Rent.find({
      tenant: tenantId,
      nepaliYear: Number(nepaliYear),
      tdsAmountPaisa: { $gt: 0 },
    })
      .select("nepaliYear nepaliMonth grossRentAmountPaisa tdsAmountPaisa tdsRecordedInLedger tdsPaidToGovernment")
      .lean();

    if (!rents.length) {
      return res.status(404).json({
        success: false,
        message: `No TDS records found for tenant in year ${nepaliYear}`,
      });
    }

    const pdfBuffer = await generateTdsCertificate({ tenant, rents, nepaliYear });

    const filename = `TDS-Certificate-${tenant.name.replace(/\s+/g, "-")}-${nepaliYear}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("[generateTdsCertificateController]", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate TDS certificate",
      error: error.message,
    });
  }
}

/**
 * GET /api/rent/export/pdf?nepaliMonth=1&nepaliYear=2081&propertyId=...
 *
 * Generates a rent roll PDF for the given period and streams it to the client.
 */
export async function exportRentRollPdfController(req, res) {
  try {
    const { nepaliMonth, nepaliYear, propertyId } = req.query;

    if (!nepaliYear) {
      return res.status(400).json({ success: false, message: "nepaliYear is required" });
    }

    const filter = { nepaliYear: Number(nepaliYear) };
    if (nepaliMonth) filter.nepaliMonth = Number(nepaliMonth);

    const Rent = (await import("./rent.Model.js")).Rent;
    let query = Rent.find(filter)
      .populate("tenant", "name")
      .populate("block", "name")
      .populate("innerBlock", "name")
      .sort({ "tenant.name": 1, nepaliMonth: 1 })
      .lean();

    const rents = await query;

    // Filter by property if requested (block belongs to property)
    const filteredRents = propertyId
      ? rents.filter((r) => r.block?.property?.toString() === propertyId)
      : rents;

    if (!filteredRents.length) {
      return res.status(404).json({ success: false, message: "No rent records found for this period" });
    }

    const period = { nepaliMonth: nepaliMonth ? Number(nepaliMonth) : null, nepaliYear: Number(nepaliYear) };
    const pdfBuffer = await generateRentRollPDF(filteredRents, period);

    const filename = nepaliMonth
      ? `Rent-Roll-${nepaliYear}-Month${nepaliMonth}.pdf`
      : `Rent-Roll-${nepaliYear}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("[exportRentRollPdfController]", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate rent roll PDF",
      error: error.message,
    });
  }
}
