/**
 * electricity.controller.js — updated
 *
 * Changes vs original:
 *   1. updateElectricityReading: was setting `electricity.ratePerUnit` (a read-only
 *      virtual) — corrected to `electricity.ratePerUnitPaisa` (the actual field).
 *   2. createElectricityReading: guards on `totalAmountPaisa` (not `totalAmount`)
 *      before calling recordElectricityCharge — safe whether doc is lean or not.
 *   3. recordElectricityPayment: passes `amountPaisa` to the service
 *      (avoids double conversion rupees→paisa in the service layer).
 */

import { electricityService } from "./electricity.service.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";
import mongoose from "mongoose";

const VALID_METER_TYPES = ["unit", "common_area", "parking", "sub_meter"];

const groupReadingsByMeterType = (readings = []) => {
  const buckets = Object.fromEntries(
    VALID_METER_TYPES.map((type) => [
      type,
      { readings: [], totalAmount: 0, totalUnits: 0, count: 0 },
    ]),
  );

  for (const reading of readings) {
    const bucket = buckets[reading.meterType];
    if (!bucket) continue;

    bucket.readings.push(reading);
    bucket.totalAmount += reading.totalAmount ?? 0;
    bucket.totalUnits += reading.consumption ?? 0;
    bucket.count += 1;
  }

  return buckets;
};

// ── Controllers ───────────────────────────────────────────────────────────────

export const createElectricityReading = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      meterType = "unit",
      tenantId,
      unitId,
      subMeterId,
      propertyId,
      currentReading,
      nepaliMonth,
      nepaliYear,
      nepaliDate,
      englishMonth,
      englishYear,
      readingDate,
      notes,
      previousReading,
    } = req.body;

    if (!VALID_METER_TYPES.includes(meterType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Invalid meterType. Must be one of: ${VALID_METER_TYPES.join(", ")}`,
      });
    }

    if (!currentReading) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "currentReading is required" });
    }

    if (!nepaliMonth || !nepaliYear || !nepaliDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message:
          "Nepali date information is required (nepaliMonth, nepaliYear, nepaliDate)",
      });
    }

    if (meterType === "unit") {
      if (!unitId) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({
            success: false,
            message: "unitId is required for unit readings",
          });
      }
    } else {
      if (!subMeterId || !propertyId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `subMeterId and propertyId are required for ${meterType} readings`,
        });
      }
    }

    const result = await electricityService.createElectricityReading(
      {
        meterType,
        tenantId: meterType === "unit" ? tenantId : undefined,
        unitId: meterType === "unit" ? unitId : undefined,
        subMeterId: meterType !== "unit" ? subMeterId : undefined,
        propertyId: meterType !== "unit" ? propertyId : undefined,
        currentReading: parseFloat(currentReading),
        nepaliMonth: parseInt(nepaliMonth),
        nepaliYear: parseInt(nepaliYear),
        nepaliDate,
        englishMonth: parseInt(englishMonth),
        englishYear: parseInt(englishYear),
        readingDate: readingDate ? new Date(readingDate) : new Date(),
        notes,
        previousReading: previousReading
          ? parseFloat(previousReading)
          : undefined,
        createdBy: req.admin.id,
      },
      session,
    );

    // FIX: check totalAmountPaisa (integer field), not totalAmount (virtual)
    if (result.data.totalAmountPaisa > 0) {
      await electricityService.recordElectricityCharge(
        result.data._id,
        session,
      );
    }

    await session.commitTransaction();
    session.endSession();

    res
      .status(201)
      .json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating electricity reading:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to create electricity reading",
      });
  }
};

export const getElectricityReadings = async (req, res) => {
  try {
    const {
      tenantId,
      unitId,
      subMeterId,
      propertyId,
      blockId,
      innerBlockId,
      nepaliYear,
      nepaliMonth,
      status,
      startDate,
      endDate,
      meterType,
      billTo,
      searchQuery,
    } = req.query;

    if (meterType && !VALID_METER_TYPES.includes(meterType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid meterType. Must be one of: ${VALID_METER_TYPES.join(", ")}`,
      });
    }

    const result = await electricityService.getElectricityReadings({
      tenantId,
      unitId,
      subMeterId,
      propertyId,
      blockId: blockId || undefined,
      innerBlockId: innerBlockId || undefined,
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      nepaliMonth: nepaliMonth ? parseInt(nepaliMonth) : undefined,
      status,
      startDate,
      endDate,
      meterType,
      billTo,
      searchQuery: searchQuery?.trim() || undefined,
    });

    const readings = result.data?.readings ?? [];

    if (!meterType) {
      const grouped = groupReadingsByMeterType(readings);
      const grandTotalAmount = readings.reduce(
        (sum, r) => sum + (r.totalAmount ?? 0),
        0,
      );
      const grandTotalUnits = readings.reduce(
        (sum, r) => sum + (r.consumption ?? 0),
        0,
      );

      return res.status(200).json({
        success: true,
        data: {
          grouped,
          summary: {
            totalReadings: readings.length,
            grandTotalAmount,
            grandTotalUnits,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { meterType, readings, summary: result.data?.summary ?? {} },
    });
  } catch (error) {
    console.error("Error getting electricity readings:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to get electricity readings",
      });
  }
};

