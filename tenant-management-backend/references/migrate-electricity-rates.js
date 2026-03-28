// migrate-electricity-rates.js  — run once with: node migrate-electricity-rates.js
import dotenv from "dotenv";
import mongoose from "mongoose";

import { ElectricityRate } from "./src/modules/electricity/ElectricityRate.Model.js";
import { rupeesToPaisa } from "./src/utils/moneyUtil.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

function asPositivePaisa(value) {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return null;
  // Paisa must be an integer; rounding is safer than letting Mongoose cast
  // undefined to 0 and then failing min validators.
  return Math.round(num);
}

function toPaisaFromLegacy(value, { valueLooksLikeRupees }) {
  try {
    if (valueLooksLikeRupees) return rupeesToPaisa(value);
    return asPositivePaisa(value);
  } catch {
    return null;
  }
}

function inferCurrentCustomRatePerUnitPaisa(config) {
  // 1) Already present and valid
  const already = asPositivePaisa(config.currentCustomRatePerUnitPaisa);
  if (already != null) return already;

  // 1b) Legacy field names on the config doc itself
  const fromLegacyCurrentPaisa = asPositivePaisa(config.currentRatePerUnitPaisa);
  if (fromLegacyCurrentPaisa != null) return fromLegacyCurrentPaisa;

  // 2) Legacy "rupees" field names on the config doc itself
  const fromRupeesField = toPaisaFromLegacy(config.currentCustomRatePerUnit, {
    valueLooksLikeRupees: true,
  });
  const fromRupeesValid = asPositivePaisa(fromRupeesField);
  if (fromRupeesValid != null) return fromRupeesValid;

  // 3) Infer from active (effectiveTo === null) rateHistory entry, or last entry
  const rateHistory = config.rateHistory ?? [];
  const active =
    rateHistory.find((e) => e?.effectiveTo == null) ?? rateHistory[rateHistory.length - 1];

  if (active) {
    const fromEntryPaisa =
      asPositivePaisa(active.customRatePerUnitPaisa) ??
      asPositivePaisa(active.ratePerUnitPaisa);
    if (fromEntryPaisa != null) return fromEntryPaisa;

    const fromEntryRupees =
      toPaisaFromLegacy(active.customRatePerUnit, {
        valueLooksLikeRupees: true,
      }) ??
      toPaisaFromLegacy(active.ratePerUnit, { valueLooksLikeRupees: true });
    const fromEntryRupeesValid = asPositivePaisa(fromEntryRupees);
    if (fromEntryRupeesValid != null) return fromEntryRupeesValid;
  }

  // 4) As a fallback, try per-meter-type overrides.
  //    If any override is positive, we can use it as the "current default".
  const mt = config.meterTypeRates ?? {};
  const overrideCandidates = [
    mt.unit,
    mt.common_area,
    mt.parking,
    mt.sub_meter,
  ].filter((v) => v != null);

  for (const candidate of overrideCandidates) {
    const paisaDirect = asPositivePaisa(candidate);
    if (paisaDirect != null) return paisaDirect;

    const paisaFromRupees = toPaisaFromLegacy(candidate, {
      valueLooksLikeRupees: true,
    });
    const valid = asPositivePaisa(paisaFromRupees);
    if (valid != null) return valid;
  }

  return null;
}

function backfillCustomRatePerUnitPaisa({ entry, config }) {
  const current = inferCurrentCustomRatePerUnitPaisa(config);
  if (current != null) {
    config.currentCustomRatePerUnitPaisa = current;
  }

  // Try legacy fields for each history entry.
  const fromEntryPaisa =
    asPositivePaisa(entry.customRatePerUnitPaisa) ?? // already good
    asPositivePaisa(entry.ratePerUnitPaisa); // legacy paisa field name

  if (fromEntryPaisa != null) {
    entry.customRatePerUnitPaisa = fromEntryPaisa;
    return;
  }

  const fromEntryRupees =
    toPaisaFromLegacy(entry.customRatePerUnit, { valueLooksLikeRupees: true }) ??
    toPaisaFromLegacy(entry.ratePerUnit, { valueLooksLikeRupees: true });

  if (fromEntryRupees != null) {
    entry.customRatePerUnitPaisa = fromEntryRupees;
    return;
  }

  // Last resort: use current custom rate inferred from config doc / active history.
  const fallback = inferCurrentCustomRatePerUnitPaisa(config);
  if (fallback != null) {
    entry.customRatePerUnitPaisa = fallback;
  }
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is missing. Ensure `tenant-management-backend/.env` is present and has MONGODB_URI.",
    );
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.");

  const configs = await ElectricityRate.find({
    $or: [
      { "rateHistory.customRatePerUnitPaisa": { $exists: false } },
      { "rateHistory.customRatePerUnitPaisa": null },
    ],
  }).exec();

  console.log(`Found ${configs.length} ElectricityRate docs to check...`);

  let docsUpdated = 0;
  let entriesUpdated = 0;

  for (const config of configs) {
    let dirty = false;
    const rateHistory = config.rateHistory ?? [];

    // Helpful context when docs are already inconsistent with the schema.
    if (config.currentCustomRatePerUnitPaisa == null) {
      console.log("Doc missing currentCustomRatePerUnitPaisa:", {
        _id: String(config._id),
        property: String(config.property),
        currentCustomRatePerUnitPaisa: config.currentCustomRatePerUnitPaisa,
        currentCustomRatePerUnit: config.currentCustomRatePerUnit,
        currentRatePerUnitPaisa: config.currentRatePerUnitPaisa,
        meterTypeRates: config.meterTypeRates ?? {},
        rawDocKeys: Object.keys(config._doc ?? {}),
        sampleHistoryEntryKeys: rateHistory[0] ? Object.keys(rateHistory[0]) : [],
        sampleHistoryEntry: rateHistory[0]
          ? {
              customRatePerUnitPaisa: rateHistory[0].customRatePerUnitPaisa,
              ratePerUnitPaisa: rateHistory[0].ratePerUnitPaisa,
              customRatePerUnit: rateHistory[0].customRatePerUnit,
              ratePerUnit: rateHistory[0].ratePerUnit,
              effectiveFrom: rateHistory[0].effectiveFrom,
              effectiveTo: rateHistory[0].effectiveTo,
            }
          : null,
      });
    }

    // Ensure required "currentCustomRatePerUnitPaisa" exists before saving.
    const inferredCurrent = inferCurrentCustomRatePerUnitPaisa(config);
    if (
      inferredCurrent != null &&
      inferredCurrent >= 1 &&
      config.currentCustomRatePerUnitPaisa == null
    ) {
      config.currentCustomRatePerUnitPaisa = inferredCurrent;
      dirty = true;
    }

    for (const entry of rateHistory) {
      if (entry.customRatePerUnitPaisa == null) {
        backfillCustomRatePerUnitPaisa({ entry, config });
        const nowValid = asPositivePaisa(entry.customRatePerUnitPaisa);
        if (nowValid != null) {
          dirty = true;
          entriesUpdated++;
        }
      }
    }

    if (dirty) {
      try {
        await config.save();
      } catch (err) {
        console.error("Failed to save ElectricityRate doc:", {
          _id: String(config._id),
          errMessage: err?.message,
        });
        throw err;
      }
      docsUpdated++;
    }
  }

  console.log("Migration complete");
  console.log({ docsUpdated, entriesUpdated });
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });

