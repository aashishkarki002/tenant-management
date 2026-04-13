/**
 * Loan.service.js  (FIXED — critical issues)
 * ─────────────────────────────────────────────────────────────────────────────
 * CRITICAL FIXES IN THIS VERSION:
 *
 * FIX 1 — No Expense document created on EMI payment
 *   recordLoanPayment now creates an Expense document for the interest portion
 *   of every EMI inside the same session. The interest is an EXPENSE (P&L),
 *   so it must appear in the Expenses collection for reports and the UI.
 *   principalPaisa reduction → Liability doc only.
 *   interestPaisa → Expense doc + ledger journal entry DR 5100.
 *
 * FIX 2 — Overpayment silently truncated
 *   When customPrincipalPaisa > outstandingPaisa, we now throw a clear
 *   validation error instead of silently capping the amount. Caller must
 *   pass the correct principal, or omit customPrincipalPaisa to use the
 *   standard EMI. If you want to allow payoff, pass the exact outstanding.
 *
 * FIX 3 — Last-installment EMI total diverges from schedule
 *   When principalPaisa is clamped to outstandingPaisa on the final payment,
 *   we now correctly recalculate totalPaisa = clamped principal + interestPaisa
 *   AND return a `wasAdjusted` flag so the caller knows the total differed
 *   from the scheduled EMI.
 *
 * FIX 4 — Race condition on installmentNumber assignment
 *   installmentNumber is now assigned using a $inc atomic operation on
 *   Loan.installmentsPaid within the session, not read-then-write. A
 *   findOneAndUpdate with $inc + returnDocument:"before" gives us the
 *   pre-increment value (= next installment number) atomically.
 *   Combined with the unique index on { loan, installmentNumber }, a
 *   duplicate will fail at the DB layer rather than silently create two
 *   installment #4 records.
 *
 * FIX 5 — Zero-interest crash in ledger journal
 *   buildLoanPaymentJournal emits a DR entry for Account 5100 even when
 *   interestPaisa === 0, which causes the LedgerEntry pre-save hook to throw
 *   "Entry must have either debit or credit amount".
 *   We now skip posting the interest journal entry (and skip creating the
 *   Expense doc) when interestPaisa === 0.
 */

import mongoose from "mongoose";
import { Loan } from "./Loan.model.js";
import { LoanPayment } from "./LoanPayment.model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildLoanDisbursementJournal,
  buildLoanPaymentJournal,
} from "../ledger/journal-builders/index.js";
import { Liability } from "../liabilities/Liabilities.Model.js";
import { LiabilitySource } from "../liabilities/LiabilitesSource.Model.js";
import {
  seedLoanAccountsForEntity,
  seedLoanLiabilitySource,
} from "../../seeds/seedLoanAccount.js";
import { formatNepaliISO } from "../../utils/nepaliDateHelper.js";
import { assertValidPaymentMethod } from "../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";
import { createChequeDraft } from "../chequeDrafts/chequeDraft.service.js";
import { ACCOUNT_CODES } from "../ledger/config/accounts.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function resolveLoanLiabilitySourceId(session) {
  let src = await LiabilitySource.findOne({ code: "LOAN" })
    .session(session)
    .lean();
  if (!src) {
    await seedLoanLiabilitySource();
    src = await LiabilitySource.findOne({ code: "LOAN" }).lean();
  }
  return src._id;
}

/** Ensures ExpenseSource INTEREST exists so P&L/UI show a label, not a loan ObjectId. */
async function resolveInterestExpenseSourceId(session) {
  let src = await ExpenseSource.findOne({ code: "INTEREST" })
    .session(session)
    .lean();
  if (!src) {
    const [created] = await ExpenseSource.create(
      [
        {
          name: "Interest Expense",
          code: "INTEREST",
          category: "NON_OPERATING",
          description: "Interest on loans and borrowings",
        },
      ],
      { session },
    );
    return created._id;
  }
  return src._id;
}

/**
 * FIX 5 HELPER — Build a payment journal that omits the interest entry when
 * interestPaisa === 0. The standard buildLoanPaymentJournal always emits
 * three entries; a zero-paisa debit entry breaks the LedgerEntry pre-save
 * hook ("Entry must have either debit or credit amount").
 *
 * When interestPaisa > 0:  3-entry journal (DR liability, DR interest, CR bank)
 * When interestPaisa === 0: 2-entry journal (DR liability, CR bank)
 */
