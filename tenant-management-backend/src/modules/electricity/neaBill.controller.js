/**
 * neaBill.controller.js
 *
 * Handles upload and retrieval of the monthly NEA utility bill.
 * PDF upload is optional — manual entry without PDF is supported.
 *
 * Routes:
 *   POST /api/electricity/nea-bill/:propertyId   — create/update NEA bill (multipart, PDF optional)
 *   GET  /api/electricity/nea-bill/:propertyId   — list all NEA bills + reconciliation
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

const TEMP_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ─── Upload / create NEA bill ─────────────────────────────────────────────────

/**
 * POST /api/electricity/nea-bill/:propertyId
 * Body (multipart, all text fields + optional PDF):
 *   totalAmount       — total NEA charge (rupees, required)
 *   nepaliMonth       — 1–12 (required)
 *   nepaliYear        — (required)
 *   totalUnits?       — total kWh purchased from NEA
 *   demandCharge?     — demand charge component (rupees)
 *   energyCharge?     — energy charge component (rupees)
 *   billDate?         — date on the NEA bill (ISO string)
 *   status?           — 'draft' | 'finalized' | 'paid' (default: 'finalized')
 *   notes?
 *   neaBillPdf?       — PDF file (optional)
 */
export const uploadNeaBill = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      totalAmount, nepaliMonth, nepaliYear,
      totalUnits, demandCharge, energyCharge, billDate,
      status, notes,
    } = req.body;

    if (!totalAmount || !nepaliMonth || !nepaliYear) {
      return res.status(400).json({
        success: false,
        message: "totalAmount, nepaliMonth, and nepaliYear are required",
      });
    }

    const monthNum         = parseInt(nepaliMonth, 10);
    const yearNum          = parseInt(nepaliYear,  10);
    const totalAmountPaisa = rupeesToPaisa(parseFloat(totalAmount));

    const demandChargePaisa        = demandCharge  ? rupeesToPaisa(parseFloat(demandCharge))  : null;
    const energyChargeAmountPaisa  = energyCharge  ? rupeesToPaisa(parseFloat(energyCharge))  : null;
    const totalUnitsNum            = totalUnits    ? parseFloat(totalUnits)                    : null;
    const billDateParsed           = billDate      ? new Date(billDate)                        : null;

    // Optional PDF upload to FTP
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
    let meteredUnitUnits   = 0; // kWh from unit (tenant) meters only

    for (const row of aggResult) {
      systemNeaCostPaisa += row.systemNeaCostPaisa;
      if (row._id === "unit") meteredUnitUnits += row.totalConsumption;
    }

    const costDifferencePaisa = totalAmountPaisa - systemNeaCostPaisa;

    // Unit loss = NEA purchased - tenant-metered (common area + leakage + unmetered usage)
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
          // Cost reconciliation
          neaBillTotal:      paisaToRupees(totalAmountPaisa),
          demandCharge:      demandChargePaisa != null ? paisaToRupees(demandChargePaisa) : null,
          systemNeaCost:     paisaToRupees(systemNeaCostPaisa),
          costDifference:    paisaToRupees(costDifferencePaisa),
          surplus:           costDifferencePaisa < 0,
          shortfall:         costDifferencePaisa > 0,
          // Unit reconciliation
          purchasedUnits:    totalUnitsNum,
          meteredUnitUnits,
          unitLoss,
          lossPercent: lossPercent != null ? parseFloat(lossPercent) : null,
          unitSurplus:  unitLoss != null && unitLoss < 0,
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

    // Bulk reconciliation: one aggregation for all months
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

    // Build map: "year-month" → { systemNeaCostPaisa, meteredUnitUnits }
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
          neaBillTotal:      paisaToRupees(bill.totalAmountPaisa),
          demandCharge:      bill.demandChargePaisa != null ? paisaToRupees(bill.demandChargePaisa) : null,
          systemNeaCost:     paisaToRupees(systemNeaCostPaisa),
          costDifference:    paisaToRupees(costDifferencePaisa),
          surplus:           costDifferencePaisa < 0,
          shortfall:         costDifferencePaisa > 0,
          purchasedUnits:    bill.totalUnits,
          meteredUnitUnits,
          unitLoss,
          lossPercent,
          unitSurplus:       unitLoss != null && unitLoss < 0,
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
