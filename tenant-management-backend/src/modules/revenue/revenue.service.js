/**
 * revenue.service.js — v2 (multi-entity)
 *
 * Changes from v1:
 *  - createRevenue() handles transactionScope: "building" | "split" | "head_office"
 *  - entityId threaded through to ledgerService.postJournalEntry (REQUIRED by v3 ledger)
 *  - "split" scope: posts one journal per entity allocation
 *  - "head_office" scope: entityId IS the HQ entity (no separate headOfficeEntityId)
 *  - bankAccountCode passed as 3rd arg to buildRevenueReceivedJournal so the
 *    journal debits the actual bank account (e.g. "1010-SANIMA") not generic "1000"
 *  - applyPaymentToBank() removed from createRevenue() — it was causing a phantom
 *    DR 5200 / CR bank journal on top of the revenue journal (double-post bug)
 *  - getAllRevenue() accepts optional filters
 *
 * UNCHANGED:
 *  - recordRentRevenue / recordCamRevenue / recordElectricityRevenue / recordLateFeeRevenue
 *    Called from payment services that own the session and post their own journals.
 */

import { Revenue } from "./Revenue.Model.js";
import { RevenueSource } from "./RevenueSource.Model.js";
import Admin from "../auth/admin.Model.js";
import mongoose from "mongoose";
import {
  createExternalPaymentRecord,
  createPaymentRecord,
  buildPaymentPayload,
  buildExternalPaymentPayload,
} from "../payment/payment.domain.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildRevenueReceivedJournal } from "../ledger/journal-builders/index.js";
import { ACCOUNT_CODES } from "../ledger/config/accounts.js";
import { rupeesToPaisa, formatMoney } from "../../utils/moneyUtil.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the chart-of-accounts bank code for a specific entity + payment method.
 *
 * PRIORITY ORDER:
 *   1. Explicit `bankAccountCode` string in the payload — caller knows exactly
 *      which sub-account to hit, skip the DB lookup entirely.
 *   2. Explicit `bankAccountId` — look up BankAccount by _id, verify it belongs
 *      to the target entity (safety check), return its accountCode.
 *   3. Entity-default lookup — find the single BankAccount marked isDefault:true
 *      for this entity. Useful for automated flows (e.g. split allocations) where
 *      each entity routes to its own default bank automatically.
 *   4. Fallback — cash or mobile wallet code when the payment method has no
 *      physical bank document (cash / mobile_wallet).
 *
 * WHY ENTITY-SCOPED:
 *   Building A (private entity)  → BankAccount { entityId: A, accountCode: "1010-SANIMA" }
 *   Building B (company entity)  → BankAccount { entityId: B, accountCode: "1011-NABIL" }
 *   A split revenue of Rs 15,000 posts two journals. Each entity journal must
 *   debit its OWN bank sub-account, not a shared generic code. This function
 *   is called once per entity so both journals get the right code.
 *
 * @param {Object}  params
 * @param {string|null}        params.bankAccountCode  — explicit code (highest priority)
 * @param {string|ObjectId|null} params.bankAccountId  — explicit document ID
 * @param {string|ObjectId}    params.entityId         — which entity to scope the lookup to
 * @param {string}             params.paymentMethod    — "cash"|"bank_transfer"|"cheque"|"mobile_wallet"
 * @param {mongoose.ClientSession} params.session
 *
 * @returns {Promise<string>}  resolved accountCode (e.g. "1010-SANIMA", "1000", "1050")
 */
