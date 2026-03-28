/**
 * Electricity.Model.js — updated
 *
 * Key addition: dual-rate billing fields
 *
 *   ratePerUnitPaisa     → custom rate (what tenant pays) — was already here
 *   neaRatePerUnitPaisa  → NEA cost rate (what owner pays NEA) — NEW
 *   totalAmountPaisa     → consumption × customRate  (tenant invoice amount)
 *   neaCostPaisa         → consumption × neaRate     (owner's actual NEA cost) — NEW
 *   marginPaisa          → totalAmountPaisa - neaCostPaisa  (owner's profit) — NEW
 *
 * Billing responsibility (enforced by pre-save):
 *   meterType "unit"        → billTo "tenant",   tenant + unit required
 *   meterType "common_area" → billTo "property",  subMeter required
 *   meterType "parking"     → billTo "property",  subMeter required
 *   meterType "sub_meter"   → billTo "property",  subMeter required
 */

import mongoose from "mongoose";
import {
  paisaToRupees,
  rupeesToPaisa,
  formatMoney,
} from "../../utils/moneyUtil.js";
import { METER_TYPES } from "./SubMeter.Model.js";

// ─── Schema ───────────────────────────────────────────────────────────────────
const electricitySchema = new mongoose.Schema(
  {
    // ── Meter classification ─────────────────────────────────────────────────
    meterType: {
      type: String,
      enum: Object.values(METER_TYPES),
      default: METER_TYPES.UNIT,
      required: true,
      index: true,
    },

    billTo: {
      type: String,
      enum: ["tenant", "property", "vendor"],
      default: "tenant",
      index: true,
    },

    // ── References (conditional) ──────────────────────────────────────────────
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
      index: true,
    },
    subMeter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubMeter",
      default: null,
      index: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property is required"],
      index: true,
    },

    // ── Meter readings ────────────────────────────────────────────────────────
    previousReading: { type: Number, required: true, min: 0 },
    currentReading: { type: Number, required: true, min: 0 },
    consumption: { type: Number, required: true, min: 0 }, // set in pre-save

    // ── Financial — all stored as PAISA (integers) ────────────────────────────

    // Custom rate: what you charge the tenant (source: ElectricityRate.customRatePerUnitPaisa)
    ratePerUnitPaisa: {
      type: Number,
      required: [true, "ratePerUnitPaisa is required"],
      min: 1,
    },

    // NEA rate: what NEA charges the building owner (source: ElectricityRate.neaRatePerUnitPaisa)
    // null = NEA rate not configured at time of reading, margin not tracked.
    neaRatePerUnitPaisa: {
      type: Number,
      default: null,
      min: 1,
    },

    // Tenant invoice total = consumption × ratePerUnitPaisa
    totalAmountPaisa: { type: Number, required: true, min: 0 },

    // Owner's actual NEA cost = consumption × neaRatePerUnitPaisa
    // null when neaRatePerUnitPaisa is null.
    neaCostPaisa: { type: Number, default: null, min: 0 },

    // Margin = totalAmountPaisa - neaCostPaisa
    // null when neaCostPaisa is null.
    marginPaisa: { type: Number, default: null },

    paidAmountPaisa: { type: Number, default: 0, min: 0 },

    // ── Nepali date ───────────────────────────────────────────────────────────
    nepaliMonth: { type: Number, required: true, min: 1, max: 12 },
    nepaliYear: { type: Number, required: true },
    nepaliDate: { type: String, required: true }, // e.g. "Ashwin 2081"

    // ── English date ──────────────────────────────────────────────────────────
    englishMonth: { type: Number, required: true, min: 1, max: 12 },
    englishYear: { type: Number, required: true },
    readingDate: { type: Date, required: true, default: Date.now },

    // ── Payment status ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "paid", "partially_paid", "overdue"],
      default: "pending",
      index: true,
    },
    paidDate: { type: Date, default: null },

    // ── Receipt ───────────────────────────────────────────────────────────────
    receipt: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      generatedAt: { type: Date, default: null },
    },

    // ── Tenant transition tracking ────────────────────────────────────────────
    isInitialReading: { type: Boolean, default: false },
    isTenantTransition: { type: Boolean, default: false },
    previousTenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    previousRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Electricity",
      default: null,
    },

    // ── Misc ──────────────────────────────────────────────────────────────────
    notes: { type: String, default: "", trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "createdBy is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Virtuals (rupee views — READ ONLY) ──────────────────────────────────────

electricitySchema.virtual("ratePerUnit").get(function () {
  return this.ratePerUnitPaisa != null
    ? paisaToRupees(this.ratePerUnitPaisa)
    : null;
});
electricitySchema.virtual("neaRatePerUnit").get(function () {
  return this.neaRatePerUnitPaisa != null
    ? paisaToRupees(this.neaRatePerUnitPaisa)
    : null;
});
electricitySchema.virtual("totalAmount").get(function () {
  return this.totalAmountPaisa != null
    ? paisaToRupees(this.totalAmountPaisa)
    : null;
});
electricitySchema.virtual("neaCost").get(function () {
  return this.neaCostPaisa != null ? paisaToRupees(this.neaCostPaisa) : null;
});
electricitySchema.virtual("margin").get(function () {
  return this.marginPaisa != null ? paisaToRupees(this.marginPaisa) : null;
});
electricitySchema.virtual("paidAmount").get(function () {
  return this.paidAmountPaisa != null
    ? paisaToRupees(this.paidAmountPaisa)
    : null;
});
electricitySchema.virtual("remainingAmount").get(function () {
  if (this.totalAmountPaisa == null || this.paidAmountPaisa == null)
    return null;
  return paisaToRupees(
    Math.max(0, this.totalAmountPaisa - this.paidAmountPaisa),
  );
});

// Formatted display strings
electricitySchema.virtual("ratePerUnitFormatted").get(function () {
  return this.ratePerUnitPaisa != null
    ? formatMoney(this.ratePerUnitPaisa)
    : null;
});
electricitySchema.virtual("totalAmountFormatted").get(function () {
  return this.totalAmountPaisa != null
    ? formatMoney(this.totalAmountPaisa)
    : null;
});
electricitySchema.virtual("neaCostFormatted").get(function () {
  return this.neaCostPaisa != null ? formatMoney(this.neaCostPaisa) : null;
});
electricitySchema.virtual("marginFormatted").get(function () {
  return this.marginPaisa != null
    ? formatMoney(Math.abs(this.marginPaisa))
    : null;
});
electricitySchema.virtual("paidAmountFormatted").get(function () {
  return this.paidAmountPaisa != null
    ? formatMoney(this.paidAmountPaisa)
    : null;
});
electricitySchema.virtual("remainingAmountFormatted").get(function () {
  if (this.totalAmountPaisa == null || this.paidAmountPaisa == null)
    return null;
  return formatMoney(Math.max(0, this.totalAmountPaisa - this.paidAmountPaisa));
});

electricitySchema.virtual("isFullyPaid").get(function () {
  return this.paidAmountPaisa >= this.totalAmountPaisa;
});
electricitySchema.virtual("isSubMeterReading").get(function () {
  return this.meterType !== METER_TYPES.UNIT;
});

// ─── pre-save hook ────────────────────────────────────────────────────────────
electricitySchema.pre("save", async function () {
  // 1. Set billTo based on meterType
  if (this.meterType === METER_TYPES.UNIT) {
    this.billTo = "tenant";
  } else if (this.meterType === METER_TYPES.VENDOR) {
    this.billTo = "vendor";
  } else {
    this.billTo = "property";
  }

  // 2. Conditional reference validation
  if (this.meterType === METER_TYPES.UNIT) {
    if (!this.unit) throw new Error("unit is required for meterType 'unit'");
    this.subMeter = null;
  } else {
    if (!this.subMeter) {
      throw new Error(
        `subMeter is required for meterType '${this.meterType}'. ` +
          `Create a SubMeter document first and pass its _id.`,
      );
    }
    this.tenant = null;
    this.unit = null;
  }

  // 3. Reading sanity check
  if (this.currentReading < this.previousReading) {
    throw new Error(
      `Current reading (${this.currentReading}) cannot be less than ` +
        `previous reading (${this.previousReading})`,
    );
  }

  // 4. Recalculate consumption
  this.consumption = this.currentReading - this.previousReading;

  // 5. Validate ratePerUnitPaisa (custom rate — tenant billing)
  if (!Number.isInteger(this.ratePerUnitPaisa) || this.ratePerUnitPaisa < 1) {
    throw new Error(
      `ratePerUnitPaisa must be a positive integer (paisa). ` +
        `Got: ${this.ratePerUnitPaisa}. ` +
        `Convert rupees to paisa before saving (e.g. Rs 20 → 2000 paisa).`,
    );
  }

  // 6. Recalculate tenant invoice total
  this.totalAmountPaisa = Math.round(this.consumption * this.ratePerUnitPaisa);

  // 7. Recalculate NEA cost and margin if NEA rate is set
  if (this.neaRatePerUnitPaisa != null) {
    if (
      !Number.isInteger(this.neaRatePerUnitPaisa) ||
      this.neaRatePerUnitPaisa < 1
    ) {
      throw new Error(
        `neaRatePerUnitPaisa must be a positive integer (paisa). Got: ${this.neaRatePerUnitPaisa}.`,
      );
    }
    this.neaCostPaisa = Math.round(this.consumption * this.neaRatePerUnitPaisa);
    this.marginPaisa = this.totalAmountPaisa - this.neaCostPaisa;
  } else {
    this.neaCostPaisa = null;
    this.marginPaisa = null;
  }

  // 8. Validate paidAmountPaisa
  if (!Number.isInteger(this.paidAmountPaisa)) {
    throw new Error(
      `paidAmountPaisa must be an integer. Got: ${this.paidAmountPaisa}`,
    );
  }
  if (this.paidAmountPaisa > this.totalAmountPaisa) {
    throw new Error(
      `Paid amount (Rs ${this.paidAmountPaisa / 100}) exceeds total ` +
        `(Rs ${this.totalAmountPaisa / 100})`,
    );
  }

  // 9. Auto-update payment status
  if (this.status !== "overdue") {
    if (
      this.paidAmountPaisa >= this.totalAmountPaisa &&
      this.totalAmountPaisa > 0
    ) {
      this.status = "paid";
    } else if (this.paidAmountPaisa > 0) {
      this.status = "partially_paid";
    }
  }
});

// ─── Static helpers ───────────────────────────────────────────────────────────

electricitySchema.statics.getLastReading = async function (
  refType,
  refId,
  session = null,
) {
  const filter = refType === "unit" ? { unit: refId } : { subMeter: refId };
  const query = this.findOne(filter).sort({ readingDate: -1, createdAt: -1 });
  if (session) query.session(session);
  return query.lean();
};

electricitySchema.statics.summarise = async function (filter) {
  const [result] = await this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalAmountPaisa: { $sum: "$totalAmountPaisa" },
        totalPaidPaisa: { $sum: "$paidAmountPaisa" },
        totalNeaCostPaisa: { $sum: { $ifNull: ["$neaCostPaisa", 0] } },
        totalMarginPaisa: { $sum: { $ifNull: ["$marginPaisa", 0] } },
        totalConsumption: { $sum: "$consumption" },
        count: { $sum: 1 },
      },
    },
  ]);
  return (
    result ?? {
      totalAmountPaisa: 0,
      totalPaidPaisa: 0,
      totalNeaCostPaisa: 0,
      totalMarginPaisa: 0,
      totalConsumption: 0,
      count: 0,
    }
  );
};

