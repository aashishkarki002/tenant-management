/**
 * ElectricityRate.Model.js — updated
 *
 * Dual-rate system:
 *   neaRatePerUnitPaisa    → what NEA actually charges (your cost)
 *   customRatePerUnitPaisa → what you charge tenants (your revenue)
 *
 * Margin = customRate - neaRate  (shown in P&L as electricity income)
 *
 * One document per property. Rate history is kept as a sub-array (never deleted).
 * The "active" rates are always the most recent entries.
 *
 * IMPORTANT: Rates are stored per PROPERTY (the whole estate).
 * resolveRate() accepts a blockId and looks up the property via Block.property.
 * This avoids duplicating rate config across all 4 blocks — one config serves all.
 */

import mongoose from "mongoose";
import { paisaToRupees, rupeesToPaisa } from "../../utils/moneyUtil.js";

// ─── Rate history entry ───────────────────────────────────────────────────────

const rateHistoryEntrySchema = new mongoose.Schema(
  {
    // Custom rate (what tenant pays) — stored as paisa
    customRatePerUnitPaisa: { type: Number, required: true, min: 1 },

    // NEA rate (your cost from NEA) — stored as paisa
    // Optional: if not set, margin tracking is disabled for that period.
    neaRatePerUnitPaisa: { type: Number, default: null, min: 1 },

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null }, // null = currently active
    note: { type: String, default: "" }, // e.g. "NEA tariff revision Mangsir 2082"
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { _id: true },
);

rateHistoryEntrySchema.virtual("customRatePerUnit").get(function () {
  return paisaToRupees(this.customRatePerUnitPaisa);
});
rateHistoryEntrySchema.virtual("neaRatePerUnit").get(function () {
  return this.neaRatePerUnitPaisa != null
    ? paisaToRupees(this.neaRatePerUnitPaisa)
    : null;
});
rateHistoryEntrySchema.virtual("marginPerUnit").get(function () {
  if (this.neaRatePerUnitPaisa == null) return null;
  return paisaToRupees(this.customRatePerUnitPaisa - this.neaRatePerUnitPaisa);
});

// ─── Main schema ──────────────────────────────────────────────────────────────

const electricityRateSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      unique: true, // one rate-config doc per property
      index: true,
    },

    // ── Active rates (denormalised for fast reads) ─────────────────────────
    // What you charge the tenant per kWh — this goes to Revenue
    currentCustomRatePerUnitPaisa: { type: Number, required: true, min: 1 },

    // What NEA charges you per kWh — this goes to Expense (NEA Payable)
    // null = NEA rate not configured, margin tracking disabled
    currentNeaRatePerUnitPaisa: { type: Number, default: null, min: 1 },

    // ── Per-meter-type overrides (custom rate only) ────────────────────────
    // NEA rate is always a single figure per property (one master meter).
    // Per-type custom overrides let you charge parking/common_area differently.
    meterTypeRates: {
      unit: { type: Number, default: null }, // paisa, null = use default custom rate
      common_area: { type: Number, default: null },
      parking: { type: Number, default: null },
      sub_meter: { type: Number, default: null },
    },

    // ── Full rate history (append-only) ───────────────────────────────────
    rateHistory: { type: [rateHistoryEntrySchema], default: [] },
  },
  { timestamps: true },
);

// ─── Virtuals ────────────────────────────────────────────────────────────────

electricityRateSchema.virtual("currentCustomRatePerUnit").get(function () {
  return paisaToRupees(this.currentCustomRatePerUnitPaisa);
});
electricityRateSchema.virtual("currentNeaRatePerUnit").get(function () {
  return this.currentNeaRatePerUnitPaisa != null
    ? paisaToRupees(this.currentNeaRatePerUnitPaisa)
    : null;
});
electricityRateSchema.virtual("currentMarginPerUnit").get(function () {
  if (this.currentNeaRatePerUnitPaisa == null) return null;
  return paisaToRupees(
    this.currentCustomRatePerUnitPaisa - this.currentNeaRatePerUnitPaisa,
  );
});

// ─── Statics ─────────────────────────────────────────────────────────────────

/**
 * Resolve both rates for a given property + meterType.
 *
 * Returns:
 *   {
 *     customRatePerUnitPaisa,  ← what to charge tenant (used for totalAmountPaisa)
 *     neaRatePerUnitPaisa,     ← your NEA cost (used for neaCostPaisa), may be null
 *   }
 *
 * Resolution order for custom rate:
 *   1. Per-type override (meterTypeRates.unit / common_area / parking / sub_meter)
 *   2. Property default (currentCustomRatePerUnitPaisa)
 *
 * NEA rate is always the property-level figure (no per-type override for NEA).
 */
electricityRateSchema.statics.resolveRates = async function (
  propertyId,
  meterType = "unit",
) {
  const config = await this.findOne({ property: propertyId }).lean();
  if (!config) {
    throw new Error(
      `No electricity rate configured for this property. ` +
        `Please set a rate in Settings → Electricity Rates before recording readings.`,
    );
  }

  const override = config.meterTypeRates?.[meterType];
  const customRatePerUnitPaisa =
    override ?? config.currentCustomRatePerUnitPaisa;

  return {
    customRatePerUnitPaisa,
    neaRatePerUnitPaisa: config.currentNeaRatePerUnitPaisa ?? null,
  };
};

/**
 * Legacy compat: resolveRate(propertyId, meterType) → returns customRatePerUnitPaisa only.
 * Used by existing callers that haven't been migrated yet.
 * @deprecated Use resolveRates() for new code.
 */
electricityRateSchema.statics.resolveRate = async function (
  propertyId,
  meterType = "unit",
) {
  const { customRatePerUnitPaisa } = await this.resolveRates(
    propertyId,
    meterType,
  );
  return customRatePerUnitPaisa;
};

export const ElectricityRate = mongoose.model(
  "ElectricityRate",
  electricityRateSchema,
);
