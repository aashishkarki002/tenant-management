/**
 * Migration: link existing TDS rent records to quarterly payment buckets.
 *
 * Finds all rents with tdsAmountPaisa > 0, groups them by
 * (tenant, fiscalYear, quarter), creates TdsQuarterlyPayment buckets,
 * and back-links each rent via tdsQuarterlyPaymentId.
 *
 * Preserves existing tdsPaidToGovernment state:
 *   - If ALL months in a bucket already have tdsPaidToGovernment = true
 *     → bucket status = 'verified'
 *   - If SOME months → status = 'certificate_received' (conservative)
 *   - If NONE → status = 'pending'
 *
 * Idempotent — skips rents already linked (tdsQuarterlyPaymentId is set).
 *
 * Run: node src/migrations/linkExistingTdsToQuarters.js
 * DRY_RUN=true node src/migrations/linkExistingTdsToQuarters.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Rent } from "../modules/rents/rent.Model.js";
import { TdsQuarterlyPayment } from "../modules/tds/TdsQuarterlyPayment.Model.js";
import {
  getFiscalYearForMonth,
  getQuarterForMonth,
} from "../utils/tdsQuarterHelper.js";

dotenv.config();

const DRY_RUN = process.env.DRY_RUN === "true";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[linkExistingTdsToQuarters] START${DRY_RUN ? " (DRY RUN)" : ""}`);

  const rents = await Rent.find({
    tdsAmountPaisa: { $gt: 0 },
    tdsQuarterlyPaymentId: null,
  })
    .select("_id tenant property nepaliYear nepaliMonth tdsAmountPaisa tdsPaidToGovernment")
    .lean();

  console.log(`[linkExistingTdsToQuarters] Found ${rents.length} unlinked TDS rents`);

  // Group by (tenant, fiscalYear, quarter)
  const groups = new Map();
  for (const rent of rents) {
    const fiscalYear = getFiscalYearForMonth(rent.nepaliYear, rent.nepaliMonth);
    const quarter = getQuarterForMonth(rent.nepaliMonth);
    const key = `${rent.tenant}_${fiscalYear}_${quarter}`;

    if (!groups.has(key)) {
      groups.set(key, {
        tenantId: rent.tenant,
        propertyId: rent.property,
        fiscalYear,
        quarter,
        months: [],
      });
    }
    groups.get(key).months.push(rent);
  }

  console.log(`[linkExistingTdsToQuarters] ${groups.size} quarterly groups to process`);

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const [key, group] of groups) {
    const { tenantId, propertyId, fiscalYear, quarter, months } = group;

    const totalTdsPaisa = months.reduce((s, r) => s + r.tdsAmountPaisa, 0);
    const paidCount = months.filter((r) => r.tdsPaidToGovernment).length;
    const status =
      paidCount === months.length
        ? "verified"
        : paidCount > 0
        ? "certificate_received"
        : "pending";

    const monthEntries = months.map((r) => ({
      nepaliYear: r.nepaliYear,
      nepaliMonth: r.nepaliMonth,
      rentId: r._id,
      tdsAmountPaisa: r.tdsAmountPaisa,
    }));

    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert bucket ${key} — status=${status}, months=${months.length}, total=${totalTdsPaisa}`);
      continue;
    }

    const existing = await TdsQuarterlyPayment.findOne({
      tenant: tenantId,
      fiscalYear,
      quarter,
    });

    let bucketId;

    if (!existing) {
      const bucket = await TdsQuarterlyPayment.create({
        tenant: tenantId,
        property: propertyId,
        fiscalYear,
        quarter,
        months: monthEntries,
        totalTdsPaisa,
        status,
      });
      bucketId = bucket._id;
      created++;
    } else {
      // Append any months not already in the bucket
      const existingRentIds = new Set(
        existing.months.map((m) => m.rentId.toString()),
      );
      const newMonths = monthEntries.filter(
        (m) => !existingRentIds.has(m.rentId.toString()),
      );
      if (newMonths.length > 0) {
        await TdsQuarterlyPayment.findByIdAndUpdate(existing._id, {
          $push: { months: { $each: newMonths } },
          $inc: { totalTdsPaisa: newMonths.reduce((s, m) => s + m.tdsAmountPaisa, 0) },
        });
      }
      bucketId = existing._id;
      updated++;
    }

    // Back-link rents
    const rentIds = months.map((r) => r._id);
    await Rent.updateMany(
      { _id: { $in: rentIds } },
      { $set: { tdsQuarterlyPaymentId: bucketId } },
    );
    linked += rentIds.length;
  }

  console.log(
    `[linkExistingTdsToQuarters] DONE — created=${created}, updated=${updated}, linked=${linked} rents`,
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[linkExistingTdsToQuarters] FATAL:", err);
  process.exit(1);
});
