/**
 * DocumentCounter.Model.js
 *
 * Centralised, atomic document sequence counter.
 *
 * Design principles:
 *  - ONE document per (prefix, fiscalYear, entityId) tuple.
 *  - Sequence incremented with findOneAndUpdate + $inc — never with read-then-write.
 *  - Supports fiscal-year reset (Nepali BS year boundary).
 *  - Supports entity-specific sub-sequences (same prefix, different entity).
 *  - Padding length configurable per document type.
 *
 * Supported document types:
 *   RCPT  — Payment Receipt         e.g.  RCPT-2082-000001
 *   INV   — Rent Invoice            e.g.  INV-2082-000001
 *   ELEC  — Electricity Bill        e.g.  ELEC-2082-000001
 *   JV    — Journal Voucher         e.g.  JV-2082-000001
 *   CN    — Credit Note             e.g.  CN-2082-000001
 *   DN    — Debit Note              e.g.  DN-2082-000001
 *   EXP   — Expense Voucher         e.g.  EXP-2082-000001
 *
 * Future extension:
 *   entityPrefix + type prefix → "SH-RCPT-2082-000001"
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const DocumentCounterSchema = new Schema(
  {
    /**
     * Composite lookup key — uniquely identifies this counter.
     * Format: "{prefix}:{fiscalYear}:{entityId|__global__}"
     * Example: "RCPT:2082:66a1b2c3d4e5f6a7b8c9d0e1"
     * Built and queried exclusively by documentNumber.service.js.
     */
    key: {
      type: String,
      required: [true, "key is required"],
      unique: true,
      index: true,
    },

    /** Document type code (RCPT, INV, ELEC, JV, CN, DN, EXP). */
    documentType: {
      type: String,
      enum: ["RCPT", "INV", "ELEC", "JV", "CN", "DN", "EXP"],
      required: [true, "documentType is required"],
    },

    /**
     * The prefix used in the generated number.
     * Normally equals documentType but can be overridden for entity-prefixed
     * formats: "SH-RCPT", "BKT-INV", etc.
     */
    prefix: {
      type: String,
      required: [true, "prefix is required"],
      trim: true,
    },

    /**
     * Nepali BS fiscal year this counter belongs to.
     * Counters reset to 0 at the start of each new fiscal year.
     * Set to 0 for counters that never reset.
     */
    fiscalYear: {
      type: Number,
      required: [true, "fiscalYear is required"],
      min: 2070,
    },

    /**
     * Optional entity scope.
     * null = system-wide counter (one sequence for all entities).
     * ObjectId = per-entity counter (each entity has its own sequence).
     */
    entityId: {
      type: Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      default: null,
      index: true,
    },

    /**
     * Current sequence value — last number that was issued.
     * Starts at 0; first document gets value 1.
     * Incremented atomically via $inc in findOneAndUpdate.
     */
    currentValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    /**
     * Zero-padding length for the sequence portion.
     * Default 6 → "000001". Set to 8 for high-volume deployments.
     */
    paddingLength: {
      type: Number,
      default: 6,
      min: 4,
      max: 10,
    },

    /**
     * Reset strategy.
     * "fiscal_year" — resets to 0 when fiscalYear rolls over (default).
     * "never"       — monotonically increases forever.
     */
    resetOn: {
      type: String,
      enum: ["fiscal_year", "never"],
      default: "fiscal_year",
    },
  },
  {
    timestamps: true,
  },
);

// Secondary lookup: find all counters for a given entity + type
DocumentCounterSchema.index({ entityId: 1, documentType: 1, fiscalYear: 1 });

export const DocumentCounter = mongoose.model(
  "DocumentCounter",
  DocumentCounterSchema,
);
