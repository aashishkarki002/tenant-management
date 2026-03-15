/**
 * Loan.service.js  (FIXED — adds Liability tracking)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT CHANGED AND WHY:
 *
 * Problem: When a loan was created, only the double-entry ledger journal was
 * posted (DR Bank / CR Loan Liability 2200). The `Liability` collection —
 * which powers the Liabilities UI page, cash-flow reports, and lender
 * dashboards — was never written to.
 *
 * Fix:
 *   createLoan         → also creates a Liability document (referenceType: "LOAN")
 *   recordLoanPayment  → also decrements Liability.amountPaisa by principalPaisa
 *                         (interest is an expense, not a reduction of what we owe)
 *                         and marks loanStatus: "CLOSED" when fully repaid
 *
 * ACCOUNTING CONCEPT (why interest is NOT a liability reduction):
 *
 *   The loan liability = the principal we owe back to the lender.
 *   Interest = the cost of borrowing for this period (an EXPENSE on the P&L).
 *
 *   Each EMI payment contains two distinct components:
 *
 *   1. Principal repayment  — reduces the liability (what we owe)
 *      DR  Loan Liability (2200)       principalPaisa
 *
 *   2. Interest expense     — costs recognised on the P&L this period
 *      DR  Loan Interest Expense (5100) interestPaisa
 *
 *   3. Cash exits the bank
 *      CR  Bank Account (1010-xxx)     totalPaisa (= principal + interest)
 *
 *   The Liability document tracks the OUTSTANDING PRINCIPAL only,
 *   mirroring Account 2200's balance. Both stay in sync via the same session.
 *
 * IDEMPOTENCY:
 *   - createLoan: Liability.findOne({ referenceType, referenceId }) before create
 *   - recordLoanPayment: protected by Loan.status !== "ACTIVE" guard
 *
 * SESSIONS:
 *   All writes (Loan, LoanPayment, LedgerEntry, Transaction, Liability)
 *   happen inside a single MongoDB session → fully atomic.
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the LiabilitySource._id for code "LOAN".
 * Seeds it on first use so the caller never has to worry about it.
 */
async function resolveLoanLiabilitySourceId(session) {
  let src = await LiabilitySource.findOne({ code: "LOAN" })
    .session(session)
    .lean();
  if (!src) {
    // Lazy seed — should only happen on first-ever loan in a fresh DB
    await seedLoanLiabilitySource();
    src = await LiabilitySource.findOne({ code: "LOAN" }).lean();
  }
  return src._id;
}

