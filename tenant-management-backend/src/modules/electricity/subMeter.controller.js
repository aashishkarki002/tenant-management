/**
 * subMeter.controller.js
 *
 * REST endpoints for SubMeter configuration (the physical meters, not readings).
 * Mounted at /api/electricity/sub-meters
 *
 * Industry pattern: "resource controller" — one controller per domain entity,
 * thin layer that validates input then delegates to a service.
 */

import mongoose from "mongoose";
import { SubMeter, METER_TYPES } from "./SubMeter.Model.js";

const VALID_METER_TYPES = [
  METER_TYPES.COMMON_AREA,
  METER_TYPES.PARKING,
  METER_TYPES.SUB_METER,
];

/**
 * GET /api/electricity/sub-meters
 * Query: propertyId (required), meterType?, blockId?, innerBlockId?, activeOnly?
 *
 * Returns all sub-meters for a property, grouped/sorted by meterType.
 * Used by the frontend to populate tab badges and reading dialogs.
 */
export const getSubMeters = async (req, res) => {
  try {
    const { propertyId, meterType, blockId, innerBlockId, activeOnly } =
      req.query;

    if (!propertyId) {
      return res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
    }

    const filter = { property: propertyId };

    if (activeOnly !== "false") filter.isActive = true; // default: active only

    if (meterType) {
      if (!VALID_METER_TYPES.includes(meterType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid meterType. Must be one of: ${VALID_METER_TYPES.join(", ")}`,
        });
      }
      filter.meterType = meterType;
    }

    if (blockId) filter.block = blockId;
    if (innerBlockId) filter.innerBlock = innerBlockId;

    const subMeters = await SubMeter.find(filter)
      .populate("block", "name")
      .populate("innerBlock", "name")
      .sort({ meterType: 1, name: 1 }) // group by type then alpha
      .lean();

    // Attach virtual displayName manually (lean() strips virtuals)
    const enriched = subMeters.map((m) => ({
      ...m,
      displayName: `[${formatType(m.meterType)}] ${m.name}`,
    }));

    res.status(200).json({
      success: true,
      data: { subMeters: enriched, total: enriched.length },
    });
  } catch (error) {
    console.error("Error fetching sub-meters:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * POST /api/electricity/sub-meters
 * Body: { name, meterType, propertyId, blockId?, innerBlockId?,
 *          description?, meterSerialNumber?, installedOn? }
 */
export const createSubMeter = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      meterType,
      propertyId,
      blockId,
      innerBlockId,
      description,
      meterSerialNumber,
      installedOn,
    } = req.body;

    // Validation
    if (!name || !meterType || !propertyId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "name, meterType, and propertyId are required",
      });
    }

    if (!VALID_METER_TYPES.includes(meterType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `meterType must be one of: ${VALID_METER_TYPES.join(", ")}. Unit meters are not sub-meters.`,
      });
    }

    const [subMeter] = await SubMeter.create(
      [
        {
          name: name.trim(),
          meterType,
          property: propertyId,
          block: blockId || null,
          innerBlock: innerBlockId || null,
          description: description?.trim() || "",
          meterSerialNumber: meterSerialNumber?.trim() || "",
          installedOn: installedOn ? new Date(installedOn) : null,
          createdBy: req.admin.id,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: `Sub-meter "${subMeter.name}" created`,
      data: subMeter,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating sub-meter:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * PATCH /api/electricity/sub-meters/:id
 * Partial update — name, description, isActive, meterSerialNumber, locationLabel.
 * meterType is intentionally NOT patchable after creation (data integrity).
 */
export const updateSubMeter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, meterSerialNumber, locationLabel } =
      req.body;

    const allowedUpdates = {};
    if (name !== undefined) allowedUpdates.name = name.trim();
    if (description !== undefined)
      allowedUpdates.description = description.trim();
    if (isActive !== undefined) allowedUpdates.isActive = Boolean(isActive);
    if (meterSerialNumber !== undefined)
      allowedUpdates.meterSerialNumber = meterSerialNumber.trim();
    if (locationLabel !== undefined)
      allowedUpdates.locationLabel = locationLabel.trim();

    if (Object.keys(allowedUpdates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields to update" });
    }

    const subMeter = await SubMeter.findByIdAndUpdate(id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    if (!subMeter) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-meter not found" });
    }

    res.status(200).json({
      success: true,
      message: "Sub-meter updated",
      data: subMeter,
    });
  } catch (error) {
    console.error("Error updating sub-meter:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatType(meterType) {
  return (
    { common_area: "Common Area", parking: "Parking", sub_meter: "Sub-Meter" }[
      meterType
    ] ?? meterType
  );
}
