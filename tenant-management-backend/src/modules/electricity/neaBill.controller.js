/**
 * neaBill.controller.js
 *
 * Handles upload and retrieval of the monthly NEA utility bill.
 * PDF upload is optional — manual entry without PDF is supported.
 *
 * Routes:
 *   POST /api/electricity/nea-bill/:propertyId/parse  — parse-only, no DB write
 *   POST /api/electricity/nea-bill/:propertyId        — create/update NEA bill (multipart, PDF optional)
 *   GET  /api/electricity/nea-bill/:propertyId        — list all NEA bills + reconciliation
 *
 * Reconciliation (two dimensions):
 *   Cost:  totalAmountPaisa vs  sum(Electricity.neaCostPaisa)  — rupee shortfall/surplus
 *   Units: totalUnits       vs  sum(Electricity.consumption for unit readings) — kWh loss/surplus
 *          Loss = purchased - metered (possible reasons: common area, leakage, meter mismatch)
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { NeaBill } from "./NeaBill.Model.js";
import { Electricity } from "./Electricity.Model.js";
import ftpClient from "../../config/ftpClient.js";
import { rupeesToPaisa, paisaToRupees } from "../../utils/moneyUtil.js";
import { parseNeaBill } from "../../utils/parseNeaBill.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildElectricityDemandChargeJournal,
  buildNeaBillEnergyCostJournal,
  buildNeaBillPaymentJournal,
} from "../ledger/journal-builders/electricity.js";
import { applyDisbursementFromBank } from "../banks/bank.domain.js";

// Helper: resolve ownershipEntityId for a property via its first Block
async function resolveEntityForProperty(propertyId, session = null) {
  const { Block } = await import("../blocks/Block.Model.js");
  const block = await Block.findOne({ property: propertyId })
    .select("ownershipEntityId")
    .session(session)
    .lean();
  const raw = block?.ownershipEntityId ?? null;
  return raw?._id ?? raw ?? null;
}

const TEMP_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ─── Parse-only endpoint ──────────────────────────────────────────────────────

/**
 * POST /api/electricity/nea-bill/:propertyId/parse
 * Body: multipart — neaBillPdf (required)
 *
 * No DB writes. Returns extracted fields for frontend pre-fill.
 * Frontend calls this on file select; user reviews and confirms before saving.
 */
export const parseNeaBillPdf = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No PDF uploaded" });
  }

  try {
    const parsed = await parseNeaBill(req.file.buffer);

    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error("[NEA parse]", err.message);
    // 422 Unprocessable — file was received but couldn't be parsed.
    // Do NOT 500 here; it's not a server fault, it's a bad/unreadable PDF.
    return res.status(422).json({
      success: false,
      message: "Could not extract data from this PDF — please fill fields manually.",
    });
  }
};

// ─── Upload / create NEA bill ─────────────────────────────────────────────────

/**
 * POST /api/electricity/nea-bill/:propertyId
 * Body (multipart, all text fields + optional PDF):
 *   totalAmount       — total NEA charge (rupees, required unless PDF auto-parsed)
 *   nepaliMonth       — 1–12 (required unless PDF auto-parsed)
 *   nepaliYear        — (required unless PDF auto-parsed)
 *   totalUnits?       — total kWh purchased from NEA
 *   demandCharge?     — demand charge component (rupees)
 *   energyCharge?     — energy charge component (rupees)
 *   billDate?         — date on the NEA bill (ISO string)
 *   status?           — 'draft' | 'finalized' | 'paid' (default: 'finalized')
 *   notes?
 *   neaBillPdf?       — PDF file (optional)
 *
 * Auto-parse fallback: if a PDF is attached but a required field is missing,
 * the controller attempts to extract it from the PDF before rejecting the request.
 */
