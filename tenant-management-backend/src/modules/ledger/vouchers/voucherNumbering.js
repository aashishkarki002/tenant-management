import mongoose from "mongoose";
import { VoucherCounter, TRANSACTION_TO_VOUCHER_TYPE, VOUCHER_TYPES } from "./VoucherCounter.Model.js";

/**
 * Resolve the voucherType for a given transaction type.
 *
 * _REVERSAL suffix is stripped before lookup so that reversed entries
 * share the same voucher type category as the original
 * (e.g. RENT_CHARGE_REVERSAL → RINV).
 *
 * Returns null for unknown types — unknown types do not get a voucherNo.
 *
 * @param {string} transactionType
 * @returns {string|null}
 */
export function resolveVoucherType(transactionType) {
  if (!transactionType) return null;
  const base = transactionType.endsWith("_REVERSAL")
    ? transactionType.slice(0, -9)
    : transactionType;
  return TRANSACTION_TO_VOUCHER_TYPE[base] ?? null;
}

/**
 * Atomically increment the sequence counter and return the next voucher number.
 *
 * Uses findOneAndUpdate + $inc + upsert — safe under concurrent writes.
 * Requires a Mongoose session when called inside a transaction so the counter
 * increment rolls back if the outer transaction aborts.
 *
 * Format: {VOUCHER_TYPE}-{sequence zero-padded to 4 digits}
 *   e.g. RINV-0001, CAM-0042, JV-0007
 *
 * When sequence exceeds 9999, padding is dropped: RINV-10000.
 *
 * @param {string|mongoose.Types.ObjectId} entityId
 * @param {string}                         voucherType  — must be in VOUCHER_TYPES
 * @param {mongoose.ClientSession|null}    [session]
 * @returns {Promise<string>}  e.g. "RINV-0001"
 */
export async function generateVoucherNo(entityId, voucherType, session = null) {
  if (!entityId) throw new Error("generateVoucherNo: entityId is required");
  if (!VOUCHER_TYPES.includes(voucherType)) {
    throw new Error(`generateVoucherNo: unknown voucherType "${voucherType}"`);
  }

  const opts = { upsert: true, new: true };
  if (session) opts.session = session;

  const counter = await VoucherCounter.findOneAndUpdate(
    {
      entityId: new mongoose.Types.ObjectId(String(entityId)),
      voucherType,
    },
    { $inc: { lastSequence: 1 } },
    opts,
  ).lean();

  const seq = counter.lastSequence;
  const padded = String(seq).padStart(4, "0");
  return `${voucherType}-${padded}`;
}

/**
 * Assign a voucherNo and voucherType to a transaction payload before creation.
 * Returns { voucherNo, voucherType } or { voucherNo: null, voucherType: null }
 * if the transaction type has no voucher mapping.
 *
 * @param {string}                         transactionType
 * @param {string|mongoose.Types.ObjectId} entityId
 * @param {mongoose.ClientSession|null}    [session]
 * @returns {Promise<{ voucherNo: string|null, voucherType: string|null }>}
 */
export async function assignVoucherNumber(transactionType, entityId, session = null) {
  const voucherType = resolveVoucherType(transactionType);
  if (!voucherType) return { voucherNo: null, voucherType: null };
  const voucherNo = await generateVoucherNo(entityId, voucherType, session);
  return { voucherNo, voucherType };
}
