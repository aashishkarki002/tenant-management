import mongoose from "mongoose";
import { Generator } from "./Generator.Model.js";
import { rupeesToPaisa } from "../../../utils/moneyUtil.js";
import { createExpense } from "../../expenses/expense.service.js";

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
