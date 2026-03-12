/**
 * expense.service.js — v3 (multi-entity)
 *
 * Changes from v2:
 *  - payeeType INTERNAL: staffPayee sub-doc fully wired
 *  - transactionScope "split": posts one journal entry per entity allocation
 *  - transactionScope "head_office": posts to head office entity's CoA
 *  - entityId is now threaded through to ledgerService.postJournalEntry
 *    as a required argument (no more optional null)
 *  - All account lookups use (code, entityId) via resolveAccountsByEntity
 *  - getExpensesByEntity() — new: per-entity expense report
 *  - nepaliDate stored as "YYYY-MM-DD" BS string throughout
 *
 * SPLIT EXPENSE FLOW:
 *   When transactionScope === "split", we create ONE Expense document but
 *   post MULTIPLE journals — one per entity in splitAllocations.
 *   Each journal debits the expense account in that entity's CoA and
 *   credits their bank/cash account for their allocated amount.
 *   This keeps each entity's books independent and correct.
 */

import mongoose from "mongoose";
import { Expense } from "./Expense.Model.js";
import ExpenseSource from "./ExpenseSource.Model.js";
import Admin from "../auth/admin.Model.js";
import BankAccount from "../banks/BankAccountModel.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildExpenseJournal } from "../ledger/journal-builders/index.js";
import { rupeesToPaisa, formatMoney } from "../../utils/moneyUtil.js";
import { ACCOUNTING_CONFIG } from "../../config/accounting.config.js";
import {
  PAYMENT_METHODS,
  assertValidPaymentMethod,
} from "../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";
import {
  parseNepaliISO,
  formatNepaliISO,
  getNepaliYearMonthFromDate,
} from "../../utils/nepaliDateHelper.js";
import { OwnershipEntity } from "../ownership/OwnershipEntity.Model.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_EXPENSE_ACCOUNT_CODE = "5200";
const SALARY_EXPENSE_ACCOUNT_CODE = "5100";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve all Nepali date fields from various input shapes.
 * Always returns a plain "YYYY-MM-DD" BS string — never a Date object.
 * This avoids the UTC+5:45 timezone shift bug.
 *
 * The controller renames `nepaliDate` → `nepaliDateStr` before calling the
 * service, so this function only needs to handle nepaliDateStr. If absent,
 * the BS date is derived from EnglishDate (or today as a last resort).
 */
function resolveNepaliDateFields({ nepaliDateStr, EnglishDate }) {
  let nd;
  if (nepaliDateStr != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nepaliDateStr))) {
      throw new Error(
        `Invalid nepaliDate format: "${nepaliDateStr}". Expected BS date as "YYYY-MM-DD" (e.g. "2081-04-15").`,
      );
    }
    nd = parseNepaliISO(nepaliDateStr);
  } else {
    // No BS date provided — derive from EnglishDate or today
    nd = new NepaliDate(EnglishDate ? new Date(EnglishDate) : new Date());
  }

  const nepaliDate = formatNepaliISO(nd);
  const { npYear: nepaliYear, npMonth: nepaliMonth } =
    getNepaliYearMonthFromDate(nd.getDateObject());

  return { nepaliDate, nepaliMonth, nepaliYear };
}

/**
 * Resolve the ledger account code for an expense.
 * Priority: explicit expenseCode > payeeType heuristic > source-based > default
 */
function resolveExpenseAccountCode({
  expenseCode,
  payeeType,
  referenceType,
  expenseSource,
}) {
  if (expenseCode) return expenseCode;

  if (payeeType === "INTERNAL" || referenceType === "SALARY") {
    return SALARY_EXPENSE_ACCOUNT_CODE;
  }

  if (
    expenseSource?.code === ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_SOURCE_CODE
  ) {
    return ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_CODE;
  }

  return DEFAULT_EXPENSE_ACCOUNT_CODE;
}

/**
 * Resolve bank account code from bankAccountId.
 * Returns null if no bank account provided (cash/default payment assumed).
 */
