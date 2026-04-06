/**
 * liabilty.service.js  (UPDATED)
 * ─────────────────────────────────────────────────────────────────────────────
 * ADDED: getLoanLiabilities() — for the Loans page to optionally surface
 *        liability tracking data (outstanding balance, loanStatus) without
 *        joining the Loan collection directly.
 *
 * Existing createLiability() is unchanged.
 */

import { Liability } from "./Liabilities.Model.js";
import { LiabilitySource } from "./LiabilitesSource.Model.js";
import Admin from "../auth/admin.Model.js";
import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// createLiability
// ─────────────────────────────────────────────────────────────────────────────
async function createLiability(liabilityData) {
  try {
    const {
      source,
      amountPaisa,
      originalAmountPaisa,
      date,
      englishDate,
      nepaliDate,
      nepaliYear,
      nepaliMonth,
      payeeType,
      tenant,
      externalPayee,
      referenceType,
      referenceId,
      loanStatus,
      status,
      notes,
      createdBy,
      entityId,
      blockId,
      transactionScope,
      session,
    } = liabilityData;

    // Accept either ObjectId or source code (e.g., "SECURITY_DEPOSIT", "LOAN")
    const isObjectId = mongoose.Types.ObjectId.isValid(source);
    const liabilitySource = isObjectId
      ? await LiabilitySource.findById(source)
      : await LiabilitySource.findOne({ code: source });

    if (!liabilitySource) {
      throw new Error(`Liability source not found: ${source}`);
    }

    const existingAdmin = await Admin.findById(createdBy);
    if (!existingAdmin) {
      throw new Error("Admin not found");
    }

    const createOpts = session ? { session } : {};
    const doc = {
      source: liabilitySource._id,
      amountPaisa,
      originalAmountPaisa: originalAmountPaisa ?? null,
      englishDate: englishDate ?? date ?? new Date(), // accept new or legacy field name
      nepaliDate: nepaliDate ?? null,
      nepaliYear: nepaliYear ?? null,
      nepaliMonth: nepaliMonth ?? null,
      payeeType: payeeType === "tenant" ? "TENANT" : payeeType,
      tenant,
      externalPayee: externalPayee ?? undefined,
      referenceType,
      referenceId,
      loanStatus: loanStatus ?? null,
      status,
      notes,
      createdBy,
      entityId: entityId ?? null,
      blockId: blockId ?? null,
      transactionScope: transactionScope ?? "building",
    };

    const created = await Liability.create(session ? [doc] : doc, createOpts);
    const liability = Array.isArray(created) ? created[0] : created;

    return {
      success: true,
      message: "Liability created successfully",
      data: liability,
    };
  } catch (error) {
    console.error("Failed to create liability:", error);
    return {
      success: false,
      message: "Failed to create liability",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getLoanLiabilities
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return all Liability documents where referenceType === "LOAN".
 * Useful for the Liabilities page to show loan-originated obligations
 * alongside vendor payables, salary payables, etc.
 *
 * Each document carries:
 *   amountPaisa         — current outstanding principal
 *   originalAmountPaisa — original principal at disbursement
 *   loanStatus          — mirrors Loan.status (ACTIVE / CLOSED / DEFAULTED)
 *   referenceId         — Loan._id (can be populated for full loan detail)
 *
 * @param {Object} filters
 * @param {string} [filters.loanStatus]  — "ACTIVE" | "CLOSED" | "DEFAULTED"
 * @returns {Array<Liability>}
 */
async function getLoanLiabilities(filters = {}) {
  const query = { referenceType: "LOAN" };
  if (filters.loanStatus) query.loanStatus = filters.loanStatus.toUpperCase();

  return Liability.find(query)
    .populate("source", "name code")
    .sort({ createdAt: -1 })
    .lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllLiabilities
// ─────────────────────────────────────────────────────────────────────────────
/**
 * All liabilities, grouped by referenceType for the Liabilities dashboard.
 */
async function getAllLiabilities(filters = {}) {
  const query = {};
  if (filters.referenceType) query.referenceType = filters.referenceType;
  if (filters.status) query.status = filters.status;
  if (filters.payeeType) query.payeeType = filters.payeeType.toUpperCase();
  if (filters.nepaliYear) query.nepaliYear = Number(filters.nepaliYear);
  if (filters.nepaliMonth) query.nepaliMonth = Number(filters.nepaliMonth);
  // Accept legacy npYear/npMonth query params (backwards compat during migration)
  if (filters.npYear) query.nepaliYear = Number(filters.npYear);
  if (filters.npMonth) query.nepaliMonth = Number(filters.npMonth);

  return Liability.find(query)
    .populate("source", "name code category")
    .populate("tenant", "name phone")
    .sort({ englishDate: -1 })
    .lean();
}

export { createLiability, getLoanLiabilities, getAllLiabilities };
