import { Generator } from "./Generator.Model.js";
import { rupeesToPaisa } from "../../../utils/moneyUtil.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives auto-status from fuelPercent vs thresholds.
 * Does NOT override MAINTENANCE / FAULT / DECOMMISSIONED.
 */
function _autoCheckStatus(fuelPercent, low, critical) {
  if (fuelPercent <= critical) return "LOW_FUEL";
  if (fuelPercent <= low) return "LOW_FUEL";
  return "NORMAL";
}

// ─── Generator CRUD ───────────────────────────────────────────────────────────

export async function createGenerator(data, adminId) {
  try {
    const generator = await Generator.create({ ...data, createdBy: adminId });
    return { success: true, message: "Generator created", data: generator };
  } catch (error) {
    if (error.name === "ValidationError") {
      throw new Error(
        Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      );
    }
    throw new Error(error.message || "Failed to create generator");
  }
}

export async function getAllGenerators() {
  const generators = await Generator.find({ isActive: true })
    .populate("property", "name")
    .populate("block", "name")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });
  return { success: true, message: "Generators fetched", data: generators };
}

export async function getGeneratorById(id) {
  const generator = await Generator.findById(id)
    .populate("property", "name")
    .populate("block", "name")
    .populate("createdBy", "name email")
    .populate("fuelRefills.recordedBy", "name")
    .populate("dailyChecks.checkedBy", "name")
    .populate("serviceLogs.recordedBy", "name");

  if (!generator)
    return { success: false, message: "Generator not found", data: null };
  return { success: true, message: "Generator fetched", data: generator };
}

// ─── Daily Fuel Check ─────────────────────────────────────────────────────────

export async function recordDailyCheck(generatorId, checkData, adminId) {
  const generator = await Generator.findById(generatorId);
  if (!generator)
    return { success: false, message: "Generator not found", data: null };

  const { fuelPercent, runningHours, status, notes } = checkData;

  // Auto-derive check status if not explicitly provided
  const resolvedStatus =
    status ||
    _autoCheckStatus(
      fuelPercent,
      generator.lowFuelThresholdPercent,
      generator.criticalFuelThresholdPercent,
    );

  const entry = {
    date: new Date(),
    fuelPercent,
    runningHours,
    status: resolvedStatus,
    notes,
    checkedBy: adminId,
  };

  generator.dailyChecks.push(entry);
  generator.currentFuelPercent = fuelPercent;
  generator.lastCheckedAt = new Date();

  // Update generator-level status only when safe to do so
  if (!["MAINTENANCE", "FAULT", "DECOMMISSIONED"].includes(generator.status)) {
    if (resolvedStatus === "LOW_FUEL") {
      generator.status = "FAULT"; // triggers alert colour
    }
  }

  await generator.save();
  return { success: true, message: "Daily check recorded", data: generator };
}

// ─── Fuel Refill ──────────────────────────────────────────────────────────────

export async function recordFuelRefill(generatorId, refillData, adminId) {
  const generator = await Generator.findById(generatorId);
  if (!generator)
    return { success: false, message: "Generator not found", data: null };

  const {
    litersAdded,
    cost,
    fuelLevelAfterPercent,
    supplier,
    invoiceRef,
    notes,
  } = refillData;

  const costPaisa = cost ? rupeesToPaisa(cost) : 0;

  generator.fuelRefills.push({
    date: new Date(),
    litersAdded,
    costPaisa,
    fuelLevelAfterPercent,
    supplier,
    invoiceRef,
    notes,
    recordedBy: adminId,
  });

  // Update live snapshot if after-level is provided
  if (fuelLevelAfterPercent !== undefined) {
    generator.currentFuelPercent = fuelLevelAfterPercent;
    generator.lastCheckedAt = new Date();
    // Clear fault status if fuel is now sufficient
    if (
      fuelLevelAfterPercent > generator.lowFuelThresholdPercent &&
      generator.status === "FAULT"
    ) {
      generator.status = "IDLE";
    }
  }

  await generator.save();
  return { success: true, message: "Fuel refill recorded", data: generator };
}

// ─── Service Log ──────────────────────────────────────────────────────────────

export async function recordServiceLog(generatorId, serviceData, adminId) {
  const generator = await Generator.findById(generatorId);
  if (!generator)
    return { success: false, message: "Generator not found", data: null };

  const {
    type,
    description,
    cost,
    technician,
    nextServiceDate,
    nextServiceHours,
    notes,
  } = serviceData;

  const costPaisa = cost ? rupeesToPaisa(cost) : 0;

  generator.serviceLogs.push({
    date: new Date(),
    type,
    description,
    costPaisa,
    technician,
    nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : undefined,
    nextServiceHours,
    notes,
    recordedBy: adminId,
  });

  // Update next service schedule on generator
  if (nextServiceDate) generator.nextServiceDate = new Date(nextServiceDate);
  if (nextServiceHours) generator.nextServiceHours = nextServiceHours;

  // When service is done, reset status from MAINTENANCE → IDLE
  if (generator.status === "MAINTENANCE") {
    generator.status = "IDLE";
  }

  await generator.save();
  return { success: true, message: "Service log recorded", data: generator };
}

// ─── Update Generator Status ──────────────────────────────────────────────────

export async function updateGeneratorStatus(generatorId, status) {
  const generator = await Generator.findByIdAndUpdate(
    generatorId,
    { $set: { status } },
    { new: true },
  );
  if (!generator)
    return { success: false, message: "Generator not found", data: null };
  return { success: true, message: "Status updated", data: generator };
}