async function resolveBankAccountCodeForEntity({
  bankAccountCode,
  bankAccountId,
  entityId,
  paymentMethod,
  session,
}) {
  // ── Priority 1: explicit code — trust the caller, skip DB ─────────────────
  if (bankAccountCode) return bankAccountCode;

  // ── Cash / wallet — no BankAccount document exists for these ─────────────
  if (paymentMethod === "cash") return ACCOUNT_CODES.CASH;
  if (paymentMethod === "mobile_wallet") return ACCOUNT_CODES.MOBILE_WALLET;

  // ── Priority 2: explicit bankAccountId ────────────────────────────────────
  if (bankAccountId) {
    const doc = await BankAccount.findById(bankAccountId)
      .select("accountCode entityId isDeleted")
      .session(session)
      .lean();

    if (!doc) throw new Error(`BankAccount not found: ${bankAccountId}`);
    if (doc.isDeleted)
      throw new Error(`BankAccount ${bankAccountId} has been deleted`);

    // Safety: verify the bank account actually belongs to the target entity.
    // Prevents accidentally posting Building A's revenue to Building B's bank.
    if (entityId && String(doc.entityId) !== String(entityId)) {
      throw new Error(
        `BankAccount ${bankAccountId} (${doc.accountCode}) belongs to entity ` +
          `${doc.entityId}, not ${entityId}. ` +
          `Use the correct bankAccountId for this entity, or pass bankAccountCode explicitly.`,
      );
    }

    return doc.accountCode;
  }

  // ── Priority 3: entity-default bank account ───────────────────────────────
  // Useful for split allocations: each entity resolves its own default bank
  // automatically without the caller needing to specify per-entity bank IDs.
  if (entityId) {
    const defaultBank = await BankAccount.findOne({
      entityId,
      isDefault: true,
      isDeleted: false,
    })
      .select("accountCode")
      .session(session)
      .lean();

    if (defaultBank) return defaultBank.accountCode;

    // No default set — fall back to the first active bank for this entity
    const anyBank = await BankAccount.findOne({
      entityId,
      isDeleted: false,
    })
      .select("accountCode")
      .session(session)
      .lean();

    if (anyBank) return anyBank.accountCode;
  }

  // ── Priority 4: last-resort cash fallback ─────────────────────────────────
  // Should only be reached for legacy data or misconfigured entities.
  console.warn(
    `resolveBankAccountCodeForEntity: no bank account found for entity ${entityId} ` +
      `with paymentMethod "${paymentMethod}". Falling back to CASH (1000). ` +
      `Ensure the entity has at least one BankAccount document.`,
  );
  return ACCOUNT_CODES.CASH;
}

function rebuildJournalFromRevenue(revenue) {
  const description =
    revenue.payerType === "EXTERNAL"
      ? `Revenue from ${revenue.externalPayer?.name}`
      : "Manual revenue received";
  return buildRevenueReceivedJournal(
    revenue,
    {
      amountPaisa: revenue.amountPaisa,
      paymentDate: revenue.date,
      description,
      createdBy: revenue.createdBy,
      nepaliMonth: revenue.npMonth,
      nepaliYear: revenue.npYear,
    },
    // No bankAccountCode available on reversal — fall back to generic
    ACCOUNT_CODES.CASH_BANK,
  );
}

/**
 * Build and post the journal entry for a single entity's share of a revenue event.
 *
 * bankAccountCode is resolved here per-entity via resolveBankAccountCodeForEntity()
 * so split transactions correctly debit each entity's own bank sub-account rather
 * than a single shared code from the top-level payload.
 *
 * Example:
 *   Building A (private)  → BankAccount { entityId: A, isDefault: true, accountCode: "1010-SANIMA" }
 *   Building B (company)  → BankAccount { entityId: B, isDefault: true, accountCode: "1011-NABIL" }
 *   A split revenue posts two journals, each debiting its own entity's bank.
 *
 * @param {Object}               params
 * @param {Object}               params.revenue           — saved Revenue document (plain object)
 * @param {string|ObjectId}      params.entityId
 * @param {number}               params.amountPaisa
 * @param {string|null}          params.bankAccountCode   — explicit code; skips DB lookup if provided
 * @param {string|ObjectId|null} params.bankAccountId     — BankAccount._id; used for entity-verified lookup
 * @param {string}               params.paymentMethod     — drives fallback logic in resolver
 * @param {Date}                 params.date
 * @param {string}               params.description
 * @param {string|ObjectId}      params.createdBy
 * @param {string|null}          params.nepaliDate        — BS "YYYY-MM-DD" string
 * @param {number}               params.nepaliMonth
 * @param {number}               params.nepaliYear
 * @param {mongoose.ClientSession} params.session
 */
