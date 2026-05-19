/**
 * documentNumber.service.js
 *
 * Centralised, atomic document number generator.
 *
 * Public API:
 *   generateDocumentNumber(type, options)    — main entry point
 *   peekNextNumber(type, options)            — preview without incrementing (audit/UI)
 *   getCounterStats(entityId)               — admin dashboard stats
 *
 * Generated format:
 *   Standard:        {PREFIX}-{FISCAL_YEAR}-{PADDED_SEQ}
 *   Entity-prefixed: {ENTITY_PREFIX}-{PREFIX}-{FISCAL_YEAR}-{PADDED_SEQ}
 *
 * Examples:
 *   RCPT-2082-000001
 *   INV-2082-000042
 *   SH-RCPT-2082-000007   (with entityPrefix: "SH")
 *
 * Concurrency safety:
 *   Uses MongoDB findOneAndUpdate with $inc — atomic, no read-then-write race.
 *   Safe under high concurrency and within MongoDB transactions.
 *
 * Fiscal year reset:
 *   Each counter is scoped to a fiscalYear. A new counter document is created
 *   automatically when a new fiscal year is encountered.
 *   resetOn: "never" counters grow monotonically across years.
 */

import mongoose from "mongoose";
import { DocumentCounter } from "./DocumentCounter.Model.js";

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT TYPE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registry of all supported document types.
 * Add new types here — do NOT hardcode elsewhere.
 */
export const DOCUMENT_TYPES = {
  RCPT: "RCPT", // Payment Receipt
  INV: "INV",   // Rent Invoice
  CAM: "CAM",   // CAM Charge Invoice
  ELEC: "ELEC", // Electricity Bill
  JV: "JV",     // Journal Voucher
  CN: "CN",     // Credit Note
  DN: "DN",     // Debit Note
  EXP: "EXP",   // Expense Voucher
};

