import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const Rent = mongoose.model("Rent", new mongoose.Schema({}, { strict: false }));

// Pass 1: rents where tdsAmountPaisa > 0 and rentAmountPaisa is NET
// These are tenant-creation rents — tdsAmountPaisa is the correct total TDS.
const result = await Rent.updateMany(
  {
    tdsAmountPaisa: { $gt: 0 },
    rentAmountMigratedToGross: { $ne: true },
    // Guard: skip rents that are already GROSS (rentAmountPaisa > tdsAmountPaisa + some threshold)
    // A rent is already GROSS if rentAmountPaisa roughly equals NET + TDS.
    // We use a heuristic: if rentAmountPaisa + tdsAmountPaisa would produce an unrealistically
    // large number, the record is already GROSS. Safe threshold: tdsAmountPaisa / rentAmountPaisa < 0.5.
    $expr: {
      $lt: [
        { $divide: ["$tdsAmountPaisa", { $max: ["$rentAmountPaisa", 1] }] },
        0.5, // TDS should be < 50% of GROSS — e.g., 10% typical
      ],
    },
  },
  [
    {
      $set: {
        rentAmountPaisa: { $add: ["$rentAmountPaisa", "$tdsAmountPaisa"] },
        rentAmountMigratedToGross: true,
        // Also fix unit breakdown paisa values
        unitBreakdown: {
          $map: {
            input: "$unitBreakdown",
            as: "u",
            in: {
              $mergeObjects: [
                "$$u",
                {
                  rentAmountPaisa: {
                    $add: [
                      { $ifNull: ["$$u.rentAmountPaisa", 0] },
                      { $ifNull: ["$$u.tdsAmountPaisa", 0] },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
  ],
  { updatePipeline: true },
);

console.log(
  `Updated ${result.modifiedCount} rent documents to GROSS rentAmountPaisa`,
);

// Pass 2: cron rents where tdsAmountPaisa is the tiny per-sqft rate (~0)
// These need to be recalculated from the Tenant document.
// Identify them: tdsAmountPaisa > 0 but very small (< 100 paisa = < Rs 1)
const Tenant = mongoose.model(
  "Tenant",
  new mongoose.Schema({}, { strict: false }),
);
const cronRents = await Rent.find({
  tdsAmountPaisa: { $gt: 0, $lt: 100 },
}).lean();

let cronFixed = 0;
for (const rent of cronRents) {
  const tenant = await Tenant.findById(rent.tenant).lean();
  if (!tenant || !tenant.grossAmountPaisa || !tenant.totalRentPaisa) continue;

  const correctTds = Math.max(
    0,
    tenant.grossAmountPaisa - tenant.totalRentPaisa,
  );
  const correctGross = tenant.grossAmountPaisa;

  await Rent.updateOne(
    { _id: rent._id },
    { $set: { rentAmountPaisa: correctGross, tdsAmountPaisa: correctTds } },
  );
  cronFixed++;
}
console.log(`Fixed ${cronFixed} cron rents with corrected GROSS + TDS values`);

await mongoose.disconnect();
