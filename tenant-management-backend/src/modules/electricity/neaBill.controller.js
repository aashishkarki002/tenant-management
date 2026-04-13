/**
 * neaBill.controller.js
 *
 * Handles upload and retrieval of the monthly NEA utility bill PDF.
 *
 * Routes:
 *   POST /api/electricity/nea-bill/:propertyId   — upload NEA bill PDF (multipart)
 *   GET  /api/electricity/nea-bill/:propertyId   — list all NEA bills + reconciliation
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

// ─── Upload NEA bill ──────────────────────────────────────────────────────────

/**
 * POST /api/electricity/nea-bill/:propertyId
 * Body (multipart):
 *   neaBillPdf   — PDF file
 *   totalAmount  — NEA charge in rupees
 *   nepaliMonth  — 1–12
 *   nepaliYear
 *   notes?
 */
export const uploadNeaBill = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { totalAmount, nepaliMonth, nepaliYear, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "neaBillPdf file is required" });
    }
    if (!totalAmount || !nepaliMonth || !nepaliYear) {
      return res.status(400).json({
        success: false,
        message: "totalAmount, nepaliMonth, and nepaliYear are required",
      });
    }

    const monthNum = parseInt(nepaliMonth, 10);
    const yearNum  = parseInt(nepaliYear,  10);
    const totalAmountPaisa = rupeesToPaisa(parseFloat(totalAmount));

    // Build remote FTP path
    const filename   = `nea-bill-${yearNum}-${monthNum}.pdf`;
    const remotePath = `/electricity/nea-bills/${propertyId}/${filename}`;
    const tempPath   = path.join(TEMP_DIR, `nea-${propertyId}-${Date.now()}.pdf`);

    // Write buffer to temp file
    fs.writeFileSync(tempPath, req.file.buffer);

    try {
      const success = await ftpClient.upload(tempPath, remotePath);
      if (!success) throw new Error("FTP upload failed — check FTP credentials/connection");
    } finally {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
    }

    // Upsert (one bill per property per month)
    const neaBill = await NeaBill.findOneAndUpdate(
      { property: propertyId, nepaliMonth: monthNum, nepaliYear: yearNum },
      {
        ftpPath: remotePath,
        totalAmountPaisa,
        uploadedBy: req.admin?.id ?? null,
        notes: notes?.trim() ?? "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Reconciliation: sum neaCostPaisa for this property/month from all readings
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
          _id: null,
          systemNeaCostPaisa: { $sum: { $ifNull: ["$neaCostPaisa", 0] } },
        },
      },
    ]);

    const systemNeaCostPaisa = aggResult[0]?.systemNeaCostPaisa ?? 0;
    const differencePaisa    = totalAmountPaisa - systemNeaCostPaisa;

    return res.status(200).json({
      success: true,
      message: "NEA bill uploaded successfully",
      data: {
        neaBill: neaBill.toObject({ virtuals: true }),
        reconciliation: {
          neaBillTotal:    paisaToRupees(totalAmountPaisa),
          systemNeaCost:   paisaToRupees(systemNeaCostPaisa),
          difference:      paisaToRupees(differencePaisa),
          surplus:         differencePaisa < 0,  // you charged tenants more than NEA billed
          shortfall:       differencePaisa > 0,  // NEA billed you more than you collected
        },
      },
    });
  } catch (error) {
    console.error("Error uploading NEA bill:", error);
    // Handle duplicate key gracefully
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `A NEA bill for ${req.body.nepaliMonth}/${req.body.nepaliYear} already exists. Re-uploading will overwrite it — this was prevented. Delete first if needed.`,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload NEA bill",
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
          _id: { nepaliMonth: "$nepaliMonth", nepaliYear: "$nepaliYear" },
          systemNeaCostPaisa: { $sum: { $ifNull: ["$neaCostPaisa", 0] } },
        },
      },
    ]);

    const systemMap = {};
    for (const row of aggResult) {
      systemMap[`${row._id.nepaliYear}-${row._id.nepaliMonth}`] = row.systemNeaCostPaisa;
    }

    const billsWithRecon = bills.map((bill) => {
      const key = `${bill.nepaliYear}-${bill.nepaliMonth}`;
      const systemNeaCostPaisa = systemMap[key] ?? 0;
      const differencePaisa    = bill.totalAmountPaisa - systemNeaCostPaisa;
      return {
        ...bill,
        reconciliation: {
          neaBillTotal:  paisaToRupees(bill.totalAmountPaisa),
          systemNeaCost: paisaToRupees(systemNeaCostPaisa),
          difference:    paisaToRupees(differencePaisa),
          surplus:       differencePaisa < 0,
          shortfall:     differencePaisa > 0,
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