export const uploadNeaBill = async (req, res) => {
  try {
    const { propertyId } = req.params;

    let {
      totalAmount, nepaliMonth, nepaliYear,
      totalUnits, demandCharge, energyCharge, billDate,
      status, notes,
    } = req.body;

    // ── Auto-parse fallback ───────────────────────────────────────────────────
    // If required fields are absent but a PDF was uploaded, try to extract them.
    // This handles the edge case where the frontend skipped auto-parse
    // (e.g. user uploaded PDF and clicked Save immediately without waiting).
    const missingRequired = !totalAmount || !nepaliMonth || !nepaliYear;

    if (missingRequired && req.file) {
      try {
        const parsed = await parseNeaBill(req.file.buffer);

        // Only fill what's missing — never overwrite an explicit value sent by the client
        if (!totalAmount  && parsed.totalAmount  != null) totalAmount  = String(parsed.totalAmount);
        if (!nepaliMonth  && parsed.nepaliMonth  != null) nepaliMonth  = String(parsed.nepaliMonth);
        if (!nepaliYear   && parsed.nepaliYear   != null) nepaliYear   = String(parsed.nepaliYear);
        if (!totalUnits   && parsed.totalUnits   != null) totalUnits   = String(parsed.totalUnits);
        if (!demandCharge && parsed.demandCharge != null) demandCharge = String(parsed.demandCharge);
        if (!energyCharge && parsed.energyCharge != null) energyCharge = String(parsed.energyCharge);
      } catch (parseErr) {
        // Parse failure is non-fatal — validation below will catch still-missing fields
        console.warn("[NEA upload] PDF auto-parse fallback failed:", parseErr.message);
      }
    }

    // ── Validation ────────────────────────────────────────────────────────────
    if (!totalAmount || !nepaliMonth || !nepaliYear) {
      return res.status(400).json({
        success: false,
        message: "totalAmount, nepaliMonth, and nepaliYear are required",
      });
    }

    const monthNum         = parseInt(nepaliMonth, 10);
    const yearNum          = parseInt(nepaliYear,  10);
    const totalAmountPaisa = rupeesToPaisa(parseFloat(totalAmount));

    const demandChargePaisa       = demandCharge  ? rupeesToPaisa(parseFloat(demandCharge))  : null;
    const energyChargeAmountPaisa = energyCharge  ? rupeesToPaisa(parseFloat(energyCharge))  : null;
    const totalUnitsNum           = totalUnits    ? parseFloat(totalUnits)                    : null;
    const billDateParsed          = billDate      ? new Date(billDate)                        : null;

    // ── Optional PDF upload to FTP ────────────────────────────────────────────
    let ftpPath = null;
    if (req.file) {
      const filename   = `nea-bill-${yearNum}-${monthNum}.pdf`;
      const remotePath = `/electricity/nea-bills/${propertyId}/${filename}`;
      const tempPath   = path.join(TEMP_DIR, `nea-${propertyId}-${Date.now()}.pdf`);

      fs.writeFileSync(tempPath, req.file.buffer);
      try {
        const ok = await ftpClient.upload(tempPath, remotePath);
        if (!ok) throw new Error("FTP upload failed — check FTP credentials/connection");
        ftpPath = remotePath;
      } finally {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
      }
    }

    // Build update payload — only set ftpPath if a new file was uploaded
    const updatePayload = {
      totalAmountPaisa,
      demandChargePaisa,
      energyChargeAmountPaisa,
      totalUnits: totalUnitsNum,
      billDate: billDateParsed,
      status: status ?? "finalized",
      uploadedBy: req.admin?.id ?? null,
      notes: notes?.trim() ?? "",
    };
    if (ftpPath) updatePayload.ftpPath = ftpPath;

    // Upsert (one bill per property per month)
    const neaBill = await NeaBill.findOneAndUpdate(
      { property: propertyId, nepaliMonth: monthNum, nepaliYear: yearNum },
      updatePayload,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // ── Post NEA cost journals ─────────────────────────────────────────────────
    // Both journals are idempotent: ledgerService guards on (entityId, type, referenceType, referenceId).
    // Re-uploading the same bill (same neaBill._id) will not double-post.
    const entityId = await resolveEntityForProperty(propertyId);
    const billDoc = { ...neaBill.toObject(), uploadedBy: neaBill.uploadedBy ?? req.admin?.id };

    // 1. Energy cost: DR Electricity Expense NEA (5610) | CR NEA Payable (2050)
    //    Amount = totalAmountPaisa − demandChargePaisa
    //    This is the actual per-kWh cost from the real NEA bill — NOT estimated per reading.
    const energyChargePaisa = neaBill.totalAmountPaisa - (neaBill.demandChargePaisa ?? 0);
    if (energyChargePaisa > 0) {
      try {
        const energyPayload = buildNeaBillEnergyCostJournal(billDoc, entityId);
        await ledgerService.postJournalEntry(energyPayload, null, entityId);
      } catch (journalErr) {
        if (!journalErr.message?.includes("already exists")) {
          console.error("[NEA energy cost journal]", journalErr.message);
        }
      }
    }

    // 2. Demand charge: DR Electricity Demand Charge Expense (5616) | CR NEA Payable (2050)
    if (neaBill.demandChargePaisa && neaBill.demandChargePaisa > 0) {
      try {
        const demandPayload = buildElectricityDemandChargeJournal(billDoc, entityId);
        await ledgerService.postJournalEntry(demandPayload, null, entityId);
      } catch (journalErr) {
        if (!journalErr.message?.includes("already exists")) {
          console.error("[NEA demand charge journal]", journalErr.message);
        }
      }
    }

    // ── Reconciliation aggregation (cost + units) ─────────────────────────────
    const aggResult = await Electricity.aggregate([
      {
        $match: {
          property: new mongoose.Types.ObjectId(propertyId),
          nepaliMonth: monthNum,
          nepaliYear: yearNum,
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$meterType",
          systemNeaCostPaisa: { $sum: { $ifNull: ["$neaCostPaisa", 0] } },
          totalConsumption:   { $sum: "$consumption" },
        },
      },
    ]);

    let systemNeaCostPaisa = 0;
    let meteredUnitUnits   = 0;

    for (const row of aggResult) {
      systemNeaCostPaisa += row.systemNeaCostPaisa;
      if (row._id === "unit") meteredUnitUnits += row.totalConsumption;
    }

    const costDifferencePaisa = totalAmountPaisa - systemNeaCostPaisa;
    const unitLoss = totalUnitsNum != null ? totalUnitsNum - meteredUnitUnits : null;
    const lossPercent = totalUnitsNum && totalUnitsNum > 0
      ? ((unitLoss / totalUnitsNum) * 100).toFixed(1)
      : null;

    return res.status(200).json({
      success: true,
      message: "NEA bill saved successfully",
      data: {
        neaBill: neaBill.toObject({ virtuals: true }),
        reconciliation: {
          neaBillTotal:      paisaToRupees(totalAmountPaisa),
          demandCharge:      demandChargePaisa != null ? paisaToRupees(demandChargePaisa) : null,
          systemNeaCost:     paisaToRupees(systemNeaCostPaisa),
          costDifference:    paisaToRupees(costDifferencePaisa),
          surplus:           costDifferencePaisa < 0,
          shortfall:         costDifferencePaisa > 0,
          purchasedUnits:    totalUnitsNum,
          meteredUnitUnits,
          unitLoss,
          lossPercent: lossPercent != null ? parseFloat(lossPercent) : null,
          unitSurplus:       unitLoss != null && unitLoss < 0,
        },
      },
    });
  } catch (error) {
    console.error("Error saving NEA bill:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `A NEA bill for ${req.body.nepaliMonth}/${req.body.nepaliYear} already exists. Re-uploading will overwrite it — delete first if needed.`,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save NEA bill",
    });
  }
};