const TYPE_CONFIG = {
  RCPT: { paddingLength: 6, resetOn: "fiscal_year" },
  INV:  { paddingLength: 6, resetOn: "fiscal_year" },
  CAM:  { paddingLength: 6, resetOn: "fiscal_year" },
  ELEC: { paddingLength: 6, resetOn: "fiscal_year" },
  JV:   { paddingLength: 6, resetOn: "fiscal_year" },
  CN:   { paddingLength: 6, resetOn: "fiscal_year" },
  DN:   { paddingLength: 6, resetOn: "fiscal_year" },
  EXP:  { paddingLength: 6, resetOn: "fiscal_year" },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the composite counter key.
 * Format: "{prefix}:{fiscalYear}:{entityScope}"
 * entityScope = entityId.toString() or "__global__"
 */
function buildKey(prefix, fiscalYear, entityId) {
  const scope = entityId ? entityId.toString() : "__global__";
  return `${prefix}:${fiscalYear}:${scope}`;
}

/**
 * Zero-pad a number to the required length.
 * @param {number} value
 * @param {number} length
 * @returns {string}
 */
function padSequence(value, length) {
  return String(value).padStart(length, "0");
}

/**
 * Assemble the final document number string.
 * @param {string}  prefix
 * @param {number}  fiscalYear
 * @param {number}  sequence
 * @param {number}  paddingLength
 * @param {string}  [entityPrefix]  — optional entity-level prefix (e.g. "SH")
 * @returns {string}
 */
function formatDocumentNumber(prefix, fiscalYear, sequence, paddingLength, entityPrefix) {
  const seq = padSequence(sequence, paddingLength);
  return entityPrefix
    ? `${entityPrefix}-${prefix}-${fiscalYear}-${seq}`
    : `${prefix}-${fiscalYear}-${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — generateDocumentNumber
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the next document number for the given type and fiscal year.
 * Atomically increments the counter — safe under concurrent requests.
 *
 * @param {string} type
 *   One of DOCUMENT_TYPES keys: "RCPT" | "INV" | "ELEC" | "JV" | "CN" | "DN" | "EXP"
 *
 * @param {Object} options
 * @param {number}  options.fiscalYear     — Nepali BS year (e.g. 2082). Required.
 * @param {string}  [options.entityId]     — ObjectId string. Scopes counter per entity.
 * @param {string}  [options.entityPrefix] — Short code prepended to number (e.g. "SH").
 * @param {mongoose.ClientSession} [options.session] — Pass active session for transaction safety.
 *
 * @returns {Promise<string>} Generated document number, e.g. "RCPT-2082-000001"
 *
 * @throws {Error} If type is not registered.
 * @throws {Error} If fiscalYear is missing or invalid.
 */
export async function generateDocumentNumber(type, options = {}) {
  const { fiscalYear, entityId = null, entityPrefix = null, session = null } = options;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!DOCUMENT_TYPES[type]) {
    throw new Error(
      `Unknown document type "${type}". Valid types: ${Object.keys(DOCUMENT_TYPES).join(", ")}`,
    );
  }
  if (!fiscalYear || !Number.isInteger(fiscalYear) || fiscalYear < 2070) {
    throw new Error(
      `fiscalYear must be a valid Nepali BS year (integer ≥ 2070), got: ${fiscalYear}`,
    );
  }

  const config = TYPE_CONFIG[type];
  const prefix = type; // prefix === type by default; can be overridden in future
  const key = buildKey(prefix, fiscalYear, entityId);

  // ── Atomic increment ───────────────────────────────────────────────────────
  // findOneAndUpdate with upsert=true:
  //   - If counter exists: atomically increment currentValue, return NEW doc.
  //   - If counter doesn't exist: create with currentValue=1 (first doc), return NEW doc.
  //
  // The $inc on currentValue and $setOnInsert for initial metadata happen in
  // a single atomic server-side operation.
  const queryOptions = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) queryOptions.session = session;

  const counter = await DocumentCounter.findOneAndUpdate(
    { key },
    {
      $inc: { currentValue: 1 },
      $setOnInsert: {
        key,
        documentType: type,
        prefix,
        fiscalYear,
        entityId: entityId ? new mongoose.Types.ObjectId(entityId) : null,
        paddingLength: config.paddingLength,
        resetOn: config.resetOn,
      },
    },
    queryOptions,
  );

  return formatDocumentNumber(
    prefix,
    fiscalYear,
    counter.currentValue,
    counter.paddingLength,
    entityPrefix,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PEEK — preview without consuming a sequence number
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preview the NEXT document number without incrementing the counter.
 * Use in UI previews or admin reports — never for actual document creation.
 *
 * @param {string} type
 * @param {Object} options  — same as generateDocumentNumber
 * @returns {Promise<string>}
 */
export async function peekNextNumber(type, options = {}) {
  const { fiscalYear, entityId = null, entityPrefix = null } = options;

  if (!DOCUMENT_TYPES[type]) {
    throw new Error(`Unknown document type "${type}"`);
  }

  const config = TYPE_CONFIG[type];
  const prefix = type;
  const key = buildKey(prefix, fiscalYear, entityId);

  const counter = await DocumentCounter.findOne({ key }).lean();
  const nextValue = counter ? counter.currentValue + 1 : 1;
  const paddingLength = counter?.paddingLength ?? config.paddingLength;

  return formatDocumentNumber(prefix, fiscalYear, nextValue, paddingLength, entityPrefix);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS — admin dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all counters for an entity (or global counters if no entityId).
 * Used in admin dashboards and audit reports.
 *
 * @param {string} [entityId]
 * @returns {Promise<Array>}
 */
export async function getCounterStats(entityId) {
  const query = entityId
    ? { entityId: new mongoose.Types.ObjectId(entityId) }
    : { entityId: null };

  return DocumentCounter.find(query).sort({ documentType: 1, fiscalYear: -1 }).lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — manually set counter value (migration / correction use only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Force-set a counter to a specific value.
 * USE ONLY for migrations or correcting sequence gaps.
 * Logs a warning — this operation should always be audited.
 *
 * @param {string} type
 * @param {Object} options
 * @param {number}  options.fiscalYear
 * @param {string}  [options.entityId]
 * @param {number}  options.value  — new currentValue (must be ≥ existing value)
 * @returns {Promise<DocumentCounter>}
 */
export async function setCounterValue(type, options = {}) {
  const { fiscalYear, entityId = null, value } = options;

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`value must be a non-negative integer, got: ${value}`);
  }

  const prefix = type;
  const key = buildKey(prefix, fiscalYear, entityId);

  console.warn(
    `[documentNumber.service] setCounterValue called — type=${type} fiscalYear=${fiscalYear} entityId=${entityId} value=${value}. Audit this operation.`,
  );

  const counter = await DocumentCounter.findOneAndUpdate(
    { key },
    {
      $set: { currentValue: value },
      $setOnInsert: {
        key,
        documentType: type,
        prefix,
        fiscalYear,
        entityId: entityId ? new mongoose.Types.ObjectId(entityId) : null,
        paddingLength: TYPE_CONFIG[type]?.paddingLength ?? 6,
        resetOn: TYPE_CONFIG[type]?.resetOn ?? "fiscal_year",
      },
    },
    { upsert: true, new: true },
  );

  return counter;
}
