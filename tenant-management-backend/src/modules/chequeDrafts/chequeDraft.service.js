/**
 * chequeDraft.service.js
 *
 * Business logic for the cheque clearing lifecycle.
 *
 * Public API:
 *   createChequeDraft(params, session)       — called internally from expense/revenue/loan services
 *   markDeposited(id, data)                  — post deposit journal, status → DEPOSITED
 *   markBounced(id, data)                    — post reversal journal, status → BOUNCED
 *   markCancelled(id, data)                  — post reversal journal, status → CANCELLED
 *   getChequeDrafts(filters)                 — paginated list
 *   getChequeDraftById(id)                   — single record
 *   getChequeDraftSummary(entityId)          — KPI counts + amounts by direction
 */

import mongoose from "mongoose";
import { ChequeDraft } from "./ChequeDraft.Model.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildChequeReceiptJournal,
  buildChequeDepositJournal,
  buildChequeBounceJournal,
} from "../ledger/journal-builders/index.js";
import BankAccount from "../banks/BankAccountModel.js";

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a ChequeDraft record.
 * Called internally from expense.service.js, revenue.service.js, and Loan.service.js
 * within their existing transactions — do NOT start a new session here.
 *
 * @param {Object} params
 * @param {string}       params.chequeNumber
 * @param {Date}         params.chequeDate
 * @param {"ISSUED"|"RECEIVED"} params.direction
 * @param {number}       params.amountPaisa
 * @param {string}       params.bankAccountCode
 * @param {string}       [params.referenceAccountCode]
 * @param {"Expense"|"Revenue"|"LoanPayment"} [params.referenceType]
 * @param {ObjectId}     [params.referenceId]
 * @param {ObjectId}     params.entityId
 * @param {string}       [params.partyName]
 * @param {string}       [params.nepaliDate]
 * @param {number}       [params.nepaliMonth]
 * @param {number}       [params.nepaliYear]
 * @param {ObjectId}     params.createdBy
 * @param {boolean}      [params.skipReceiptJournal=false]
 *   Set to true when the caller has already posted the receipt-side journal
 *   entry (e.g. payment.service.js posts DR 1150 / CR AR for rent cheques).
 *   Prevents a double-posting of the DR 1150 / CR Revenue entry.
 * @param {mongoose.ClientSession} session
 * @returns {Promise<Object>} created ChequeDraft document
 */