// ─── Pay NEA bill ─────────────────────────────────────────────────────────────

/**
 * POST /api/electricity/nea-bill/:propertyId/:billId/pay
 * Body:
 *   paymentMethod  — cash | bank_transfer | cheque | mobile_wallet (required)
 *   bankAccountId  — required for bank_transfer / cheque
 *   bankAccountCode — bank account ledger code (e.g. "1010-NABIL")
 *   paymentDate    — ISO date string (optional, defaults to now)
 *   nepaliDate     — e.g. "2082-02-15" (optional)
 *   notes?
 *
 * Journal posted:
 *   DR  NEA Payable (2050)     totalAmountPaisa   ← clears liability
 *   CR  Cash / Bank            totalAmountPaisa   ← money exits
 */
export const payNeaBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { propertyId, billId } = req.params;
    const {
      paymentMethod,
      bankAccountId,
      bankAccountCode,
      paymentDate,
      nepaliDate,
      notes,
    } = req.body;

    if (!paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "paymentMethod is required" });
    }

    const neaBill = await NeaBill.findOne({ _id: billId, property: propertyId }).session(session);
    if (!neaBill) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "NEA bill not found" });
    }

    if (neaBill.status === "paid") {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, message: "NEA bill is already marked as paid" });
    }

    const entityId = await resolveEntityForProperty(propertyId, session);

    const paymentData = {
      paymentMethod,
      bankAccountId,
      bankAccountCode,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      nepaliDate,
      createdBy: req.admin?.id,
      notes: notes?.trim() ?? "",
    };

    // Post journal: DR NEA Payable | CR Cash/Bank
    const journalPayload = buildNeaBillPaymentJournal(neaBill, paymentData, entityId);
    const { transaction } = await ledgerService.postJournalEntry(
      journalPayload,
      session,
      entityId,
    );

    // Update bank balance — money exits (outflow to NEA)
    if (paymentMethod !== "cash" && bankAccountId) {
      await applyDisbursementFromBank({
        paymentMethod,
        bankAccountId,
        amountPaisa: neaBill.totalAmountPaisa,
        session,
      });
    }

    // Mark bill as paid
    neaBill.status = "paid";
    await neaBill.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "NEA bill payment recorded",
      data: {
        neaBill: neaBill.toObject({ virtuals: true }),
        transactionId: transaction._id,
        amountPaid: paisaToRupees(neaBill.totalAmountPaisa),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error paying NEA bill:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record NEA bill payment",
    });
  }
};