export const getElectricityReadingById = async (req, res) => {
  try {
    const { id } = req.params;
    const reading = await electricityService.getElectricityReadings({
      _id: id,
    });

    if (!reading.data.readings || reading.data.readings.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Electricity reading not found" });
    }

    res.status(200).json({ success: true, data: reading.data.readings[0] });
  } catch (error) {
    console.error("Error getting electricity reading:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to get electricity reading",
      });
  }
};

export const recordElectricityPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      electricityId,
      amount,
      paymentDate,
      nepaliDate,
      paymentMethod,
      bankAccountId,
    } = req.body;

    if (!electricityId || !amount) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({
          success: false,
          message: "electricityId and amount are required",
        });
    }

    let receiptImageUrl = null;

    if (req.file) {
      const cloudinary = (await import("cloudinary")).v2;
      const fs = (await import("fs")).default;
      const path = (await import("path")).default;

      const tempDir = path.join(process.cwd(), "tmp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const tempPath = path.join(tempDir, req.file.originalname);
      fs.writeFileSync(tempPath, req.file.buffer);

      try {
        const uploadResult = await cloudinary.uploader.upload(tempPath, {
          folder: "electricity/receipts",
          transformation: [{ width: 1000, height: 1000, crop: "limit" }],
          use_filename: true,
          unique_filename: true,
        });
        receiptImageUrl = uploadResult.secure_url;
        fs.unlinkSync(tempPath);
      } catch (uploadError) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw new Error(
          `Failed to upload receipt image: ${uploadError.message}`,
        );
      }
    }

    const result = await electricityService.recordElectricityPayment(
      {
        electricityId,
        // Pass as paisa directly to avoid double-conversion in the service
        amountPaisa: rupeesToPaisa(parseFloat(amount)),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        nepaliDate,
        paymentMethod: paymentMethod || undefined,
        bankAccountId: bankAccountId || undefined,
        receipt: receiptImageUrl,
        createdBy: req.admin.id,
      },
      session,
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json(result);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error recording electricity payment:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to record electricity payment",
      });
  }
};

export const getUnitConsumptionHistory = async (req, res) => {
  try {
    const { unitId } = req.params;
    const { limit } = req.query;

    const result = await electricityService.getUnitConsumptionHistory(
      unitId,
      limit ? parseInt(limit) : 12,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting unit consumption history:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to get unit consumption history",
      });
  }
};

export const getTenantElectricitySummary = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { nepaliYear } = req.query;

    const result = await electricityService.getElectricityReadings({
      tenantId,
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
    });

    res.status(200).json({
      success: true,
      data: { readings: result.data.readings, summary: result.data.summary },
    });
  } catch (error) {
    console.error("Error getting tenant electricity summary:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to get tenant electricity summary",
      });
  }
};

/**
 * Update electricity reading.
 * PUT /api/electricity/update-reading/:id
 *
 * FIX: was setting `electricity.ratePerUnit` (read-only virtual — has no effect).
 * Corrected to `electricity.ratePerUnitPaisa` (the actual stored field).
 */
export const updateElectricityReading = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { currentReading, ratePerUnit, notes, status } = req.body;

    const { Electricity } = await import("./Electricity.Model.js");
    const electricity = await Electricity.findById(id).session(session);

    if (!electricity) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Electricity reading not found" });
    }

    if (currentReading !== undefined) {
      if (parseFloat(currentReading) < electricity.previousReading) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Current reading cannot be less than previous reading",
        });
      }
      electricity.currentReading = parseFloat(currentReading);
    }

    // FIX: must set the paisa field, not the rupee virtual
    if (ratePerUnit !== undefined) {
      electricity.ratePerUnitPaisa = rupeesToPaisa(parseFloat(ratePerUnit));
    }

    if (notes !== undefined) electricity.notes = notes;
    if (status !== undefined) electricity.status = status;

    await electricity.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Electricity reading updated successfully",
      data: electricity.toObject({ virtuals: true }),
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating electricity reading:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to update electricity reading",
      });
  }
};

export const deleteElectricityReading = async (req, res) => {
  try {
    const { id } = req.params;

    const { Electricity } = await import("./Electricity.Model.js");
    const electricity = await Electricity.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { returnDocument: "after" },
    );

    if (!electricity) {
      return res
        .status(404)
        .json({ success: false, message: "Electricity reading not found" });
    }

    res.status(200).json({
      success: true,
      message: "Electricity reading cancelled successfully",
      data: electricity,
    });
  } catch (error) {
    console.error("Error deleting electricity reading:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to delete electricity reading",
      });
  }
};