export async function createChequeDraft(params, session) {
  const {
    chequeNumber,
    chequeDate,
    direction,
    amountPaisa,
    bankAccountCode,
    referenceAccountCode,
    referenceType,
    referenceId,
    entityId,
    partyName,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    createdBy,
    skipReceiptJournal = false,
  } = params;

  if (!chequeNumber?.trim()) throw new Error("chequeNumber is required");
  if (!bankAccountCode)
    throw new Error("bankAccountCode is required for cheque");

  const [draft] = await ChequeDraft.create(
    [
      {
        chequeNumber: chequeNumber.trim(),
        chequeDate: chequeDate ?? new Date(),
        direction,
        status: "PENDING",
        amountPaisa,
        bankAccountCode,
        referenceAccountCode: referenceAccountCode ?? null,
        referenceType: referenceType ?? null,
        referenceId: referenceId ?? null,
        entityId,
        partyName: partyName ?? null,
        nepaliDate: nepaliDate ?? null,
        nepaliMonth: nepaliMonth ?? null,
        nepaliYear: nepaliYear ?? null,
        createdBy,
      },
    ],
    { session },
  );

  // RECEIVED cheques: post receipt journal immediately (unless caller already did it).
  //   DR 1150 Cheques In Hand / CR Revenue/AR (4xxx / 1200)
  // Revenue is recognised when the cheque is handed over, not at bank clearance.
  // ISSUED cheques: the caller (expense.service.js) already posted
  //   DR Expense / CR 2150 Cheques Payable — no journal needed here.
  if (!skipReceiptJournal && direction === "RECEIVED" && referenceAccountCode) {
    const journalPayload = buildChequeReceiptJournal(draft.toObject());
    await ledgerService.postJournalEntry(journalPayload, session, entityId);
  }

  return draft;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a pending cheque as deposited and post the clearing journal.
 *
 * @param {string} id  — ChequeDraft._id
 * @param {Object} data
 * @param {ObjectId}    data.depositedBy
 * @param {string|Date} [data.depositDate]
 * @param {string}      [data.depositNotes]
 * @returns {Promise<Object>} { draft, transaction }
 */
export async function markDeposited(
  id,
  { depositedBy, depositDate, depositNotes },
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Atomically claim the draft — prevents double-deposit
    const draft = await ChequeDraft.findOneAndUpdate(
      { _id: id, status: "PENDING" },
      { $set: { status: "DEPOSITED" } },
      { session, new: true },
    );
    console.log("draft", draft);

    if (!draft) {
      throw new Error(
        `ChequeDraft ${id} not found or is not in PENDING status`,
      );
    }

    const depositedAt = depositDate ? new Date(depositDate) : new Date();

    draft.depositedBy = depositedBy;
    draft.depositedAt = depositedAt;
    draft.depositNotes = depositNotes ?? null;

    const draftForJournal = draft.toObject();
    draftForJournal.depositedAt = depositedAt;
    draftForJournal.depositedBy = depositedBy;

    // Both directions now post a clearing journal at deposit time.
    //
    // ISSUED:   DR 2150 Cheques Payable / CR Bank  — obligation settled, bank decreases
    // RECEIVED: DR Bank / CR 1150 Cheques In Hand  — money arrives in bank account
    const journalPayload = buildChequeDepositJournal(draftForJournal);
    const { transaction } = await ledgerService.postJournalEntry(
      journalPayload,
      session,
      draft.entityId,
    );

    draft.clearingTransactionId = transaction._id;
    await draft.save({ session });

    if (draft.direction === "RECEIVED") {
      // Activate the linked Revenue document — it was recognised at receipt (PENDING_CHEQUE),
      // now confirm it is banked (RECORDED).
      if (draft.referenceType === "Revenue" && draft.referenceId) {
        await Revenue.findByIdAndUpdate(
          draft.referenceId,
          { $set: { status: "RECORDED" } },
          { session },
        );
      }

      // Bank balance increases when the received cheque physically clears.
      if (draft.bankAccountCode) {
        const bankAccount = await BankAccount.findOne({
          accountCode: draft.bankAccountCode,
          isDeleted: { $ne: true },
        }).session(session);
        if (bankAccount) {
          bankAccount.balancePaisa += draft.amountPaisa;
          await bankAccount.save({ session });
        }
      }
    } else {
      // ISSUED: bank balance decreases when the issued cheque clears the bank.
      if (draft.bankAccountCode) {
        const bankAccount = await BankAccount.findOne({
          accountCode: draft.bankAccountCode,
          isDeleted: { $ne: true },
        }).session(session);
        if (bankAccount) {
          bankAccount.balancePaisa -= draft.amountPaisa;
          await bankAccount.save({ session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return { draft: draft.toObject(), transaction };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUNCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a pending cheque as bounced and post the reversal journal.
 *
 * @param {string} id
 * @param {Object} data
 * @param {ObjectId} data.bouncedBy
 * @param {string}   data.bounceReason
 */
export async function markBounced(id, { bouncedBy, bounceReason }) {
  return _markReversed(id, "BOUNCED", {
    actorId: bouncedBy,
    reason: bounceReason,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a pending cheque as cancelled and post the reversal journal.
 *
 * @param {string} id
 * @param {Object} data
 * @param {ObjectId} data.cancelledBy
 * @param {string}   [data.cancelReason]
 */
export async function markCancelled(id, { cancelledBy, cancelReason }) {
  return _markReversed(id, "CANCELLED", {
    actorId: cancelledBy,
    reason: cancelReason,
  });
}

/**
 * Shared reversal logic for BOUNCED and CANCELLED.
 */
async function _markReversed(id, newStatus, { actorId, reason }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const draft = await ChequeDraft.findOneAndUpdate(
      { _id: id, status: "PENDING" },
      { $set: { status: newStatus } },
      { session, new: true },
    );

    if (!draft) {
      throw new Error(
        `ChequeDraft ${id} not found or is not in PENDING status`,
      );
    }

    if (newStatus === "BOUNCED") draft.bounceReason = reason ?? null;

    // Both directions post a reversal journal.
    //
    // RECEIVED reversal (reverses DR 1150 / CR Revenue from receipt):
    //   DR Revenue (4xxx) / CR 1150 Cheques In Hand
    //   Bank is NOT touched — the cheque never reached the bank.
    //
    // ISSUED reversal (reverses DR Expense / CR 2150 from issue):
    //   DR 2150 Cheques Payable / CR Expense (5xxx)
    //   Bank is NOT touched — the cheque never cleared the bank.
    const draftForJournal = { ...draft.toObject(), status: newStatus };
    const journalPayload = buildChequeBounceJournal(draftForJournal);
    const { transaction } = await ledgerService.postJournalEntry(
      journalPayload,
      session,
      draft.entityId,
    );
    draft.reversalTransactionId = transaction._id;

    if (draft.direction === "RECEIVED") {
      // Void the linked Revenue document.
      if (draft.referenceType === "Revenue" && draft.referenceId) {
        await Revenue.findByIdAndUpdate(
          draft.referenceId,
          { $set: { status: "REVERSED" } },
          { session },
        );
      }
    }

    await draft.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { draft: draft.toObject(), transaction };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paginated list of cheque drafts.
 *
 * @param {Object} filters
 * @param {string}  [filters.entityId]
 * @param {string}  [filters.status]      — PENDING | DEPOSITED | BOUNCED | CANCELLED
 * @param {string}  [filters.direction]   — ISSUED | RECEIVED
 * @param {number}  [filters.nepaliYear]
 * @param {number}  [filters.nepaliMonth]
 * @param {number}  [filters.page=1]
 * @param {number}  [filters.limit=20]
 */
export async function getChequeDrafts(filters = {}) {
  const {
    entityId,
    status,
    direction,
    nepaliYear,
    nepaliMonth,
    page = 1,
    limit = 20,
  } = filters;

  const query = {};
  if (entityId) query.entityId = entityId;
  if (status) query.status = status;
  if (direction) query.direction = direction;
  if (nepaliYear) query.nepaliYear = Number(nepaliYear);
  if (nepaliMonth) query.nepaliMonth = Number(nepaliMonth);

  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const [drafts, total] = await Promise.all([
    ChequeDraft.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ChequeDraft.countDocuments(query),
  ]);

  return {
    drafts,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  };
}

/**
 * Single cheque draft by ID.
 */
export async function getChequeDraftById(id) {
  const draft = await ChequeDraft.findById(id).lean();
  if (!draft) throw new Error(`ChequeDraft ${id} not found`);
  return draft;
}

/**
 * Summary KPI figures for the dashboard banner.
 *
 * Returns pending counts and amounts split by direction.
 *
 * @param {string} entityId
 */
export async function getChequeDraftSummary(entityId) {
  if (!entityId) throw new Error("entityId is required");

  const agg = await ChequeDraft.aggregate([
    {
      $match: {
        entityId: new mongoose.Types.ObjectId(entityId),
        status: "PENDING",
      },
    },
    {
      $group: {
        _id: "$direction",
        count: { $sum: 1 },
        totalAmountPaisa: { $sum: "$amountPaisa" },
      },
    },
  ]);

  const result = {
    pendingIssued: { count: 0, totalAmountPaisa: 0 },
    pendingReceived: { count: 0, totalAmountPaisa: 0 },
  };

  for (const row of agg) {
    if (row._id === "ISSUED") {
      result.pendingIssued = {
        count: row.count,
        totalAmountPaisa: row.totalAmountPaisa,
      };
    } else if (row._id === "RECEIVED") {
      result.pendingReceived = {
        count: row.count,
        totalAmountPaisa: row.totalAmountPaisa,
      };
    }
  }

  return result;
}
