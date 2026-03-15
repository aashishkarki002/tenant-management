import mongoose from "mongoose";
import { safePaisaToRupees } from "../../../utils/moneyUtil.js";

/**
 * Account.Model.js — v2 (multi-entity)
 *
 * KEY CHANGE: Account codes are now scoped per OwnershipEntity.
 * The uniqueness constraint is (code, entityId), NOT code alone.
 *
 * Why: "Private" entity and "Company" entity both need a "4000 Rental Income"
 * account, but they must track separate balances for separate P&L reports.
 *
 * Lookup pattern changes:
 *   BEFORE: Account.findOne({ code })
 *   AFTER:  Account.findOne({ code, entityId })
 *
 * For merged/consolidated views, query without entityId and aggregate.
 */
const accountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["ASSET", "LIABILITY", "REVENUE", "EXPENSE", "EQUITY"],
      required: true,
    },
    parentAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    // ─────────────────────────────────────────────────
    // ENTITY SCOPE  (required — no more null/global accounts)
    // ─────────────────────────────────────────────────
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },

    // ─────────────────────────────────────────────────
    // FINANCIAL — stored as PAISA (integers)
    // ─────────────────────────────────────────────────
    currentBalancePaisa: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

// The primary lookup: resolve account by code within an entity
accountSchema.index({ code: 1, entityId: 1 }, { unique: true });
accountSchema.index({ type: 1, entityId: 1, isActive: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

accountSchema.virtual("currentBalance").get(function () {
  return safePaisaToRupees(this.currentBalancePaisa ?? 0);
});

export const Account = mongoose.model("Account", accountSchema);
