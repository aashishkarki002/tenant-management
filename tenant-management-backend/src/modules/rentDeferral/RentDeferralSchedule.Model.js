import mongoose from "mongoose";

/**
 * RentDeferralSchedule
 *
 * Tracks the full-lease revenue recognition schedule for a tenant under
 * upfront-billing + accrual accounting. One document per tenant lease term.
 *
 * Accounting flow:
 *   Onboarding:   DR 1200 / CR 4000  — full lease AR + revenue
 *   Same day:     DR 4000 / CR 2300  — defer unearned portion
 *   Each month:   DR 2300 / CR 4000  — recognize earned portion (via cron)
 *
 * Idempotency:
 *   Each embedded period has its own Mongoose _id, used as Transaction.referenceId
 *   for the recognition journal. The postJournalEntry guard prevents duplicates.
 */

const periodSchema = new mongoose.Schema({
  nepaliYear:  { type: Number, required: true },
  nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
  daysInMonth: { type: Number, required: true },
  daysOccupied:{ type: Number, required: true },

  // Prorated amounts for this period (integers, paisa)
  earnedRentPaisa: { type: Number, required: true, default: 0 },
  earnedCamPaisa:  { type: Number, required: true, default: 0 },

  // Processing state
  status: {
    type: String,
    enum: ["pending", "processed", "skipped"],
    default: "pending",
  },
  processedAt: { type: Date, default: null },

  // Links to the recognition Transaction posted by the cron
  rentTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    default: null,
  },
});
// Mongoose auto-assigns _id to each period subdoc — this _id is used as
// the idempotency key (Transaction.referenceId) for the recognition journal.

const rentDeferralSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },

    // ── Lease dates ──────────────────────────────────────────────────────────
    leaseStartDate:   { type: Date, required: true },
    leaseEndDate:     { type: Date, required: true },
    leaseStartNepali: { type: String, required: true }, // "YYYY-MM-DD" BS
    leaseEndNepali:   { type: String, required: true }, // "YYYY-MM-DD" BS

    // ── Monthly rates (paisa) — snapshot at schedule creation time ───────────
    monthlyRentPaisa: { type: Number, required: true, min: 1 },
    monthlyCamPaisa:  { type: Number, default: 0, min: 0 },

    // ── Computed lease totals (sum of all period amounts) ─────────────────────
    totalLeaseRentPaisa: { type: Number, required: true },
    totalLeaseCamPaisa:  { type: Number, default: 0 },

    // ── Posting date (admin-chosen, may differ from leaseStartDate) ──────────
    postingDate:        { type: Date, required: true },
    postingNepaliDate:  { type: String, required: true }, // "YYYY-MM-DD" BS
    postingNepaliMonth: { type: Number, required: true },
    postingNepaliYear:  { type: Number, required: true },

    // ── Transaction links (set after journals are posted) ─────────────────────
    onboardingTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    initialDeferralTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "completed", "terminated"],
      default: "active",
    },

    // ── Period schedule (one entry per BS month within the lease) ─────────────
    periods: [periodSchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

// Unique: one active schedule per tenant (prevent double-booking the same lease)
rentDeferralSchema.index(
  { tenantId: 1, status: 1 },
  { unique: false }, // not strictly unique — allows terminated + new active
);
rentDeferralSchema.index({ entityId: 1, status: 1 });
// Month-end cron query
rentDeferralSchema.index({ status: 1, "periods.nepaliYear": 1, "periods.nepaliMonth": 1 });

export const RentDeferralSchedule = mongoose.model(
  "RentDeferralSchedule",
  rentDeferralSchema,
);