function buildSafePaymentJournal(payment, loan, options = {}) {
  const journal = buildLoanPaymentJournal(payment, loan, options);

  if (payment.interestPaisa === 0) {
    // Remove the interest DR entry — zero-paisa debit is invalid
    journal.entries = journal.entries.filter(
      (e) => e.debitAmountPaisa > 0 || e.creditAmountPaisa > 0,
    );
    // Recalculate total for balance check: principal only
    journal.totalAmountPaisa = payment.principalPaisa;
  }

  return journal;
}

// ─────────────────────────────────────────────────────────────────────────────
// createLoan
// ─────────────────────────────────────────────────────────────────────────────
export async function createLoan(data, session = null) {
  const {
    entityId,
    property,
    lender,
    loanAccountNumber,
    loanType,
    principalPaisa,
    interestRateAnnual,
    tenureMonths,
    disbursedDate,
    firstEmiDate,
    bankAccountCode,
    notes,
    createdBy,
  } = data;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!principalPaisa || principalPaisa < 1)
    throw new Error("Principal must be positive");
  if (interestRateAnnual == null || interestRateAnnual < 0)
    throw new Error("Interest rate must be non-negative");
  if (!tenureMonths || tenureMonths < 1)
    throw new Error("Tenure must be at least 1 month");
  if (!bankAccountCode) throw new Error("bankAccountCode is required");
  if (!entityId) throw new Error("entityId is required");

  await seedLoanAccountsForEntity(entityId);

  const ownedSession = !session;
  const sess = session ?? (await mongoose.startSession());
  if (ownedSession) sess.startTransaction();

  try {
    const emiPaisa = Loan.calculateEmiPaisa(
      principalPaisa,
      interestRateAnnual,
      tenureMonths,
    );

    const dateObj = disbursedDate ? new Date(disbursedDate) : new Date();
    const nd = new NepaliDate(dateObj);
    const nepaliDisbursedDate = formatNepaliISO(nd);
    const nepaliMonth = nd.getMonth() + 1;
    const nepaliYear = nd.getYear();

    const [loan] = await Loan.create(
      [
        {
          entityId,
          property: property ?? null,
          lender,
          loanAccountNumber: loanAccountNumber ?? null,
          loanType,
          principalPaisa,
          outstandingPaisa: principalPaisa,
          interestRateAnnual,
          tenureMonths,
          emiPaisa,
          installmentsPaid: 0,
          disbursedDate: dateObj,
          firstEmiDate: firstEmiDate ? new Date(firstEmiDate) : null,
          nepaliDisbursedDate,
          nepaliMonth,
          nepaliYear,
          bankAccountCode,
          status: "ACTIVE",
          notes: notes ?? null,
          createdBy,
        },
      ],
      { session: sess },
    );

    const disbursementPayload = buildLoanDisbursementJournal(loan, {
      createdBy,
      nepaliMonth,
      nepaliYear,
    });
    const { transaction } = await ledgerService.postJournalEntry(
      disbursementPayload,
      sess,
      entityId,
    );

    loan.disbursementTransactionId = transaction._id;
    await loan.save({ session: sess });

    // ── Create Liability document ────────────────────────────────────────────
    const loanSourceId = await resolveLoanLiabilitySourceId(sess);

    const existingLiability = await Liability.findOne({
      referenceType: "LOAN",
      referenceId: loan._id,
    }).session(sess);

    if (!existingLiability) {
      const [liability] = await Liability.create(
        [
          {
            source: loanSourceId,
            amountPaisa: principalPaisa,
            originalAmountPaisa: principalPaisa,
            englishDate: dateObj,
            nepaliYear,
            nepaliMonth,
            payeeType: "EXTERNAL",
            referenceType: "LOAN",
            referenceId: loan._id,
            loanStatus: "ACTIVE",
            status: "RECORDED",
            notes: notes ?? `${loanType} from ${lender}`,
            createdBy,
          },
        ],
        { session: sess },
      );
      loan.liability = liability._id;
      console.log("liability", liability);
      await loan.save({ session: sess });
    }

    if (ownedSession) await sess.commitTransaction();
    return { success: true, loan, transaction };
  } catch (err) {
    if (ownedSession) await sess.abortTransaction();
    throw err;
  } finally {
    if (ownedSession) sess.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// recordLoanPayment
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Record a single EMI payment.
 *
 * CRITICAL FIXES applied here:
 *   FIX 1 — Creates an Expense document for the interest portion (when > 0)
 *   FIX 2 — Throws when customPrincipalPaisa exceeds outstandingPaisa
 *   FIX 3 — Returns wasAdjusted=true when last-installment EMI is trimmed
 *   FIX 4 — Uses findOneAndUpdate $inc for atomic installmentNumber assignment
 *   FIX 5 — Skips zero-paisa interest journal entry and Expense doc
 */
export async function recordLoanPayment(data, session = null) {
  const {
    loanId,
    entityId,
    paymentDate,
    bankAccountCode,
    paymentMethod,
    customPrincipalPaisa,
    notes,
    createdBy,
    chequeNumber,
  } = data;

  assertValidPaymentMethod(paymentMethod);
  if (!bankAccountCode) throw new Error("bankAccountCode is required");
  if (!entityId) throw new Error("entityId is required");

  // FIX 2: validate customPrincipalPaisa upfront before touching DB
  if (customPrincipalPaisa != null) {
    if (!Number.isInteger(customPrincipalPaisa) || customPrincipalPaisa < 1) {
      throw new Error(
        "customPrincipalPaisa must be a positive integer (paisa)",
      );
    }
  }

  const ownedSession = !session;
  const sess = session ?? (await mongoose.startSession());
  if (ownedSession) sess.startTransaction();

  try {
    // ── 1. Load and validate loan ───────────────────────────────────────────
    const loan = await Loan.findById(loanId).session(sess);
    if (!loan) throw new Error(`Loan ${loanId} not found`);
    if (loan.status !== "ACTIVE")
      throw new Error(`Loan is ${loan.status} — cannot record payment`);
    if (loan.outstandingPaisa <= 0) throw new Error("Loan is fully repaid");

    // ── 2. FIX 2: Reject overpayment rather than silently clamping ──────────
    if (
      customPrincipalPaisa != null &&
      customPrincipalPaisa > loan.outstandingPaisa
    ) {
      throw new Error(
        `customPrincipalPaisa (${customPrincipalPaisa} p) exceeds outstanding balance ` +
          `(${loan.outstandingPaisa} p). To close the loan, pass exactly ${loan.outstandingPaisa}.`,
      );
    }

    // ── 3. Calculate principal/interest split ───────────────────────────────
    const monthlyRate = loan.interestRateAnnual / 12 / 100;
    const interestPaisa = Math.round(loan.outstandingPaisa * monthlyRate);

    let principalPaisa,
      totalPaisa,
      wasAdjusted = false;

    if (customPrincipalPaisa != null) {
      // Prepayment: caller provides the principal portion explicitly.
      // We already know it's <= outstandingPaisa from FIX 2 above.
      principalPaisa = customPrincipalPaisa;
      totalPaisa = principalPaisa + interestPaisa;
    } else {
      // Standard EMI
      totalPaisa = loan.emiPaisa;
      principalPaisa = totalPaisa - interestPaisa;

      // FIX 3: Last installment — clamp principal to outstanding and signal adjustment
      if (principalPaisa > loan.outstandingPaisa) {
        principalPaisa = loan.outstandingPaisa;
        totalPaisa = principalPaisa + interestPaisa; // recalculate correctly
        wasAdjusted = true; // ← returned to caller so they know total differed from emiPaisa
      }
    }

    const outstandingBeforePaisa = loan.outstandingPaisa;
    const outstandingAfterPaisa = Math.max(
      0,
      loan.outstandingPaisa - principalPaisa,
    );
    const loanNowClosed = outstandingAfterPaisa === 0;

    // ── 4. Nepali dates ─────────────────────────────────────────────────────
    const dateObj = paymentDate ? new Date(paymentDate) : new Date();
    const nd = new NepaliDate(dateObj);
    const nepaliDate = formatNepaliISO(nd);
    const nepaliMonth = nd.getMonth() + 1;
    const nepaliYear = nd.getYear();

    // ── 5. FIX 4: Atomically claim the next installment number ──────────────
    //
    // We use findOneAndUpdate with $inc BEFORE creating the LoanPayment doc.
    // returnDocument: "before" gives us the pre-increment installmentsPaid,
    // which equals the 0-based count — adding 1 gives the 1-based number.
    //
    // This eliminates the read-then-write race where two concurrent requests
    // both read installmentsPaid=3 and both try to write installment #4.
    // The unique index on { loan, installmentNumber } is the final safety net.
    //
    const loanBeforeIncrement = await Loan.findOneAndUpdate(
      {
        _id: loanId,
        status: "ACTIVE", // guard: still active at increment time
        outstandingPaisa: { $gt: 0 }, // guard: still has balance
        installmentsPaid: loan.installmentsPaid, // optimistic lock on read value
      },
      { $inc: { installmentsPaid: 1 } },
      { session: sess, returnDocument: "before", new: false },
    );

    if (!loanBeforeIncrement) {
      // Another concurrent request beat us — the optimistic lock failed.
      throw new Error(
        "Concurrent payment detected for this loan. Please retry.",
      );
    }

    const installmentNumber = loanBeforeIncrement.installmentsPaid + 1;

    // ── 6. Create LoanPayment document ─────────────────────────────────────
    const [payment] = await LoanPayment.create(
      [
        {
          loan: loan._id,
          entityId,
          totalPaisa,
          principalPaisa,
          interestPaisa,
          outstandingBeforePaisa,
          outstandingAfterPaisa,
          paymentDate: dateObj,
          nepaliDate,
          nepaliMonth,
          nepaliYear,
          bankAccountCode,
          paymentMethod,
          installmentNumber,
          notes: notes ?? null,
          createdBy,
        },
      ],
      { session: sess },
    );

    // ── 7. FIX 5: Post EMI journal, skipping zero-interest entry ────────────
    //
    // buildSafePaymentJournal strips the DR 5100 entry when interestPaisa===0.
    // Without this, LedgerEntry pre-save throws:
    //   "Entry must have either debit or credit amount"
    //
    const paymentPayload = buildSafePaymentJournal(payment, loan, {
      createdBy,
    });
    const { transaction } = await ledgerService.postJournalEntry(
      paymentPayload,
      sess,
      entityId,
    );

    payment.transactionId = transaction._id;
    await payment.save({ session: sess });

    // ── 8. FIX 1: Create Expense document for the interest portion ──────────
    //
    // WHY: The ledger journal (step 7) posts DR 5100 (Loan Interest Expense)
    // which is correct for the double-entry. But the Expenses collection is the
    // OPERATIONAL tracker — it's what shows up on the Expenses UI page, expense
    // category reports, and cash-flow dashboards. Without this, interest costs
    // are invisible in the UI even though the ledger balance is correct.
    //
    // We only create the Expense doc when interestPaisa > 0 (FIX 5 synergy).
    //
    let expenseDoc = null;
    if (interestPaisa > 0) {
      const interestSourceId = await resolveInterestExpenseSourceId(sess);

      const [created] = await Expense.create(
        [
          {
            entityId,

            transactionScope: "head_office",
            amountPaisa: interestPaisa,
            paymentMethod,
            expenseCode: "5100", // LOAN_INTEREST_EXPENSE account code
            referenceType: "LOAN_INTEREST",
            referenceId: payment._id, // back-link to the LoanPayment
            englishDate: dateObj,
            nepaliDate,
            payeeType: "EXTERNAL",
            externalPayee: {
              name: loan.lender,
              type: "LOAN_INTEREST",
            },
            source: interestSourceId,
            nepaliMonth,
            nepaliYear,
            description: `Loan interest — ${loan.lender} EMI #${installmentNumber}`,
            notes: `Loan: ${loan._id} | Principal repaid this EMI: ${principalPaisa} p`,
            createdBy,
          },
        ],
        { session: sess },
      );

      expenseDoc = created;
    }

    // ── 9. Create ChequeDraft when paying EMI by cheque ────────────────────
    if (paymentMethod === "cheque" && chequeNumber) {
      await createChequeDraft(
        {
          chequeNumber,
          chequeDate: dateObj,
          direction: "ISSUED",
          // Full EMI amount (principal + interest) is what the cheque covers
          amountPaisa: totalPaisa,
          bankAccountCode,
          referenceAccountCode: ACCOUNT_CODES.LOAN_LIABILITY,
          referenceType: "LoanPayment",
          referenceId: payment._id,
          entityId,
          partyName: loan.lender ?? null,
          nepaliDate,
          nepaliMonth,
          nepaliYear,
          createdBy,
        },
        sess,
      );
    }

    // ── 10. Update Loan outstanding + status ────────────────────────────────
    //
    // installmentsPaid was already incremented atomically in step 5.
    // We only need to update outstandingPaisa and status here.
    //
    await Loan.updateOne(
      { _id: loan._id },
      {
        $set: {
          outstandingPaisa: outstandingAfterPaisa,
          ...(loanNowClosed ? { status: "CLOSED" } : {}),
        },
      },
      { session: sess },
    );

    // ── 11. Update Liability document ────────────────────────────────────────
    await Liability.findOneAndUpdate(
      { referenceType: "LOAN", referenceId: loan._id },
      {
        $set: {
          amountPaisa: outstandingAfterPaisa,
          loanStatus: loanNowClosed ? "CLOSED" : "ACTIVE",
          status: loanNowClosed ? "SYNCED" : "RECORDED",
        },
      },
      { session: sess },
    );

    if (ownedSession) await sess.commitTransaction();

    return {
      success: true,
      payment,
      transaction,
      expense: expenseDoc,
      summary: {
        installmentNumber,
        principalPaisa,
        interestPaisa,
        totalPaisa,
        outstandingAfterPaisa,
        loanClosed: loanNowClosed,
        wasAdjusted, // FIX 3: true when last EMI was trimmed to clear residue
        expenseCreated: !!expenseDoc,
      },
    };
  } catch (err) {
    if (ownedSession) await sess.abortTransaction();
    throw err;
  } finally {
    if (ownedSession) sess.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getLoanAmortizationSchedule
// ─────────────────────────────────────────────────────────────────────────────
export async function getLoanAmortizationSchedule(loanId) {
  const loan = await Loan.findById(loanId).lean();
  if (!loan) throw new Error(`Loan ${loanId} not found`);

  const schedule = Loan.buildAmortizationSchedule(
    loan.principalPaisa,
    loan.interestRateAnnual,
    loan.tenureMonths,
  );

  const payments = await LoanPayment.find({ loan: loanId })
    .sort({ installmentNumber: 1 })
    .lean();

  const paymentByInstallment = Object.fromEntries(
    payments.map((p) => [p.installmentNumber, p]),
  );

  return {
    loan,
    schedule: schedule.map((row) => ({
      ...row,
      paid: !!paymentByInstallment[row.installment],
      paymentDate: paymentByInstallment[row.installment]?.paymentDate ?? null,
      actualTotalPaisa:
        paymentByInstallment[row.installment]?.totalPaisa ?? null,
      // Expose adjustment flag so UI can show "final EMI adjusted" badge
      wasAdjusted: paymentByInstallment[row.installment]?.wasAdjusted ?? false,
    })),
    summary: {
      totalInstallments: loan.tenureMonths,
      paid: loan.installmentsPaid,
      remaining: loan.tenureMonths - loan.installmentsPaid,
      outstandingPaisa: loan.outstandingPaisa,
      status: loan.status,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getLoansByEntity
// ─────────────────────────────────────────────────────────────────────────────
export async function getLoansByEntity(entityId, filters = {}) {
  const query = { entityId };
  if (filters.status) query.status = filters.status.toUpperCase();
  if (filters.propertyId) query.property = filters.propertyId;

  const loans = await Loan.find(query).sort({ disbursedDate: -1 }).lean();

  return loans.map((l) => ({
    ...l,
    completionPercent: l.principalPaisa
      ? (
          ((l.principalPaisa - l.outstandingPaisa) / l.principalPaisa) *
          100
        ).toFixed(1)
      : "0.0",
  }));
}

export async function getLoanPayments(loanId) {
  return LoanPayment.find({ loan: loanId })
    .sort({ installmentNumber: 1 })
    .lean();
}

export async function updateLoan(loanId, updates) {
  const loan = await Loan.findById(loanId);
  if (!loan) throw new Error("Loan not found");

  const safeFields = ["lender", "loanAccountNumber", "loanType", "notes", "firstEmiDate"];
  for (const field of safeFields) {
    if (updates[field] !== undefined) loan[field] = updates[field];
  }

  await loan.save();
  return loan.toObject();
}
