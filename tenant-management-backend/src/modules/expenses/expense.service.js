import { Expense } from "./Expense.Model.js";
import ExpenseSource from "./ExpenseSource.Model.js";
import Admin from "../auth/admin.Model.js";
import BankAccount from "../banks/BankAccountModel.js";
import mongoose from "mongoose";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildExpenseJournal } from "../ledger/journal-builders/index.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";
import { ACCOUNTING_CONFIG } from "../../config/accounting.config.js";
import {
  PAYMENT_METHODS,
  assertValidPaymentMethod,
} from "../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";
import {
  parseNepaliISO,
  resolveNepaliPeriod,
  getNepaliYearMonthFromDate,
} from "../../utils/nepaliDateHelper.js";

/**
 * Create an expense, post a journal transaction, and write ledger entries —
 * all within a single atomic operation.
 *
 * @param {Object}                        expenseData
 * @param {mongoose.ClientSession|null}   [externalSession]
 *   Pass an already-open session when the caller owns the transaction
 *   (e.g. generator service wants both the generator save and the expense
 *   in the same atomic unit).  When null (default) this function manages
 *   its own session.
 */
export async function createExpense(expenseData, externalSession = null) {
  // If the caller already has an open session/transaction, join it;
  // otherwise start our own.
  const ownsSession = externalSession == null;
  const session = externalSession ?? (await mongoose.startSession());

  if (ownsSession) session.startTransaction();

  try {
    const {
      source,
      amountPaisa,
      amount,
      EnglishDate,
      nepaliDate: rawNepaliDate,
      nepaliDateStr, // "YYYY-MM-DD" BS string — canonical input
      nepaliMonth: rawNepaliMonth,
      nepaliYear: rawNepaliYear,
      payeeType,
      tenant,
      referenceType,
      referenceId,
      status,
      notes,
      createdBy,
      expenseCode,
      paymentMethod: rawPaymentMethod,
      bankAccountId,
    } = expenseData;

    const paymentMethod =
      typeof rawPaymentMethod === "string" &&
      Object.values(PAYMENT_METHODS).includes(rawPaymentMethod)
        ? rawPaymentMethod
        : PAYMENT_METHODS.BANK_TRANSFER;
    assertValidPaymentMethod(paymentMethod);

    let bankAccountCode = null;
    if (
      (paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
        paymentMethod === PAYMENT_METHODS.CHEQUE) &&
      bankAccountId
    ) {
      const bank = await BankAccount.findById(bankAccountId).session(session);
      if (!bank || bank.isDeleted) {
        throw new Error(`Bank account not found or deleted: ${bankAccountId}`);
      }
      bankAccountCode = bank.accountCode;
    }

    // ── Canonical Nepali date resolution ─────────────────────────────────
    //
    // THE CORE BUG this block fixes:
    //   nd.getDateObject() returns a Date whose time parts are in the LOCAL
    //   timezone of the Node process (Nepal server = UTC+5:45).
    //   Serialising that with .toISOString() turns local midnight 00:00+05:45
    //   into 18:15:00Z the PREVIOUS day — which is exactly what was stored.
    //
    // Fix: extract year/month/day integers from NepaliDate and build the
    //   stored Date with Date.UTC() — always yields UTC midnight for the
    //   correct English-equivalent calendar day, regardless of server TZ.
    //
    // Resolution priority (first truthy path wins):
    //   1. nepaliDateStr  "YYYY-MM-DD" BS string   ← canonical, most reliable
    //   2. rawNepaliDate  any Date/ISO the frontend sent
    //   3. Derive from EnglishDate / now
    //
    function nepaliToUTCMidnight(nd) {
      // nd.getDateObject() gives local-time Date — we only read the calendar
      // digits (year/month/day) and rebuild in UTC to prevent TZ shift.
      const eq = nd.getDateObject();
      return new Date(Date.UTC(eq.getFullYear(), eq.getMonth(), eq.getDate()));
    }

    let nepaliDate; // Date — UTC midnight of the English-equivalent day
    let nepaliMonth; // 1-based integer (matches DB schema)
    let nepaliYear; // integer

    try {
      if (nepaliDateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(nepaliDateStr))) {
        // Path 1 — BS string e.g. "2082-11-23"
        const nd = parseNepaliISO(nepaliDateStr);
        nepaliDate = nepaliToUTCMidnight(nd); // 2026-03-07T00:00:00.000Z ✓
        nepaliYear = nd.getYear();
        nepaliMonth = nd.getMonth() + 1;
      } else if (rawNepaliDate) {
        // Path 2 — a Date/ISO string was sent
        const parsed = new Date(rawNepaliDate);
        if (isNaN(parsed.getTime()))
          throw new Error("Unparseable nepaliDate: " + rawNepaliDate);
        const nd = new NepaliDate(parsed);
        nepaliDate = nepaliToUTCMidnight(nd);
        nepaliYear = nd.getYear();
        nepaliMonth = nd.getMonth() + 1;
      } else {
        // Path 3 — nothing Nepali supplied; derive from EnglishDate
        const anchor = EnglishDate ? new Date(EnglishDate) : new Date();
        const nd = new NepaliDate(anchor);
        nepaliDate = nepaliToUTCMidnight(nd);
        nepaliYear = nd.getYear();
        nepaliMonth = nd.getMonth() + 1;
        console.warn(
          "[createExpense] nepaliDateStr not supplied — derived:",
          anchor.toISOString(),
          "→ BS",
          nepaliYear,
          nepaliMonth,
        );
      }

      // Integrity check — resolveNepaliPeriod throws on out-of-range values
      const resolved = resolveNepaliPeriod({
        nepaliMonth,
        nepaliYear,
        fallbackDate: EnglishDate ? new Date(EnglishDate) : new Date(),
      });
      nepaliMonth = resolved.nepaliMonth;
      nepaliYear = resolved.nepaliYear;
    } catch (ndErr) {
      throw new Error("Nepali date resolution failed: " + ndErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────

    // Convert to paisa if needed
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;

    const expenseSource = await ExpenseSource.findById(source).session(session);
    if (!expenseSource) {
      throw new Error("Expense source not found");
    }

    const existingAdmin = await Admin.findById(createdBy).session(session);
    if (!existingAdmin) {
      throw new Error("Admin not found");
    }

    // Resolve ledger account code
    // Priority:
    //   1. Explicit expenseCode from the caller
    //   2. MAINTENANCE source → ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_CODE
    //   3. Default generic expense account (5200)
    const DEFAULT_EXPENSE_ACCOUNT_CODE = "5200";
    let expenseCodeToUse = expenseCode;
    if (!expenseCodeToUse && expenseSource?.code) {
      if (
        expenseSource.code === ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_SOURCE_CODE
      ) {
        expenseCodeToUse = ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_CODE;
      } else {
        expenseCodeToUse = DEFAULT_EXPENSE_ACCOUNT_CODE;
      }
    }
    if (!expenseCodeToUse) {
      expenseCodeToUse = DEFAULT_EXPENSE_ACCOUNT_CODE;
    }

    // Create the expense document
    const [expense] = await Expense.create(
      [
        {
          source: expenseSource._id,
          amountPaisa: finalAmountPaisa,
          EnglishDate,
          nepaliDate,
          nepaliMonth,
          nepaliYear,
          payeeType,
          tenant,
          referenceType,
          referenceId,
          status,
          notes,
          createdBy,
          expenseCode: expenseCodeToUse,
        },
      ],
      { session },
    );

    // Build and post the journal entry
    const expenseForJournal = {
      ...expense.toObject(),
      paymentMethod,
    };
    const expensePayload = buildExpenseJournal(
      expenseForJournal,
      bankAccountCode,
    );
    await ledgerService.postJournalEntry(expensePayload, session);

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
    // Re-throw when we don't own the session so the outer transaction
    // can decide whether to abort.
    if (!ownsSession) throw error;

    // Handle Mongoose validation errors gracefully when we own the session
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
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

export async function getAllExpenses() {
  try {
    const expenses = await Expense.find()
      .populate("source")
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