// ─── List NEA bills ───────────────────────────────────────────────────────────

/**
 * GET /api/electricity/nea-bill/:propertyId
 * Returns all NEA bills for a property with monthly reconciliation data.
 */
export const getNeaBills = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const bills = await NeaBill.find({ property: propertyId })
      .populate("uploadedBy", "name email")
      .sort({ nepaliYear: -1, nepaliMonth: -1 })
      .lean({ virtuals: true });

    if (!bills.length) {
      return res.status(200).json({ success: true, data: { bills: [], total: 0 } });
    }

    const monthKeys = bills.map((b) => ({
      nepaliMonth: b.nepaliMonth,
      nepaliYear:  b.nepaliYear,
    }));

    const aggResult = await Electricity.aggregate([
      {
        $match: {
          property: new mongoose.Types.ObjectId(propertyId),
          status:   { $ne: "cancelled" },
          $or: monthKeys.map((k) => ({
            nepaliMonth: k.nepaliMonth,
            nepaliYear:  k.nepaliYear,
          })),
        },
      },
      {
        $group: {
          _id: { nepaliMonth: "$nepaliMonth", nepaliYear: "$nepaliYear", meterType: "$meterType" },
          systemNeaCostPaisa: { $sum: { $ifNull: ["$neaCostPaisa", 0] } },
          totalConsumption:   { $sum: "$consumption" },
        },
      },
    ]);

    const systemMap = {};
    for (const row of aggResult) {
      const key = `${row._id.nepaliYear}-${row._id.nepaliMonth}`;
      if (!systemMap[key]) systemMap[key] = { systemNeaCostPaisa: 0, meteredUnitUnits: 0 };
      systemMap[key].systemNeaCostPaisa += row.systemNeaCostPaisa;
      if (row._id.meterType === "unit") systemMap[key].meteredUnitUnits += row.totalConsumption;
    }

    const billsWithRecon = bills.map((bill) => {
      const key = `${bill.nepaliYear}-${bill.nepaliMonth}`;
      const { systemNeaCostPaisa = 0, meteredUnitUnits = 0 } = systemMap[key] ?? {};
      const costDifferencePaisa = bill.totalAmountPaisa - systemNeaCostPaisa;
      const unitLoss = bill.totalUnits != null ? bill.totalUnits - meteredUnitUnits : null;
      const lossPercent = bill.totalUnits && bill.totalUnits > 0
        ? parseFloat(((unitLoss / bill.totalUnits) * 100).toFixed(1))
        : null;
      return {
        ...bill,
        reconciliation: {
          neaBillTotal:   paisaToRupees(bill.totalAmountPaisa),
          demandCharge:   bill.demandChargePaisa != null ? paisaToRupees(bill.demandChargePaisa) : null,
          systemNeaCost:  paisaToRupees(systemNeaCostPaisa),
          costDifference: paisaToRupees(costDifferencePaisa),
          surplus:        costDifferencePaisa < 0,
          shortfall:      costDifferencePaisa > 0,
          purchasedUnits: bill.totalUnits,
          meteredUnitUnits,
          unitLoss,
          lossPercent,
          unitSurplus:    unitLoss != null && unitLoss < 0,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: { bills: billsWithRecon, total: billsWithRecon.length },
    });
  } catch (error) {
    console.error("Error fetching NEA bills:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch NEA bills",
    });
  }
};