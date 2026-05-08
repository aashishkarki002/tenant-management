/**
 * adjustment.service.js
 *
 * Handles posting of Debit Notes, Credit Notes, and Manual Journal adjustments.
 */

import mongoose from "mongoose";
import { Adjustment } from "./Adjustment.Model.js";
import { ledgerService } from "../ledger.service.js";
import { auditService } from "../../audit/audit.service.js";
import { buildAdjustmentJournal } from "../journal-builders/adjustment.js";
import NepaliDate from "nepali-datetime";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";

class AdjustmentService {
  /**
   * Post an adjustment.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.entityId
   * @param {"DEBIT_NOTE"|"CREDIT_NOTE"|"MANUAL_JOURNAL"} params.type
   * @param {number}          [params.amountPaisa]   Required for DEBIT_NOTE / CREDIT_NOTE
   * @param {string}          [params.revenueAccountCode]  Default: "4000"
   * @param {Object[]}        [params.entries]        Required for MANUAL_JOURNAL
   * @param {string}          params.reason           Mandatory — why the adjustment
   * @param {string}          params.description      What the adjustment is
   * @param {string|ObjectId} [params.originalTransactionId]
   * @param {string|ObjectId} [params.tenantId]
   * @param {string|ObjectId} [params.propertyId]
   * @param {Date}            [params.transactionDate]  Default: now
   * @param {string|ObjectId} params.createdBy
   *
   * @returns {Promise<Adjustment>}
   */
  async postAdjustment({
    entityId,
    type,
    amountPaisa,
    revenueAccountCode,
    entries,
    reason,
    description,
    originalTransactionId,
    tenantId,
    propertyId,
    transactionDate,
    createdBy,
  }) {
    if (!reason?.trim()) {
      throw new Error("reason is required for all adjustments");
    }
    if (!description?.trim()) {
      throw new Error("description is required for all adjustments");
    }

    const txDate = transactionDate
      ? new Date(transactionDate)
      : new Date();
    const nd         = new NepaliDate(txDate);
    const nepaliYear  = nd.getYear();
    const nepaliMonth = nd.getMonth() + 1;
    const nepaliDate  = formatNepaliISO(nd);

    // Create adjustment doc first (gets the _id for journal referenceId)
    const adjustment = await Adjustment.create({
      entityId,
      type,
      originalTransactionId: originalTransactionId ?? null,
      reason,
      description,
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      transactionDate: txDate,
      amountPaisa:          (type !== "MANUAL_JOURNAL") ? amountPaisa : null,
      revenueAccountCode:   revenueAccountCode ?? null,
      manualEntries:        (type === "MANUAL_JOURNAL") ? entries : [],
      tenant:   tenantId   ?? null,
      property: propertyId ?? null,
      createdBy,
      status: "APPROVED",
    });

    // Post journal
    const session = await mongoose.startSession();
    let txId;
    try {
      await session.withTransaction(async () => {
        const payload = buildAdjustmentJournal({
          adjustmentId: adjustment._id,
          type,
          amountPaisa,
          revenueAccountCode,
          entries,
          tenantId,
          propertyId,
          nepaliMonth,
          nepaliYear,
          transactionDate: txDate,
          description,
          createdBy,
          entityId,
        });

        const { transaction } = await ledgerService.postJournalEntry(
          payload, session, entityId,
        );
        txId = transaction._id;

        await Adjustment.findByIdAndUpdate(
          adjustment._id,
          { transactionId: txId },
          { session },
        );
      });
    } catch (err) {
      // Roll back the adjustment doc if journal fails
      await Adjustment.findByIdAndDelete(adjustment._id);
      throw err;
    } finally {
      await session.endSession();
    }

    // Audit log
    const eventType = type === "DEBIT_NOTE"
      ? "DEBIT_NOTE_POSTED"
      : type === "CREDIT_NOTE"
        ? "CREDIT_NOTE_POSTED"
        : "ADJUSTMENT_POSTED";

    await auditService.log(eventType, createdBy, {
      entityId,
      resourceType: "Adjustment",
      resourceId: adjustment._id,
      amountPaisa: amountPaisa ?? null,
      reason,
    });

    return Adjustment.findById(adjustment._id)
      .populate("createdBy", "name email")
      .lean();
  }

  /**
   * List adjustments for an entity.
   *
   * @param {Object} filters
   * @param {string|ObjectId} filters.entityId
   * @param {string}          [filters.type]
   * @param {string|ObjectId} [filters.tenantId]
   * @param {number}          [filters.nepaliYear]
   * @param {number}          [filters.nepaliMonth]
   * @param {number}          [filters.page]   default 1
   * @param {number}          [filters.limit]  default 50
   */
  async list(filters = {}) {
    const q = {};
    if (filters.entityId)  q.entityId    = filters.entityId;
    if (filters.type)      q.type        = filters.type;
    if (filters.tenantId)  q.tenant      = filters.tenantId;
    if (filters.nepaliYear)  q.nepaliYear  = Number(filters.nepaliYear);
    if (filters.nepaliMonth) q.nepaliMonth = Number(filters.nepaliMonth);

    const page  = Math.max(1, parseInt(filters.page  ?? 1, 10));
    const limit = Math.min(200, Math.max(1, parseInt(filters.limit ?? 50, 10)));
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Adjustment.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy",  "name email")
        .populate("tenant",     "name email")
        .lean(),
      Adjustment.countDocuments(q),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }
}

export const adjustmentService = new AdjustmentService();
