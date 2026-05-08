/**
 * yearEndClose.service.js
 *
 * Orchestrates Nepal fiscal year-end close for an OwnershipEntity.
 *
 * Steps:
 *  1. Validate all 12 monthly periods for the fiscal year are closed
 *  2. Guard against duplicate close for the same entity+year
 *  3. Aggregate current balances of all revenue (4xxx) and expense (5xxx) accounts
 *  4. Open Mongoose session + transaction
 *  5. Create FiscalYearClose document (status: PENDING)
 *  6. Post Pass 1 journal — close revenue to Income Summary
 *  7. Post Pass 2 journal — close expenses from Income Summary
 *  8. Post Pass 3 journal — transfer Income Summary to Retained Earnings
 *  9. Update FiscalYearClose to status: COMPLETED with tx references
 * 10. Commit session
 * 11. Write audit log event
 */

import mongoose from "mongoose";
import { FiscalYearClose } from "./FiscalYearClose.Model.js";
import { ClosedPeriod } from "../ClosedPeriod.Model.js";
import { Account } from "../accounts/Account.Model.js";
import { ledgerService } from "../ledger.service.js";
import { auditService } from "../../audit/audit.service.js";
import {
  buildYearEndRevenueCloseJournal,
  buildYearEndExpenseCloseJournal,
  buildYearEndRetainedEarningsJournal,
  REVENUE_ACCOUNT_CODES,
  EXPENSE_ACCOUNT_CODES,
} from "../journal-builders/yearEndClose.js";

// Nepal fiscal year months:
// Months 4–12 of fiscalYear + months 1–3 of (fiscalYear+1)
function getFiscalYearPeriods(fiscalYear) {
  const periods = [];
  for (let month = 4; month <= 12; month++) {
    periods.push({ nepaliYear: fiscalYear, nepaliMonth: month });
  }
  for (let month = 1; month <= 3; month++) {
    periods.push({ nepaliYear: fiscalYear + 1, nepaliMonth: month });
  }
  return periods;
}