async function resolveBankAccountCode(paymentMethod, bankAccountId, session) {
  if (
    bankAccountId &&
    (paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
      paymentMethod === PAYMENT_METHODS.CHEQUE)
  ) {
    const bank = await BankAccount.findById(bankAccountId).session(session);
    if (!bank || bank.isDeleted) {
      throw new Error(`Bank account not found or deleted: ${bankAccountId}`);
    }
    return bank.accountCode;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST JOURNAL FOR ONE ENTITY ALLOCATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build and post the journal entry for a single entity's share of an expense.
 * Used for both "building" (full amount) and "split" (allocated amount) scopes.
 *
 * nepaliDate, nepaliMonth, nepaliYear are explicitly threaded through and
 * guaranteed on the journal payload — matching how revenue.service.js handles
 * this in postRevenueJournalForEntity(). Without this the builder may receive
 * undefined BS date fields and the ledger entry is stored without a Nepali date.
 *
 * @param {Object} params
 * @param {Object} params.expense           — saved Expense document (toObject())
 * @param {string|ObjectId} params.entityId — which entity's CoA to post to
 * @param {number} params.amountPaisa       — the share to post for this entity
 * @param {string} params.bankAccountCode   — resolved bank/cash account code
 * @param {string} params.expenseAccountCode
 * @param {string|null} params.nepaliDate   — BS "YYYY-MM-DD" string
 * @param {number} params.nepaliMonth
 * @param {number} params.nepaliYear
 * @param {mongoose.ClientSession} params.session
 */
async function postExpenseJournalForEntity({
  expense,
  entityId,
  amountPaisa,
  bankAccountCode,
  expenseAccountCode,
  nepaliDate,
  nepaliMonth,
  nepaliYear,
  session,
}) {
  const journalPayload = buildExpenseJournal(
    {
      ...expense,
      amountPaisa, // may be the allocated share, not full amount
      expenseCode: expenseAccountCode,
      paymentMethod: expense.paymentMethod,
    },
    bankAccountCode,
  );

  // Guarantee BS date fields survive into the ledger regardless of builder
  // behaviour — mirrors the same guarantee in postRevenueJournalForEntity().
  if (nepaliDate) journalPayload.nepaliDate = nepaliDate;
  if (nepaliMonth) journalPayload.nepaliMonth = nepaliMonth;
  if (nepaliYear) journalPayload.nepaliYear = nepaliYear;

  return ledgerService.postJournalEntry(journalPayload, session, entityId);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVE TRANSACTION SCOPE FROM ENTITY ID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive transactionScope from the entity type — frontend only sends entityId.
 */
async function resolveTransactionScope({ entityId, splitAllocations }) {
  if (splitAllocations?.length) {
    if (!entityId) throw new Error("entityId is required for split expenses");
    return { transactionScope: "split", entityId };
  }

  if (!entityId) throw new Error("entityId is required");

  const entity = await OwnershipEntity.findById(entityId).lean();
  if (!entity) throw new Error("Entity not found");

  // entityId is always kept — transactionScope just describes how cost is split
  const transactionScope =
    entity.type === "head_office" ? "head_office" : "building";

  return { transactionScope, entityId: entity._id };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE EXPENSE — main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an expense and post its journal entries atomically.
 *
 * Handles three transaction scopes:
 *
 *  "building"    — Single entity. Posts one journal to that entity's CoA.
 *                  entityId required.
 *
 *  "split"       — Multiple entities share the cost proportionally.
 *                  splitAllocations[] required (must sum to 100%).
 *                  Posts one journal per entity, each for their allocated amount.
 *                  The Expense doc stores ledgerEntryId per allocation.
 *
 *  "head_office" — Overhead expense owned by the HQ entity.
 *                  entityId must point to the head_office OwnershipEntity.
 *                  Posts one journal to that entity's CoA.
 *
 * @param {Object}                       expenseData
 * @param {mongoose.ClientSession|null}  [externalSession]
 */
export async function createExpense(expenseData, externalSession = null) {
  const ownsSession = externalSession == null;
  const session = externalSession ?? (await mongoose.startSession());

  if (ownsSession) session.startTransaction();

  try {
    const {
      source,
      amountPaisa,
      amount,
      EnglishDate,
      nepaliDateStr,
      payeeType,
      // Payee sub-docs
      tenant,
      externalPayee,
      staffPayee,
      // Reference
      referenceType,
      referenceId,
      status,
      notes,
      createdBy,
      expenseCode,
      paymentMethod: rawPaymentMethod,
      bankAccountId,
      bankAccountCode: rawBankAccountCode,
      // Multi-entity scope
      transactionScope,
      entityId,
      propertyId,
      splitAllocations,
    } = expenseData;

    // ── Resolve scope from entity type (frontend only needs to send entityId) ─
    const resolved = await resolveTransactionScope({
      entityId,
      splitAllocations,
    });
    const scope = resolved.transactionScope;
    const resolvedEntityId = resolved.entityId;

    // ── Payment method ──────────────────────────────────────────────────────
    const paymentMethod =
      typeof rawPaymentMethod === "string" &&
      Object.values(PAYMENT_METHODS).includes(rawPaymentMethod)
        ? rawPaymentMethod
        : PAYMENT_METHODS.BANK_TRANSFER;
    assertValidPaymentMethod(paymentMethod);

    // Accept bankAccountCode from payload, or resolve from bankAccountId
    let bankAccountCode;
    if (
      (paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
        paymentMethod === PAYMENT_METHODS.CHEQUE) &&
      typeof rawBankAccountCode === "string" &&
      rawBankAccountCode.trim()
    ) {
      bankAccountCode = rawBankAccountCode.trim();
    } else {
      bankAccountCode = await resolveBankAccountCode(
        paymentMethod,
        bankAccountId,
        session,
      );
    }

    // ── Nepali date resolution ──────────────────────────────────────────────
    const { nepaliDate, nepaliMonth, nepaliYear } = resolveNepaliDateFields({
      nepaliDateStr,
      EnglishDate,
    });

    // ── Amount ──────────────────────────────────────────────────────────────
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;

    if (!Number.isInteger(finalAmountPaisa) || finalAmountPaisa <= 0) {
      throw new Error("Amount must be a positive integer in paisa");
    }

    // ── Payee validation ────────────────────────────────────────────────────
    if (!payeeType || !["TENANT", "EXTERNAL", "INTERNAL"].includes(payeeType)) {
      throw new Error("payeeType must be TENANT, EXTERNAL, or INTERNAL");
    }

    if (payeeType === "TENANT" && !tenant) {
      throw new Error("tenant is required for TENANT expense");
    }
    if (payeeType === "EXTERNAL") {
      if (!externalPayee?.name || !externalPayee?.type) {
        throw new Error(
          "externalPayee.name and externalPayee.type are required for EXTERNAL expense",
        );
      }
    }
    if (payeeType === "INTERNAL") {
      if (!staffPayee?.staffId) {
        throw new Error("staffPayee.staffId is required for INTERNAL expense");
      }
    }

    // ── Source & admin validation ───────────────────────────────────────────
    const expenseSource = await ExpenseSource.findById(source).session(session);
    if (!expenseSource) throw new Error("Expense source not found");

    const existingAdmin = await Admin.findById(createdBy).session(session);
    if (!existingAdmin) throw new Error("Admin not found");

    // ── Account code ────────────────────────────────────────────────────────
    const expenseAccountCode = resolveExpenseAccountCode({
      expenseCode,
      payeeType,
      referenceType,
      expenseSource,
    });

    // ── Build the Expense document ──────────────────────────────────────────
    const expenseDoc = {
      source: expenseSource._id,
      amountPaisa: finalAmountPaisa,
      EnglishDate: EnglishDate ? new Date(EnglishDate) : new Date(),
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      payeeType,
      referenceType: referenceType ?? "MANUAL",
      referenceId,
      status: status ?? "RECORDED",
      notes,
      createdBy,
      expenseCode: expenseAccountCode,
      paymentMethod,
      transactionScope: scope,
    };

    // Attach payee sub-doc
    if (payeeType === "TENANT") expenseDoc.tenant = tenant;
    else if (payeeType === "EXTERNAL") expenseDoc.externalPayee = externalPayee;
    else if (payeeType === "INTERNAL") expenseDoc.staffPayee = staffPayee;

    // entityId is always set — every expense must know its owner
    expenseDoc.entityId = resolvedEntityId;

    // Attach scope-specific fields
    if (scope === "building") {
      expenseDoc.propertyId = propertyId;
    } else if (scope === "split") {
      expenseDoc.splitAllocations = splitAllocations;
    }
    // head_office: no extra fields needed — entityId IS the HQ entity

    // ── Persist Expense document ────────────────────────────────────────────
    const [expense] = await Expense.create([expenseDoc], { session });

    // ── Post journal entries ────────────────────────────────────────────────
    const expenseBase = {
      ...expense.toObject(),
      paymentMethod,
    };

    // nepali date fields passed explicitly to every postExpenseJournalForEntity
    // call so the ledger entry is always stamped with the correct BS date —
    // mirrors the pattern in revenue.service.js postRevenueJournalForEntity().
    const journalDateFields = { nepaliDate, nepaliMonth, nepaliYear };

    if (scope === "building") {
      // Single journal → single entity's CoA
      await postExpenseJournalForEntity({
        expense: expenseBase,
        entityId: resolvedEntityId,
        amountPaisa: finalAmountPaisa,
        bankAccountCode,
        expenseAccountCode,
        ...journalDateFields,
        session,
      });
    } else if (scope === "head_office") {
      // Single journal → head office entity's CoA
      await postExpenseJournalForEntity({
        expense: expenseBase,
        entityId: resolvedEntityId,
        amountPaisa: finalAmountPaisa,
        bankAccountCode,
        expenseAccountCode,
        ...journalDateFields,
        session,
      });
    } else if (scope === "split") {
      // One journal per entity allocation
      // Validate allocation totals
      const totalAllocated = splitAllocations.reduce(
        (s, a) => s + (a.amountPaisa || 0),
        0,
      );
      if (totalAllocated !== finalAmountPaisa) {
        throw new Error(
          `Split allocation amounts (${formatMoney(totalAllocated)}) ` +
            `do not sum to total expense (${formatMoney(finalAmountPaisa)})`,
        );
      }

      for (const allocation of splitAllocations) {
        const result = await postExpenseJournalForEntity({
          expense: {
            ...expenseBase,
            propertyId: allocation.propertyId,
          },
          entityId: allocation.entityId,
          amountPaisa: allocation.amountPaisa,
          bankAccountCode,
          expenseAccountCode,
          ...journalDateFields,
          session,
        });

        // Stamp the ledgerEntryId back onto the allocation for traceability
        allocation.ledgerEntryId = result.ledgerEntries[0]?._id ?? null;
      }

      // Update the expense doc with the populated ledgerEntryIds
      await Expense.findByIdAndUpdate(
        expense._id,
        { $set: { splitAllocations: splitAllocations } },
        { session },
      );
    }

    if (ownsSession) {
      await session.commitTransaction();
      session.endSession();
    }

    return {
      success: true,
      message: "Expense created successfully",
      data: expense,
    };
  } catch (error) {
    if (ownsSession) {
      await session.abortTransaction();
      session.endSession();
    }

    if (!ownsSession) throw error;

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        message: "Validation error",
        error: validationErrors,
      };
    }

    return {
      success: false,
      message: "Failed to create expense",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all expenses with optional filters.
 *
 * @param {Object} [filters]
 * @param {string} [filters.entityId]
 * @param {string} [filters.payeeType]
 * @param {string} [filters.referenceType]
 * @param {number} [filters.nepaliYear]
 * @param {number} [filters.nepaliMonth]
 * @param {string} [filters.propertyId]
 * @param {string} [filters.transactionScope]
 */
export async function getAllExpenses(filters = {}) {
  try {
    const query = {};

    if (filters.entityId)
      query.entityId = new mongoose.Types.ObjectId(filters.entityId);
    if (filters.payeeType) query.payeeType = filters.payeeType;
    if (filters.nepaliYear) query.nepaliYear = Number(filters.nepaliYear);
    if (filters.nepaliMonth) query.nepaliMonth = Number(filters.nepaliMonth);
    if (filters.referenceType) query.referenceType = filters.referenceType;
    if (filters.propertyId)
      query.propertyId = new mongoose.Types.ObjectId(filters.propertyId);
    if (filters.transactionScope)
      query.transactionScope = filters.transactionScope;

    const expenses = await Expense.find(query)
      .populate("source", "name code category")
      .populate("tenant", "name phone")
      .populate("staffPayee.staffId", "name email role")
      .populate("entityId", "name type")
      .populate("createdBy", "name email")
      .sort({ EnglishDate: -1 });

    return {
      success: true,
      message: "Expenses fetched successfully",
      data: expenses,
    };
  } catch (error) {
    console.error("Failed to get expenses:", error);
    throw error;
  }
}

/**
 * Get expenses grouped by entity — useful for the accounting dashboard.
 *
 * @param {Object} [filters]
 * @param {number} [filters.nepaliYear]
 * @param {number} [filters.nepaliMonth]
 */
export async function getExpensesByEntity(filters = {}) {
  try {
    const matchStage = {};
    if (filters.nepaliYear) matchStage.nepaliYear = Number(filters.nepaliYear);
    if (filters.nepaliMonth)
      matchStage.nepaliMonth = Number(filters.nepaliMonth);

    const results = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$entityId",
          totalPaisa: { $sum: "$amountPaisa" },
          count: { $sum: 1 },
          byPayeeType: {
            $push: {
              payeeType: "$payeeType",
              amountPaisa: "$amountPaisa",
            },
          },
        },
      },
      {
        $lookup: {
          from: "ownershipentities",
          localField: "_id",
          foreignField: "_id",
          as: "entity",
        },
      },
      {
        $project: {
          entityId: "$_id",
          entityName: { $arrayElemAt: ["$entity.name", 0] },
          entityType: { $arrayElemAt: ["$entity.type", 0] },
          totalPaisa: 1,
          count: 1,
          byPayeeType: 1,
        },
      },
      { $sort: { entityName: 1 } },
    ]);

    return {
      success: true,
      message: "Expenses by entity fetched successfully",
      data: results,
    };
  } catch (error) {
    console.error("Failed to get expenses by entity:", error);
    throw error;
  }
}

/**
 * Get all expenses for a specific staff member.
 *
 * @param {string} staffId
 * @param {Object} [filters]
 * @param {number} [filters.nepaliYear]
 * @param {number} [filters.nepaliMonth]
 */
export async function getStaffExpenses(staffId, filters = {}) {
  try {
    if (!staffId) throw new Error("staffId is required");

    const query = {
      payeeType: "INTERNAL",
      "staffPayee.staffId": new mongoose.Types.ObjectId(staffId),
    };

    if (filters.nepaliYear) query.nepaliYear = Number(filters.nepaliYear);
    if (filters.nepaliMonth) query.nepaliMonth = Number(filters.nepaliMonth);

    const expenses = await Expense.find(query)
      .populate("source", "name code")
      .populate("staffPayee.staffId", "name email role")
      .sort({ EnglishDate: -1 });

    const totalPaisa = expenses.reduce((sum, e) => sum + e.amountPaisa, 0);

    return {
      success: true,
      message: "Staff expenses fetched successfully",
      data: expenses,
      totalAmountPaisa: totalPaisa,
      totalAmountRupees: totalPaisa / 100,
    };
  } catch (error) {
    console.error("Failed to get staff expenses:", error);
    throw error;
  }
}

/**
 * Salary summary for all staff for a given Nepali pay period.
 *
 * @param {number} nepaliYear
 * @param {number} nepaliMonth  1-based
 */
export async function getSalaryReport(nepaliYear, nepaliMonth) {
  try {
    const expenses = await Expense.aggregate([
      {
        $match: {
          payeeType: "INTERNAL",
          referenceType: { $in: ["SALARY", "ADVANCE"] },
          nepaliYear: Number(nepaliYear),
          nepaliMonth: Number(nepaliMonth),
        },
      },
      {
        $group: {
          _id: "$staffPayee.staffId",
          totalPaisa: { $sum: "$amountPaisa" },
          entries: { $push: "$$ROOT" },
        },
      },
      {
        $lookup: {
          from: "admins",
          localField: "_id",
          foreignField: "_id",
          as: "staff",
        },
      },
      {
        $project: {
          staffId: "$_id",
          staffName: { $arrayElemAt: ["$staff.name", 0] },
          staffRole: { $arrayElemAt: ["$staff.role", 0] },
          totalPaisa: 1,
          totalRupees: { $divide: ["$totalPaisa", 100] },
          entryCount: { $size: "$entries" },
        },
      },
      { $sort: { staffName: 1 } },
    ]);

    const grandTotalPaisa = expenses.reduce((sum, e) => sum + e.totalPaisa, 0);

    return {
      success: true,
      message: `Salary report for ${nepaliYear}/${nepaliMonth}`,
      data: expenses,
      grandTotalPaisa,
      grandTotalRupees: grandTotalPaisa / 100,
    };
  } catch (error) {
    console.error("Failed to get salary report:", error);
    throw error;
  }
}

export async function getExpenseSources() {
  try {
    const expenseSource = await ExpenseSource.find({ isActive: true });
    return {
      success: true,
      message: "Expense sources fetched successfully",
      data: expenseSource,
    };
  } catch (error) {
    console.error("Failed to get expense sources:", error);
    throw error;
  }
}
