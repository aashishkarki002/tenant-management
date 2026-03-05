import mongoose from "mongoose";
import { Generator } from "./Generator.Model.js";
import { rupeesToPaisa } from "../../../utils/moneyUtil.js";
import { createExpense } from "../../expenses/expense.service.js";
import { SubMeter } from "../../electricity/SubMeter.Model.js";
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

/**
 * Resolves the ExpenseSource _id for a given category code.
 * We look up by `code` so the caller doesn't need to know ObjectIds.
 *
 * @param {string} code  - e.g. "MAINTENANCE" or "UTILITY"
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
async function _resolveExpenseSourceId(code, session = null) {
  const { default: ExpenseSource } =
    await import("../../expenses/ExpenseSource.Model.js");
  const src = await ExpenseSource.findOne({ code, isActive: true })
    .session(session)
    .lean();
  if (!src)
    throw new Error(
      `ExpenseSource with code "${code}" not found. ` +
        `Ensure seed data includes an active ExpenseSource for "${code}".`,
    );
  return src._id;
}

// ─── Generator CRUD ───────────────────────────────────────────────────────────

export async function createGenerator(data, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Create the generator ───────────────────────────────────────────────
    const [generator] = await Generator.create(
      [{ ...data, createdBy: adminId }],
      { session },
    );

    // ── 2. Auto-provision a SubMeter so grid consumption can be metered ───────
    // The SubMeter acts as the cost centre for electricity readings
    // (meterType: "sub_meter") billed to the property — never to a tenant.
    const [subMeter] = await SubMeter.create(
      [
        {
          name: `Generator – ${generator.name}`,
          meterType: "sub_meter",
          property: generator.property ?? null,
          block: generator.block ?? null,
          description: `Auto-created for generator: ${generator.name}${generator.model ? ` (${generator.model})` : ""}`,
          meterSerialNumber: generator.serialNumber ?? "",
          installedOn: new Date(),
          createdBy: adminId,
        },
      ],
      { session },
    );

    // ── 3. Link SubMeter back to the generator ────────────────────────────────
    generator.subMeter = subMeter._id;
    await generator.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: "Generator created and sub-meter provisioned",
      data: generator,
      subMeter,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

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
    .populate("subMeter", "name meterType isActive lastReading")
    .sort({ createdAt: -1 });
  return { success: true, message: "Generators fetched", data: generators };
}

export async function getGeneratorById(id) {
  const generator = await Generator.findById(id)
    .populate("property", "name")
    .populate("block", "name")
    .populate("createdBy", "name email")
    .populate(
      "subMeter",
      "name meterType isActive lastReading meterSerialNumber",
    )
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

  const {
    fuelPercent,
    runningHours,
    status,
    notes,
    // Optional electricity metering fields —
    // provide these when the generator's control panel has a grid meter.
    gridCurrentReading, // kWh reading on the physical sub-meter
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    englishMonth,
    englishYear,
    readingDate,
  } = checkData;

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

  // ── Optional: record grid electricity reading for this generator ─────────
  // Industry pattern: daily check is the natural moment to also log the
  // kWh meter reading on the generator's control panel. This keeps fuel
  // and electricity data in sync with the same timestamp.
  let electricityReading = null;
  if (gridCurrentReading !== undefined && generator.subMeter) {
    if (!nepaliDate || !nepaliMonth || !nepaliYear) {
      throw new Error(
        "nepaliDate, nepaliMonth, and nepaliYear are required when gridCurrentReading is provided",
      );
    }

    // Lazy-import to avoid circular deps
    const { electricityService } =
      await import("../electricity/electricity.service.js");

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const readingResult = await electricityService.createElectricityReading(
        {
          meterType: "sub_meter",
          subMeterId: generator.subMeter.toString(),
          propertyId: generator.property?.toString(),
          currentReading: parseFloat(gridCurrentReading),
          nepaliMonth: Number(nepaliMonth),
          nepaliYear: Number(nepaliYear),
          nepaliDate,
          englishMonth: englishMonth ? Number(englishMonth) : undefined,
          englishYear: englishYear ? Number(englishYear) : undefined,
          readingDate: readingDate ? new Date(readingDate) : new Date(),
          notes: notes ?? `Daily check — generator ${generator.name}`,
          createdBy: adminId,
        },
        session,
      );

      if (readingResult?.data?.totalAmount > 0) {
        await electricityService.recordElectricityCharge(
          readingResult.data._id,
          session,
        );
      }

      await session.commitTransaction();
      session.endSession();
      electricityReading = readingResult?.data ?? null;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      // Non-fatal: daily check is already saved. Surface the error in the response.
      return {
        success: true,
        message: "Daily check recorded but electricity reading failed",
        data: generator,
        electricityError: err.message,
      };
    }
  }

  return {
    success: true,
    message: electricityReading
      ? "Daily check and electricity reading recorded"
      : "Daily check recorded",
    data: generator,
    electricityReading,
  };
}

// ─── Fuel Refill ──────────────────────────────────────────────────────────────

/**
 * Records a fuel refill on the generator AND, when a cost is provided,
 * creates a corresponding Expense → Transaction → LedgerEntry triple
 * so that fuel costs flow through the accounting system automatically.
 *
 * Expected body fields:
 *   liters               {number}  required
 *   cost                 {number}  optional – rupees; if present an expense is posted
 *   fuelLevelAfterPercent{number}  optional
 *   supplier             {string}  optional
 *   invoiceRef           {string}  optional
 *   notes                {string}  optional
 *   nepaliDate           {Date}    required when cost is present
 *   nepaliMonth          {number}  required when cost is present
 *   nepaliYear           {number}  required when cost is present
 *   paymentMethod        {string}  optional – defaults to "bank_transfer"
 *   bankAccountId        {string}  optional – required for bank_transfer / cheque
 */