// ─────────────────────────────────────────────────────────────────────────────
// createLoan
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a new loan, post the disbursement journal, and register a
 * Liability document for the outstanding principal.
 *
 * @param {Object} data
 * @param {mongoose.ClientSession} [session]
 */
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

  // ── Ensure loan accounts are seeded for this entity ────────────────────────
  // This is safe to call every time — it's idempotent.
  await seedLoanAccountsForEntity(entityId);

  const ownedSession = !session;
  const sess = session ?? (await mongoose.startSession());
  if (ownedSession) sess.startTransaction();

  try {
    // ── 1. Calculate EMI ────────────────────────────────────────────────────
    const emiPaisa = Loan.calculateEmiPaisa(
      principalPaisa,
      interestRateAnnual,
      tenureMonths,
    );

    // ── 2. Nepali dates ─────────────────────────────────────────────────────
    const dateObj = disbursedDate ? new Date(disbursedDate) : new Date();
    const nd = new NepaliDate(dateObj);
    const nepaliDisbursedDate = formatNepaliISO(nd);
    const nepaliMonth = nd.getMonth() + 1;
    const nepaliYear = nd.getYear();

    // ── 3. Create Loan document ─────────────────────────────────────────────
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

    // ── 4. Post disbursement journal ────────────────────────────────────────
    //
    //   DR  Bank Account (bankAccountCode)   principalPaisa  ← cash received
    //   CR  Loan Liability (2200)            principalPaisa  ← we now owe lender
    //
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

    // Store transaction ref on loan
    loan.disbursementTransactionId = transaction._id;
    await loan.save({ session: sess });

    // ── 5. Create Liability document ────────────────────────────────────────
    //
    // WHY: Account 2200 in the ledger holds the balance-sheet total.
    // The Liability document is the OPERATIONAL tracker — it's what shows up
    // in the Liabilities page, allows filtering by lender, and powers
    // cash-flow forecasting (how much principal repayment is due each month).
    //
    // amountPaisa = full principal (outstanding balance at disbursement)
    // originalAmountPaisa = same value, never changes — used for completion %
    //
    const loanSourceId = await resolveLoanLiabilitySourceId(sess);

    // Idempotency: don't double-create if called twice
    const existingLiability = await Liability.findOne({
      referenceType: "LOAN",
      referenceId: loan._id,
    }).session(sess);

    if (!existingLiability) {
      await Liability.create(
        [
          {
            source: loanSourceId,
            amountPaisa: principalPaisa, // current outstanding
            originalAmountPaisa: principalPaisa, // immutable
            date: dateObj,
            npYear: nepaliYear,
            npMonth: nepaliMonth,
            payeeType: "EXTERNAL", // we owe the bank, not a tenant
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
 * Record a single EMI payment with principal/interest split.
 * Updates the Liability document's outstanding balance atomically.
 *
 * ACCOUNTING (per EMI payment):
 *
 *   DR  Loan Liability (2200)         principalPaisa  ← reduce what we owe
 *   DR  Loan Interest Expense (5100)  interestPaisa   ← cost of borrowing (P&L)
 *   CR  Bank Account (1010-xxx)       totalPaisa      ← cash exits
 *
 * NOTE: Only principalPaisa reduces the Liability document.
 *       The interest portion is an EXPENSE — it reduces profit, not the debt.
 *
 * @param {Object} data
 * @param {mongoose.ClientSession} [session]
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
  } = data;

  assertValidPaymentMethod(paymentMethod);
  if (!bankAccountCode) throw new Error("bankAccountCode is required");
  if (!entityId) throw new Error("entityId is required");

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

    // ── 2. Calculate principal/interest split ───────────────────────────────
    const monthlyRate = loan.interestRateAnnual / 12 / 100;
    const interestPaisa = Math.round(loan.outstandingPaisa * monthlyRate);

    let principalPaisa, totalPaisa;

    if (customPrincipalPaisa) {
      // Prepayment: caller provides the principal portion explicitly
      principalPaisa = Math.min(customPrincipalPaisa, loan.outstandingPaisa);
      totalPaisa = principalPaisa + interestPaisa;
    } else {
      // Standard EMI
      totalPaisa = loan.emiPaisa;
      principalPaisa = totalPaisa - interestPaisa;
      // Last payment: clear rounding residue
      if (principalPaisa > loan.outstandingPaisa) {
        principalPaisa = loan.outstandingPaisa;
        totalPaisa = principalPaisa + interestPaisa;
      }
    }

    const outstandingBeforePaisa = loan.outstandingPaisa;
    const outstandingAfterPaisa = Math.max(
      0,
      loan.outstandingPaisa - principalPaisa,
    );
    const loanNowClosed = outstandingAfterPaisa === 0;

    // ── 3. Nepali dates ─────────────────────────────────────────────────────
    const dateObj = paymentDate ? new Date(paymentDate) : new Date();
    const nd = new NepaliDate(dateObj);
    const nepaliDate = formatNepaliISO(nd);
    const nepaliMonth = nd.getMonth() + 1;
    const nepaliYear = nd.getYear();

    // ── 4. Create LoanPayment document ─────────────────────────────────────
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
          installmentNumber: loan.installmentsPaid + 1,
          notes: notes ?? null,
          createdBy,
        },
      ],
      { session: sess },
    );

    // ── 5. Post EMI journal ─────────────────────────────────────────────────
    //
    //   DR  Loan Liability (2200)         principalPaisa  ← debt reduces
    //   DR  Loan Interest Expense (5100)  interestPaisa   ← cost on P&L
    //   CR  Bank Account (bankAccountCode) totalPaisa     ← cash leaves
    //
    const paymentPayload = buildLoanPaymentJournal(payment, loan, {
      createdBy,
    });
    const { transaction } = await ledgerService.postJournalEntry(
      paymentPayload,
      sess,
      entityId,
    );

    // Store transaction ref on payment
    payment.transactionId = transaction._id;
    await payment.save({ session: sess });

    // ── 6. Update Loan outstanding + status ────────────────────────────────
    loan.outstandingPaisa = outstandingAfterPaisa;
    loan.installmentsPaid += 1;
    if (loanNowClosed) loan.status = "CLOSED";
    await loan.save({ session: sess });

    // ── 7. Update Liability document ────────────────────────────────────────
    //
    // WHY only principalPaisa, not totalPaisa?
    //
    //   The Liability document represents "how much principal we still owe
    //   to the lender". Each EMI has two parts:
    //
    //     a) Principal repayment → reduces what we owe → decrement Liability
    //     b) Interest expense    → pays for using the money → recorded as P&L
    //                              expense (Account 5100), NOT a liability
    //
    //   Analogy: if you borrow Rs. 10,000 and pay Rs. 1,200 per month
    //   (Rs. 1,000 principal + Rs. 200 interest):
    //   - Your debt (liability) goes from 10,000 → 9,000 (only principal)
    //   - The Rs. 200 interest is a cost you pay for borrowing (expense)
    //
    const liabilityUpdate = {
      amountPaisa: outstandingAfterPaisa, // absolute set — matches Loan.outstandingPaisa
      loanStatus: loanNowClosed ? "CLOSED" : "ACTIVE",
      status: loanNowClosed ? "SYNCED" : "RECORDED",
    };

    await Liability.findOneAndUpdate(
      { referenceType: "LOAN", referenceId: loan._id },
      { $set: liabilityUpdate },
      { session: sess },
    );

    if (ownedSession) await sess.commitTransaction();

    return {
      success: true,
      payment,
      loan,
      transaction,
      summary: {
        installmentNumber: payment.installmentNumber,
        principalPaisa,
        interestPaisa,
        totalPaisa,
        outstandingAfterPaisa,
        loanClosed: loanNowClosed,
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
/**
 * Full amortization schedule, merged with actual payment history.
 */
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