class YearEndCloseService {
  /**
   * Execute fiscal year-end close for an entity.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.entityId
   * @param {number}          params.fiscalYear   e.g. 2081
   * @param {string|ObjectId} params.closedBy     Admin._id
   * @param {string}          [params.closeNote]
   *
   * @returns {Promise<FiscalYearClose>}
   */
  async closeYear({ entityId, fiscalYear, closedBy, closeNote }) {
    if (!entityId)   throw new Error("yearEndClose: entityId is required");
    if (!fiscalYear) throw new Error("yearEndClose: fiscalYear is required");
    if (!closedBy)   throw new Error("yearEndClose: closedBy is required");

    // ── 1. Check for duplicate close ────────────────────────────────────────
    const existing = await FiscalYearClose.findOne({ entityId, fiscalYear });
    if (existing?.status === "COMPLETED") {
      throw new Error(
        `Fiscal year ${fiscalYear} is already closed for this entity. ` +
        `Reopen it before closing again.`,
      );
    }

    // ── 2. Validate all 12 periods are closed ───────────────────────────────
    const periods = getFiscalYearPeriods(fiscalYear);
    const closedPeriods = await ClosedPeriod.find({
      entityId,
      isClosed: true,
      $or: periods.map(p => ({
        nepaliYear: p.nepaliYear,
        nepaliMonth: p.nepaliMonth,
      })),
    }).select("nepaliYear nepaliMonth").lean();

    const closedSet = new Set(
      closedPeriods.map(p => `${p.nepaliYear}-${p.nepaliMonth}`),
    );
    const openPeriods = periods.filter(
      p => !closedSet.has(`${p.nepaliYear}-${p.nepaliMonth}`),
    );
    if (openPeriods.length > 0) {
      const labels = openPeriods
        .map(p => `${p.nepaliYear}/${String(p.nepaliMonth).padStart(2, "0")}`)
        .join(", ");
      throw new Error(
        `Cannot close FY ${fiscalYear}: the following periods are still open: ${labels}. ` +
        `Close all 12 periods before executing year-end close.`,
      );
    }

    // ── 3. Aggregate account balances ────────────────────────────────────────
    const allCodes = [...REVENUE_ACCOUNT_CODES, ...EXPENSE_ACCOUNT_CODES];
    const accounts = await Account.find({
      entityId,
      code: { $in: allCodes },
    }).select("code currentBalancePaisa").lean();

    const revenueBalances = new Map();
    const expenseBalances = new Map();

    for (const account of accounts) {
      const bal = account.currentBalancePaisa ?? 0;
      if (REVENUE_ACCOUNT_CODES.includes(account.code)) {
        revenueBalances.set(account.code, bal);
      } else {
        expenseBalances.set(account.code, bal);
      }
    }

    const totalRevenuePaisa = [...revenueBalances.values()].reduce((s, v) => s + v, 0);
    const totalExpensePaisa = [...expenseBalances.values()].reduce((s, v) => s + v, 0);
    const netIncomePaisa    = totalRevenuePaisa - totalExpensePaisa;

    // ── 4. Create or update FiscalYearClose document ─────────────────────────
    const closeDoc = await FiscalYearClose.findOneAndUpdate(
      { entityId, fiscalYear },
      {
        status: "PENDING",
        totalRevenuePaisa,
        totalExpensePaisa,
        netIncomePaisa,
        allPeriodsClosedAt: new Date(),
        closedBy,
        closedAt: null,
        closeNote: closeNote ?? null,
        failureReason: null,
      },
      { upsert: true, new: true },
    );

    // ── 5. Post closing journals within a session ───────────────────────────
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Pass 1: Close revenue accounts
        const revPayload = buildYearEndRevenueCloseJournal({
          fiscalYearCloseId: closeDoc._id,
          revenueBalances,
          fiscalYear,
          closedBy,
          entityId,
        });

        let revTxId = null;
        if (revPayload) {
          // Override idempotency — year-end close uses a unique referenceId per doc
          // so we need different referenceId per pass to avoid collision
          revPayload.referenceId = new mongoose.Types.ObjectId();
          const { transaction: revTx } = await ledgerService.postJournalEntry(
            revPayload, session, entityId,
          );
          revTxId = revTx._id;
        }

        // Pass 2: Close expense accounts
        const expPayload = buildYearEndExpenseCloseJournal({
          fiscalYearCloseId: closeDoc._id,
          expenseBalances,
          fiscalYear,
          closedBy,
          entityId,
        });

        let expTxId = null;
        if (expPayload) {
          expPayload.referenceId = new mongoose.Types.ObjectId();
          const { transaction: expTx } = await ledgerService.postJournalEntry(
            expPayload, session, entityId,
          );
          expTxId = expTx._id;
        }

        // Pass 3: Transfer to Retained Earnings
        const retPayload = buildYearEndRetainedEarningsJournal({
          fiscalYearCloseId: closeDoc._id,
          totalRevenuePaisa,
          totalExpensePaisa,
          fiscalYear,
          closedBy,
          entityId,
        });

        let retTxId = null;
        if (retPayload) {
          retPayload.referenceId = new mongoose.Types.ObjectId();
          const { transaction: retTx } = await ledgerService.postJournalEntry(
            retPayload, session, entityId,
          );
          retTxId = retTx._id;
        }

        // Mark close as COMPLETED
        await FiscalYearClose.findByIdAndUpdate(
          closeDoc._id,
          {
            status: "COMPLETED",
            revenueCloseTxId:     revTxId,
            expenseCloseTxId:     expTxId,
            retainedEarningsTxId: retTxId,
            closedAt: new Date(),
          },
          { session },
        );
      });
    } catch (err) {
      // Mark close as FAILED for visibility
      await FiscalYearClose.findByIdAndUpdate(closeDoc._id, {
        status: "FAILED",
        failureReason: err.message,
      });
      throw err;
    } finally {
      await session.endSession();
    }

    // ── 6. Audit log ─────────────────────────────────────────────────────────
    const finalDoc = await FiscalYearClose.findById(closeDoc._id).lean();
    await auditService.log("YEAR_END_CLOSED", closedBy, {
      entityId,
      resourceType: "FiscalYearClose",
      resourceId: closeDoc._id,
      amountPaisa: Math.abs(netIncomePaisa),
      reason: closeNote,
      after: { fiscalYear, totalRevenuePaisa, totalExpensePaisa, netIncomePaisa },
    });

    return finalDoc;
  }

  /**
   * Reopen a completed fiscal year close.
   * This reverses the year-end closing entries — use with extreme caution.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.entityId
   * @param {number}          params.fiscalYear
   * @param {string|ObjectId} params.reopenedBy  Admin._id
   * @param {string}          params.reopenNote  Required — must document why
   */
  async reopenYear({ entityId, fiscalYear, reopenedBy, reopenNote }) {
    if (!reopenNote?.trim()) {
      throw new Error("reopenNote is required when reopening a fiscal year close");
    }

    const closeDoc = await FiscalYearClose.findOne({ entityId, fiscalYear });
    if (!closeDoc || closeDoc.status !== "COMPLETED") {
      throw new Error(`No completed year-end close found for FY ${fiscalYear}`);
    }

    await FiscalYearClose.findByIdAndUpdate(closeDoc._id, {
      status: "PENDING",
      reopenedBy,
      reopenedAt: new Date(),
      reopenNote,
      revenueCloseTxId: null,
      expenseCloseTxId: null,
      retainedEarningsTxId: null,
    });

    await auditService.log("YEAR_END_REOPENED", reopenedBy, {
      entityId,
      resourceType: "FiscalYearClose",
      resourceId: closeDoc._id,
      reason: reopenNote,
      before: { fiscalYear, status: "COMPLETED" },
      after:  { fiscalYear, status: "PENDING" },
    });

    return FiscalYearClose.findById(closeDoc._id).lean();
  }

  /**
   * Get year-end close status and history for an entity.
   *
   * @param {string|ObjectId} entityId
   * @returns {Promise<FiscalYearClose[]>}
   */
  async getCloseHistory(entityId) {
    return FiscalYearClose.find({ entityId })
      .sort({ fiscalYear: -1 })
      .populate("closedBy", "name email")
      .populate("reopenedBy", "name email")
      .lean();
  }

  /**
   * Get the close status for a specific fiscal year.
   *
   * @param {string|ObjectId} entityId
   * @param {number}          fiscalYear
   * @returns {Promise<{ closeDoc, periods, openPeriods, canClose }>}
   */
  async getYearStatus(entityId, fiscalYear) {
    const closeDoc = await FiscalYearClose.findOne({ entityId, fiscalYear }).lean();
    const periods  = getFiscalYearPeriods(fiscalYear);

    const closedPeriods = await ClosedPeriod.find({
      entityId,
      $or: periods.map(p => ({
        nepaliYear: p.nepaliYear,
        nepaliMonth: p.nepaliMonth,
      })),
    }).select("nepaliYear nepaliMonth isClosed").lean();

    const closedSet = new Set(
      closedPeriods
        .filter(p => p.isClosed)
        .map(p => `${p.nepaliYear}-${p.nepaliMonth}`),
    );

    const periodsStatus = periods.map(p => ({
      ...p,
      isClosed: closedSet.has(`${p.nepaliYear}-${p.nepaliMonth}`),
    }));

    const openPeriods = periodsStatus.filter(p => !p.isClosed);

    return {
      closeDoc,
      periods: periodsStatus,
      openPeriods,
      canClose: openPeriods.length === 0 && closeDoc?.status !== "COMPLETED",
    };
  }
}

export const yearEndCloseService = new YearEndCloseService();
