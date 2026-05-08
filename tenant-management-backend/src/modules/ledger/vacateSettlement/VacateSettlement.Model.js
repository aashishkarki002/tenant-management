/**
 * VacateSettlement.Model.js
 *
 * Records the full vacate settlement for a tenant when they leave.
 * One settlement per tenant (unique constraint on tenant field).
 *
 * Settlement workflow:
 *  1. DRAFT — computed but not yet confirmed
 *  2. COMPLETED — all journals posted, ledger locked
 *  3. CANCELLED — settlement aborted (tenant stays)
 *
 * Once COMPLETED, the tenant.vacateStatus = "vacated" and no new
 * journal entries can be posted for that tenant.
 */

import mongoose from "mongoose";

const vacateSettlementSchema = new mongoose.Schema(
  {
    // ── Core refs ──────────────────────────────────────────────────────────
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true, // one settlement per tenant
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OwnershipEntity",
      required: true,
      index: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },

    // ── Vacate date ────────────────────────────────────────────────────────
    vacateDate:       { type: Date,   required: true },
    vacateDateNepali: { type: String },   // "YYYY-MM-DD" BS
    nepaliMonth:      { type: Number, required: true },
    nepaliYear:       { type: Number, required: true },

    // ── Workflow status ────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["DRAFT", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
    },

    // ── Outstanding balances at time of settlement ─────────────────────────
    finalRentDuePaisa:    { type: Number, default: 0 },
    finalCamDuePaisa:     { type: Number, default: 0 },
    finalElecDuePaisa:    { type: Number, default: 0 },
    totalArAtVacatePaisa: { type: Number, default: 0 }, // total AR before settlement

    // ── Pro-rated final month ──────────────────────────────────────────────
    proRatedRentPaisa: { type: Number, default: 0 },
    proRatedCamPaisa:  { type: Number, default: 0 },
    proRatedDays:      { type: Number }, // days tenant occupied in final month
    totalDaysInMonth:  { type: Number }, // total days in final month

    // ── Security deposit settlement ────────────────────────────────────────
    sdBalancePaisa:          { type: Number, default: 0 }, // SD held at vacate time
    sdAppliedToArPaisa:      { type: Number, default: 0 }, // SD used to clear AR
    sdMaintenanceDeduction:  { type: Number, default: 0 }, // SD withheld for maintenance
    sdCashRefundPaisa:       { type: Number, default: 0 }, // SD refunded in cash/bank

    // ── Bad debt ───────────────────────────────────────────────────────────
    badDebtWrittenOffPaisa: { type: Number, default: 0 },

    // ── Journal transaction references ────────────────────────────────────
    proRatedRentTxId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    proRatedCamTxId:  { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    sdSettlementTxId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    badDebtTxId:      { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    // ── Ledger lock ────────────────────────────────────────────────────────
    ledgerLockedAt: { type: Date },
    ledgerLockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

    // ── Output ────────────────────────────────────────────────────────────
    finalStatementPdfUrl: { type: String },

    // ── Audit ─────────────────────────────────────────────────────────────
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    settledAt: { type: Date },
    notes:     { type: String, trim: true },
  },
  { timestamps: true },
);

vacateSettlementSchema.index({ entityId: 1, status: 1 });

export const VacateSettlement = mongoose.model("VacateSettlement", vacateSettlementSchema);