export async function recordFuelRefill(generatorId, refillData, adminId) {
  console.log(refillData);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const generator = await Generator.findById(generatorId).session(session);
    if (!generator) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Generator not found", data: null };
    }

    const {
      liters,
      cost,
      fuelLevelAfterPercent,
      supplier,
      invoiceRef,
      notes,
      // Accounting fields — required only when cost is provided
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      paymentMethod,
      bankAccountId,
    } = refillData;

    const costPaisa = cost ? rupeesToPaisa(cost) : 0;

    // ── 1. Record the refill sub-document ────────────────────────────────────
    generator.fuelRefills.push({
      date: new Date(),
      litersAdded: liters,
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
      if (
        fuelLevelAfterPercent > generator.lowFuelThresholdPercent &&
        generator.status === "FAULT"
      ) {
        generator.status = "IDLE";
      }
    }

    await generator.save({ session });

    // ── 2. Post expense → transaction → ledger (only when cost is given) ─────
    let expenseResult = null;
    if (costPaisa > 0) {
      _assertAccountingFields(
        { nepaliDate, nepaliMonth, nepaliYear },
        "fuel refill",
      );

      const sourceId = await _resolveExpenseSourceId("UTILITY", session);

      expenseResult = await createExpense(
        {
          source: sourceId,
          amountPaisa: costPaisa,
          EnglishDate: new Date(),
          nepaliDate: new Date(nepaliDate),
          nepaliMonth: Number(nepaliMonth),
          nepaliYear: Number(nepaliYear),
          payeeType: "EXTERNAL",
          referenceType: "UTILITY",
          referenceId: generator._id, // link back to the generator
          notes:
            notes ??
            `Fuel refill — ${liters}L` +
              (supplier ? ` from ${supplier}` : "") +
              (invoiceRef ? ` (inv: ${invoiceRef})` : ""),
          createdBy: adminId,
          paymentMethod: paymentMethod ?? "bank_transfer",
          bankAccountId,
          // expenseCode left undefined — expense.service will resolve via
          // ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_SOURCE_CODE mapping or default 5200
        },
        session, // pass the open session so it participates in the same transaction
      );

      if (!expenseResult.success) {
        throw new Error(
          `Expense creation failed: ${expenseResult.error ?? expenseResult.message}`,
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message:
        "Fuel refill recorded" + (costPaisa > 0 ? " and expense posted" : ""),
      data: generator,
      expense: expenseResult?.data ?? null,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// ─── Service Log ──────────────────────────────────────────────────────────────

/**
 * Records a service/maintenance log on the generator AND, when a cost is
 * provided, creates a corresponding Expense → Transaction → LedgerEntry triple.
 *
 * Expected body fields (in addition to existing service fields):
 *   nepaliDate    {Date}    required when cost is present
 *   nepaliMonth   {number}  required when cost is present
 *   nepaliYear    {number}  required when cost is present
 *   paymentMethod {string}  optional – defaults to "bank_transfer"
 *   bankAccountId {string}  optional
 */
export async function recordServiceLog(generatorId, serviceData, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const generator = await Generator.findById(generatorId).session(session);
    if (!generator) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Generator not found", data: null };
    }

    const {
      type,
      description,
      cost,
      technician,
      nextServiceDate,
      nextServiceHours,
      notes,
      // Accounting fields
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      paymentMethod,
      bankAccountId,
    } = serviceData;

    const costPaisa = cost ? rupeesToPaisa(cost) : 0;

    // ── 1. Record the service log sub-document ────────────────────────────────
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

    // Update next service schedule
    if (nextServiceDate) generator.nextServiceDate = new Date(nextServiceDate);
    if (nextServiceHours) generator.nextServiceHours = nextServiceHours;

    // When service is done, reset status from MAINTENANCE → IDLE
    if (generator.status === "MAINTENANCE") {
      generator.status = "IDLE";
    }

    await generator.save({ session });

    // ── 2. Post expense → transaction → ledger (only when cost is given) ─────
    let expenseResult = null;
    if (costPaisa > 0) {
      _assertAccountingFields(
        { nepaliDate, nepaliMonth, nepaliYear },
        "service log",
      );

      const sourceId = await _resolveExpenseSourceId("MAINTENANCE", session);

      const expenseDescription =
        description ??
        `Generator service (${type})` + (technician ? ` by ${technician}` : "");

      expenseResult = await createExpense(
        {
          source: sourceId,
          amountPaisa: costPaisa,
          EnglishDate: new Date(),
          nepaliDate: new Date(nepaliDate),
          nepaliMonth: Number(nepaliMonth),
          nepaliYear: Number(nepaliYear),
          payeeType: "EXTERNAL",
          referenceType: "MAINTENANCE",
          referenceId: generator._id,
          notes: notes ?? expenseDescription,
          createdBy: adminId,
          paymentMethod: paymentMethod ?? "bank_transfer",
          bankAccountId,
          // expense.service maps MAINTENANCE source → ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_CODE
        },
        session,
      );

      if (!expenseResult.success) {
        throw new Error(
          `Expense creation failed: ${expenseResult.error ?? expenseResult.message}`,
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message:
        "Service log recorded" + (costPaisa > 0 ? " and expense posted" : ""),
      data: generator,
      expense: expenseResult?.data ?? null,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
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

// ─── Generator Electricity Readings ──────────────────────────────────────────

/**
 * Returns all Electricity readings linked to this generator's SubMeter.
 * Useful for cost dashboards — "how much grid power did generator X consume?"
 */
export async function getGeneratorElectricity(generatorId, filters = {}) {
  const generator = await Generator.findById(generatorId).lean();
  if (!generator)
    return { success: false, message: "Generator not found", data: null };

  if (!generator.subMeter)
    return {
      success: false,
      message:
        "This generator has no linked sub-meter. Re-create it to auto-provision one.",
      data: null,
    };

  const { electricityService } =
    await import("../electricity/electricity.service.js");

  const result = await electricityService.getElectricityReadings({
    subMeterId: generator.subMeter.toString(),
    nepaliYear: filters.nepaliYear ? Number(filters.nepaliYear) : undefined,
    nepaliMonth: filters.nepaliMonth ? Number(filters.nepaliMonth) : undefined,
  });

  return {
    success: true,
    message: "Generator electricity readings fetched",
    generator: { _id: generator._id, name: generator.name },
    data: result.data,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Throws a clear error if the caller forgot the Nepali date fields
 * that are required for the accounting entry.
 */
function _assertAccountingFields(
  { nepaliDate, nepaliMonth, nepaliYear },
  context,
) {
  if (!nepaliDate || !nepaliMonth || !nepaliYear) {
    throw new Error(
      `nepaliDate, nepaliMonth, and nepaliYear are required when a cost is ` +
        `provided for a ${context}.`,
    );
  }
}