// ─── Indexes ──────────────────────────────────────────────────────────────────

electricitySchema.index({ tenant: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ unit: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ subMeter: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({ property: 1, nepaliYear: -1, nepaliMonth: -1 });
electricitySchema.index({
  property: 1,
  meterType: 1,
  nepaliYear: -1,
  nepaliMonth: -1,
});
electricitySchema.index({
  property: 1,
  billTo: 1,
  nepaliYear: -1,
  nepaliMonth: -1,
});
electricitySchema.index({ status: 1, readingDate: -1 });
electricitySchema.index({ property: 1, status: 1 });

// Duplicate-reading prevention
electricitySchema.index(
  { unit: 1, nepaliYear: 1, nepaliMonth: 1 },
  {
    unique: true,
    partialFilterExpression: {
      unit: { $type: "objectId" },
      status: { $ne: "cancelled" },
    },
    name: "unique_unit_reading_per_month",
  },
);

electricitySchema.index(
  { subMeter: 1, nepaliYear: 1, nepaliMonth: 1 },
  {
    unique: true,
    partialFilterExpression: {
      subMeter: { $type: "objectId" },
      status: { $ne: "cancelled" },
    },
    name: "unique_submeter_reading_per_month",
  },
);

// ─── Export ───────────────────────────────────────────────────────────────────
export const Electricity = mongoose.model("Electricity", electricitySchema);