async function postRevenueJournalForEntity({
  revenue,
  entityId,
  amountPaisa,
  bankAccountCode,
  bankAccountId,
  paymentMethod,
  date,
  description,
  createdBy,
  nepaliDate,
  nepaliMonth,
  nepaliYear,
  session,
}) {
  // Resolve the correct bank sub-account code scoped to THIS specific entity.
  // For split transactions each allocation independently resolves its own entity's
  // default bank, so no caller coordination is needed.
  const resolvedCode = await resolveBankAccountCodeForEntity({
    bankAccountCode,
    bankAccountId,
    entityId,
    paymentMethod,
    session,
  });

  const journalPayload = buildRevenueReceivedJournal(
    revenue,
    {
      paymentMethod,
      amountPaisa,
      paymentDate: date,
      nepaliDate,
      description,
      createdBy,
      nepaliMonth,
      nepaliYear,
    },
    resolvedCode,
  );

  // Guarantee BS date fields survive into the ledger regardless of builder behaviour
  if (nepaliDate) journalPayload.nepaliDate = nepaliDate;
  if (nepaliMonth) journalPayload.nepaliMonth = nepaliMonth;
  if (nepaliYear) journalPayload.nepaliYear = nepaliYear;

  return ledgerService.postJournalEntry(journalPayload, session, entityId);
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE REVENUE — main entry point
// ─────────────────────────────────────────────────────────────────────────────

async function createRevenue(revenueData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      source,
      amountPaisa,
      amount, // BUG 1 FIX: destructure for backward compat
      date = new Date(),
      payerType,
      tenant,
      externalPayer,
      referenceType = "MANUAL", // BUG 5 FIX: restore default
      referenceId,
      status = "RECORDED", // BUG 5 FIX: restore default
      notes,
      createdBy,
      adminId,
      nepaliDate,
      paymentMethod = "bank_transfer", // BUG 6 FIX: restore default
      bankAccountId,
      bankAccountCode, // BUG 3 FIX: destructure from payload
      // ── Multi-entity scope ──────────────────────────────
      transactionScope,
      entityId,
      propertyId,
      splitAllocations,
      blockId,
    } = revenueData;

    // ── Scope validation ────────────────────────────────────────────────────
    const scope = transactionScope ?? "building";
    if (!["building", "split", "head_office"].includes(scope)) {
      throw new Error(`Invalid transactionScope: ${scope}`);
    }

    // entityId is always required — it identifies the owning entity for every revenue
    if (!entityId) {
      throw new Error("entityId is required for all revenue records");
    }

    // ── Amount ──────────────────────────────────────────────────────────────
    // BUG 1 FIX: `amount` is now destructured above so this ternary is safe
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;

    if (!finalAmountPaisa || finalAmountPaisa <= 0) {
      throw new Error("Valid amount is required");
    }

    // ── Basic validations ───────────────────────────────────────────────────
    if (!source) throw new Error("Revenue source is required");
    if (!payerType) throw new Error("payerType is required");

    if (payerType === "TENANT" && !tenant) {
      throw new Error("Tenant is required for TENANT revenue");
    }
    if (payerType === "EXTERNAL") {
      if (!externalPayer?.name || !externalPayer?.type) {
        throw new Error("External payer name and type are required");
      }
    }

    // ── Scope-specific validations ──────────────────────────────────────────
    if (scope === "split") {
      if (!splitAllocations?.length) {
        throw new Error(
          'splitAllocations is required when transactionScope is "split"',
        );
      }
      const totalPct = splitAllocations.reduce(
        (s, a) => s + (a.percentage || 0),
        0,
      );
      if (Math.round(totalPct) !== 100) {
        throw new Error(
          `Split allocations must sum to 100%, got ${totalPct.toFixed(2)}%`,
        );
      }
      const totalAllocated = splitAllocations.reduce(
        (s, a) => s + (a.amountPaisa || 0),
        0,
      );
      if (totalAllocated !== finalAmountPaisa) {
        throw new Error(
          `Split allocation amounts (${formatMoney(totalAllocated)}) ` +
            `do not sum to total revenue (${formatMoney(finalAmountPaisa)})`,
        );
      }
    }

    // ── Validate references ─────────────────────────────────────────────────
    const revenueSource = await RevenueSource.findById(source).session(session);
    if (!revenueSource) throw new Error("Revenue source not found");

    const admin = await Admin.findById(createdBy || adminId).session(session);
    if (!admin) throw new Error("Admin not found");

    // NOTE: applyPaymentToBank() intentionally removed.
    // It was posting its own DR/CR journal (DR 5200 / CR bank) which created
    // phantom entries on top of the revenue journal — a double-post bug.
    // The revenue journal builder handles the bank debit side via bankAccountCode.

    // ── Validate paymentMethod early ────────────────────────────────────────
    // Guard here so callers get a clear error before reaching the payment
    // builder's assertValidPaymentMethod(), which emits a cryptic "undefined"
    // message when paymentMethod is missing or misspelled.
    const VALID_PAYMENT_METHODS = [
      "cash",
      "bank_transfer",
      "cheque",
      "mobile_wallet",
    ];
    const resolvedPaymentMethod = paymentMethod ?? "bank_transfer";
    if (!VALID_PAYMENT_METHODS.includes(resolvedPaymentMethod)) {
      throw new Error(
        `Invalid payment method: "${resolvedPaymentMethod}". ` +
          `Must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
      );
    }

    // ── Create payment record ───────────────────────────────────────────────
    let payment = null;

    if (payerType === "TENANT") {
      const paymentPayload = buildPaymentPayload({
        tenantId: tenant,
        amountPaisa: finalAmountPaisa,
        paymentDate: date,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: "paid",
        note: notes,
        nepaliDate: nepaliDate || null,
        adminId: createdBy || adminId,
        bankAccountId,
      });
      payment = await createPaymentRecord(paymentPayload, session);
    } else if (payerType === "EXTERNAL") {
      const externalPayload = buildExternalPaymentPayload({
        payerName: externalPayer.name,
        amountPaisa: finalAmountPaisa,
        paymentDate: date,
        nepaliDate: nepaliDate || null,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: "paid",
        bankAccountId,
        note: notes,
        adminId: createdBy || adminId,
      });
      payment = await createExternalPaymentRecord(externalPayload, session);
    }

    // ── Build Revenue document ──────────────────────────────────────────────
    const nepaliFields = getNepaliYearMonthFromDate(date);

    const revenueDoc = {
      source,
      amountPaisa: finalAmountPaisa,
      date,
      ...nepaliFields,
      payerType,
      tenant: payerType === "TENANT" ? tenant : undefined,
      externalPayer: payerType === "EXTERNAL" ? externalPayer : undefined,
      referenceType,
      referenceId,
      status,
      notes,
      createdBy: createdBy || adminId,
      transactionScope: scope,
    };

    // entityId is always set — every revenue must know its owner
    revenueDoc.entityId = entityId;

    if (scope === "building") {
      revenueDoc.propertyId = propertyId;
      if (!blockId) {
        throw new Error("blockId is required for building-scoped revenue");
      }
      revenueDoc.blockId = new mongoose.Types.ObjectId(blockId);
    } else if (scope === "split") {
      revenueDoc.splitAllocations = splitAllocations;
    }
    // head_office: no extra fields needed — entityId IS the HQ entity

    // ── Persist Revenue document ────────────────────────────────────────────
    const [revenue] = await Revenue.create([revenueDoc], { session });

    // ── Post journal entries ────────────────────────────────────────────────
    const ledgerDescription =
      payerType === "EXTERNAL"
        ? `Revenue from ${externalPayer.name}`
        : "Manual revenue received";

    // journalBase carries the fields shared across all scope types.
    // bankAccountCode and bankAccountId are passed here so postRevenueJournalForEntity
    // can call resolveBankAccountCodeForEntity() scoped to each specific entityId.
    //
    // For "building" / "head_office": the single entity's bank is resolved.
    // For "split": each allocation independently resolves its own entity's default
    //   bank account — no per-allocation bankAccountId needed from the caller.
    //   The caller may optionally put a bankAccountId on each allocation object
    //   (see allocation.bankAccountId below) to override the entity default.
    const journalBase = {
      revenue: revenue.toObject(),
      bankAccountCode, // explicit code — highest priority in resolver
      bankAccountId, // explicit doc ID — used if code is absent
      paymentMethod: resolvedPaymentMethod, // drives fallback logic in resolver
      date,
      description: ledgerDescription,
      createdBy: createdBy || adminId,
      nepaliDate: nepaliDate || null,
      nepaliMonth: nepaliFields.npMonth,
      nepaliYear: nepaliFields.npYear,
      session,
    };

    if (scope === "building") {
      const { transaction } = await postRevenueJournalForEntity({
        ...journalBase,
        entityId,
        amountPaisa: finalAmountPaisa,
      });
      revenue.transactionId = transaction._id;
      await revenue.save({ session });
    } else if (scope === "head_office") {
      const { transaction } = await postRevenueJournalForEntity({
        ...journalBase,
        entityId,
        amountPaisa: finalAmountPaisa,
      });
      revenue.transactionId = transaction._id;
      await revenue.save({ session });
    } else if (scope === "split") {
      let firstTransactionId = null;

      for (const allocation of splitAllocations) {
        const { transaction, ledgerEntries } =
          await postRevenueJournalForEntity({
            ...journalBase,
            revenue: {
              ...revenue.toObject(),
              _id: new mongoose.Types.ObjectId(), // unique ref per allocation for idempotency guard
            },
            entityId: allocation.entityId,
            amountPaisa: allocation.amountPaisa,
            // Allow per-allocation bank override:
            // If the caller knows exactly which bank to use for this allocation,
            // they can set allocation.bankAccountId or allocation.bankAccountCode.
            // Otherwise, resolveBankAccountCodeForEntity() picks the entity default.
            bankAccountCode:
              allocation.bankAccountCode ?? bankAccountCode ?? null,
            bankAccountId: allocation.bankAccountId ?? bankAccountId ?? null,
          });

        if (!firstTransactionId) firstTransactionId = transaction._id;
        allocation.ledgerEntryId = ledgerEntries[0]?._id ?? null;
      }

      await Revenue.findByIdAndUpdate(
        revenue._id,
        { $set: { transactionId: firstTransactionId, splitAllocations } },
        { session },
      );
    }

    // ── Commit ──────────────────────────────────────────────────────────────
    await session.commitTransaction();
    session.endSession();

    // BUG 2 FIX: `bankAccount` removed from return — variable was never defined
    return {
      success: true,
      message: "Revenue created successfully",
      data: revenue,
      payment,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Failed to create revenue:", error);

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
      message: "Failed to create revenue",
      error: error.message,
    };
  }
}

export { createRevenue };

// ─────────────────────────────────────────────────────────────────────────────
// DELETE  →  Reverse the ledger entry + soft-delete the Revenue doc
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteRevenue(revenueId, reason, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const revenue = await Revenue.findById(revenueId).session(session);
    if (!revenue) throw new Error("Revenue not found");
    if (revenue.status === "REVERSED")
      throw new Error("Revenue is already reversed");

    const originalJournal = rebuildJournalFromRevenue(revenue);
    const reversePayload = buildRevenueReversedJournal(originalJournal, {
      adminId,
      reason,
      originalTransactionId: revenue.transactionId,
    });
    await ledgerService.postJournalEntry(reversePayload, session);

    revenue.status = "REVERSED";
    revenue.reversalReason = reason;
    revenue.reversedBy = adminId;
    revenue.reversedAt = new Date();
    await revenue.save({ session });

    await session.commitTransaction();
    session.endSession();
    return {
      success: true,
      message: "Revenue reversed successfully",
      data: revenue,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Failed to delete revenue:", error);
    return {
      success: false,
      message: "Failed to delete revenue",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

async function getRevenue(revenueId) {
  try {
    const revenue = await Revenue.findById(revenueId)
      .populate("source")
      .populate("tenant")
      .populate("createdBy")
      .populate("originalRevenue", "amountPaisa date status")
      .populate("amendedBy", "amountPaisa date status");
    if (!revenue) throw new Error("Revenue not found");
    return revenue;
  } catch (error) {
    console.error("Failed to get revenue:", error);
    throw error;
  }
}
export { getRevenue };

async function getAllRevenue(filters = {}) {
  try {
    const query = { status: { $ne: "REVERSED" } };

    if (filters.entityId)
      query.entityId = new mongoose.Types.ObjectId(filters.entityId);
    if (filters.payerType) query.payerType = filters.payerType;
    if (filters.referenceType) query.referenceType = filters.referenceType;
    if (filters.nepaliYear) query.npYear = Number(filters.nepaliYear);
    if (filters.nepaliMonth) query.npMonth = Number(filters.nepaliMonth);
    if (filters.transactionScope)
      query.transactionScope = filters.transactionScope;
    if (filters.propertyId)
      query.propertyId = new mongoose.Types.ObjectId(filters.propertyId);

    const revenue = await Revenue.find(query)
      .populate("source", "name code")
      .populate("tenant", "name")
      .populate("entityId", "name type")
      .sort({ date: -1 });

    return {
      success: true,
      message: "Revenue fetched successfully",
      data: revenue,
    };
  } catch (error) {
    console.error("Failed to get all revenue:", error);
    return {
      success: false,
      message: "Failed to get all revenue",
      error: error.message,
    };
  }
}
export { getAllRevenue };

async function getRevenueSource() {
  try {
    const revenueSource = await RevenueSource.find();
    return {
      success: true,
      message: "Revenue source fetched successfully",
      data: revenueSource,
    };
  } catch (error) {
    console.error("Failed to get revenue source:", error);
    return {
      success: false,
      message: "Failed to get revenue source",
      error: error.message,
    };
  }
}
export { getRevenueSource };

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT-SERVICE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function resolveBlockObjectId(blockRef) {
  const id = blockRef?._id ?? blockRef;
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId
    ? id
    : new mongoose.Types.ObjectId(id);
}

export async function recordRentRevenue({
  amountPaisa,
  amount,
  paymentDate,
  tenantId,
  rentId,
  note,
  adminId,
  entityId,
  blockId,
  session = null,
}) {
  try {
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;

    const rentRevenueSource = await RevenueSource.findOne({
      code: "RENT",
    }).session(session);
    if (!rentRevenueSource)
      throw new Error("Revenue source RENT not configured");

    const resolvedBlockId = resolveBlockObjectId(blockId);

    const revenue = await Revenue.create(
      [
        {
          source: rentRevenueSource._id,
          amountPaisa: finalAmountPaisa,
          amount: finalAmountPaisa / 100,
          date: paymentDate,
          ...getNepaliYearMonthFromDate(paymentDate),
          payerType: "TENANT",
          tenant: new mongoose.Types.ObjectId(tenantId),
          referenceType: "RENT",
          referenceId: new mongoose.Types.ObjectId(rentId),
          status: "RECORDED",
          notes: note,
          createdBy: new mongoose.Types.ObjectId(adminId),
          ...(entityId && { entityId: new mongoose.Types.ObjectId(entityId) }),
          ...(resolvedBlockId && { blockId: resolvedBlockId }),
        },
      ],
      { session },
    );

    return revenue[0];
  } catch (error) {
    console.error("Failed to record rent revenue:", error);
    throw error;
  }
}

export async function recordCamRevenue({
  amountPaisa,
  amount,
  paymentDate,
  tenantId,
  camId,
  note,
  adminId,
  entityId,
  blockId,
  session = null,
}) {
  try {
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;

    const camRevenueSource = await RevenueSource.findOne({
      code: "CAM",
    }).session(session);
    if (!camRevenueSource) throw new Error("Revenue source CAM not configured");

    const resolvedBlockId = resolveBlockObjectId(blockId);

    const revenue = await Revenue.create(
      [
        {
          source: camRevenueSource._id,
          amountPaisa: finalAmountPaisa,
          amount: finalAmountPaisa / 100,
          date: paymentDate,
          ...getNepaliYearMonthFromDate(paymentDate),
          payerType: "TENANT",
          tenant: new mongoose.Types.ObjectId(tenantId),
          referenceType: "CAM",
          referenceId: new mongoose.Types.ObjectId(camId),
          status: "RECORDED",
          notes: note,
          createdBy: new mongoose.Types.ObjectId(adminId),
          ...(entityId && { entityId: new mongoose.Types.ObjectId(entityId) }),
          ...(resolvedBlockId && { blockId: resolvedBlockId }),
        },
      ],
      { session },
    );

    return revenue[0];
  } catch (error) {
    console.error("Failed to record CAM revenue:", error);
    throw error;
  }
}

export async function recordElectricityRevenue({
  amountPaisa,
  paymentDate,
  tenantId,
  electricityId,
  nepaliMonth,
  nepaliYear,
  adminId,
  entityId,
  session = null,
}) {
  const utilitySource = await RevenueSource.findOneAndUpdate(
    { code: "UTILITY" },
    { $setOnInsert: { code: "UTILITY", name: "Electricity / Utility" } },
    { upsert: true, returnDocument: "after", session },
  );

  const [revenue] = await Revenue.create(
    [
      {
        source: utilitySource._id,
        amountPaisa,
        date: paymentDate,
        ...getNepaliYearMonthFromDate(paymentDate),
        payerType: "TENANT",
        tenant: new mongoose.Types.ObjectId(tenantId),
        referenceType: "ELECTRICITY",
        referenceId: new mongoose.Types.ObjectId(electricityId),
        status: "RECORDED",
        notes: `Electricity payment – ${nepaliMonth}/${nepaliYear}`,
        createdBy: new mongoose.Types.ObjectId(adminId),
        ...(entityId && { entityId: new mongoose.Types.ObjectId(entityId) }),
      },
    ],
    { session },
  );

  return revenue;
}

export async function recordLateFeeRevenue({
  amountPaisa,
  paymentDate,
  tenantId,
  rentId,
  note,
  adminId,
  entityId,
  blockId,
  session = null,
}) {
  try {
    const lateFeeRevenueSource = await RevenueSource.findOne({
      code: "LATE_FEE",
    }).session(session);
    if (!lateFeeRevenueSource)
      throw new Error("Revenue source LATE_FEE not configured");

    const resolvedBlockId = resolveBlockObjectId(blockId);

    const revenue = await Revenue.create(
      [
        {
          source: lateFeeRevenueSource._id,
          amountPaisa,
          date: paymentDate,
          ...getNepaliYearMonthFromDate(paymentDate),
          payerType: "TENANT",
          tenant: new mongoose.Types.ObjectId(tenantId),
          referenceType: "LATE_FEE",
          referenceId: new mongoose.Types.ObjectId(rentId),
          status: "RECORDED",
          notes: note,
          createdBy: new mongoose.Types.ObjectId(adminId),
          ...(entityId && { entityId: new mongoose.Types.ObjectId(entityId) }),
          ...(resolvedBlockId && { blockId: resolvedBlockId }),
        },
      ],
      { session },
    );

    return revenue[0];
  } catch (error) {
    console.error("Failed to record late fee revenue:", error);
    throw error;
  }
}
