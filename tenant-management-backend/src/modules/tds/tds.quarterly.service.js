import mongoose from "mongoose";
import { TdsQuarterlyPayment } from "./TdsQuarterlyPayment.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { uploadFileToFTP } from "../ftpUpload/ftpUpload.service.js";
// Note: markTdsPaidToGovernment is dynamically imported inside verifyQuarterlyPayment
// to avoid the circular dependency with rent.service.js.
import { buildEntityMapForBlocks } from "../../helper/resolveEntity.js";
import {
  getFiscalYearForMonth,
  getQuarterForMonth,
} from "../../utils/tdsQuarterHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// BUCKET MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upserts the quarterly bucket for a given (tenant, fiscalYear, quarter).
 * Safe to call multiple times — creates if not exists, returns existing if already present.
 */
export async function getOrCreateQuarterlyGroup(
  tenantId,
  propertyId,
  fiscalYear,
  quarter,
  session = null,
) {
  const filter = {
    tenant: new mongoose.Types.ObjectId(tenantId),
    fiscalYear,
    quarter,
  };

  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) opts.session = session;

  const bucket = await TdsQuarterlyPayment.findOneAndUpdate(
    filter,
    { $setOnInsert: { property: new mongoose.Types.ObjectId(propertyId), fiscalYear, quarter } },
    opts,
  );

  return bucket;
}

/**
 * Links a rent document to its quarterly bucket.
 * Called from recordTdsLedgerEntry() after TDS_WITHHELD journal is posted.
 *
 * - Computes fiscalYear + quarter from rent.nepaliYear + rent.nepaliMonth
 * - Creates/gets bucket
 * - Appends month entry (idempotent — skips if rentId already in months[])
 * - Updates totalTdsPaisa
 * - Sets rent.tdsQuarterlyPaymentId
 */
export async function linkRentToQuarter(rent, session = null) {
  if (!rent.tdsAmountPaisa || rent.tdsAmountPaisa === 0) return;

  const fiscalYear = getFiscalYearForMonth(rent.nepaliYear, rent.nepaliMonth);
  const quarter = getQuarterForMonth(rent.nepaliMonth);

  const bucket = await getOrCreateQuarterlyGroup(
    rent.tenant._id ?? rent.tenant,
    rent.property,
    fiscalYear,
    quarter,
    session,
  );

  // Idempotent — skip if this rent already linked
  const alreadyLinked = bucket.months.some(
    (m) => m.rentId.toString() === rent._id.toString(),
  );

  if (!alreadyLinked) {
    const updateOpts = { new: true };
    if (session) updateOpts.session = session;

    await TdsQuarterlyPayment.findByIdAndUpdate(
      bucket._id,
      {
        $push: {
          months: {
            nepaliYear: rent.nepaliYear,
            nepaliMonth: rent.nepaliMonth,
            rentId: rent._id,
            tdsAmountPaisa: rent.tdsAmountPaisa,
          },
        },
        $inc: { totalTdsPaisa: rent.tdsAmountPaisa },
      },
      updateOpts,
    );
  }

  // Link rent back to this bucket
  await Rent.findByIdAndUpdate(
    rent._id,
    { $set: { tdsQuarterlyPaymentId: bucket._id } },
    session ? { session } : {},
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATE UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads an IRD certificate/challan file and appends its FTP path to the bucket.
 * Updates status → 'certificate_received' if still 'pending'.
 */
export async function uploadCertificate(quarterlyId, file, tenantId) {
  const bucket = await TdsQuarterlyPayment.findById(quarterlyId);
  if (!bucket) throw new Error("TDS quarterly payment record not found");
  if (bucket.status === "verified") {
    throw new Error("Cannot upload certificate to a verified payment");
  }

  const remotePath = await uploadFileToFTP(file, tenantId);

  const update = {
    $push: { certificateUrls: remotePath },
  };
  if (bucket.status === "pending") {
    update.$set = { status: "certificate_received" };
  }

  const updated = await TdsQuarterlyPayment.findByIdAndUpdate(
    quarterlyId,
    update,
    { new: true },
  );

  return { success: true, remotePath, bucket: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the quarterly TDS payment:
 *  1. Requires at least one certificate uploaded (certificateUrls not empty)
 *  2. Calls markTdsPaidToGovernment() for each rent in the bucket
 *  3. Updates bucket status → 'verified'
 *
 * Runs inside a MongoDB transaction — all rents verified or none.
 */
export async function verifyQuarterlyPayment(
  quarterlyId,
  adminId,
  { challanNumber, paymentDate, nepaliPaymentDate, notes } = {},
) {
  const bucket = await TdsQuarterlyPayment.findById(quarterlyId).populate(
    "months.rentId",
    "block tdsAmountPaisa tdsRecordedInLedger tdsPaidToGovernment",
  );

  if (!bucket) throw new Error("TDS quarterly payment record not found");

  if (bucket.status === "verified") {
    return { success: true, skipped: true, reason: "already_verified" };
  }

  if (!bucket.certificateUrls || bucket.certificateUrls.length === 0) {
    throw new Error(
      "Certificate required before verification. Upload IRD challan/certificate first.",
    );
  }

  const blockIds = bucket.months
    .map((m) => m.rentId?.block)
    .filter(Boolean);

  const entityMap = blockIds.length
    ? await buildEntityMapForBlocks(blockIds)
    : new Map();

  const { markTdsPaidToGovernment } = await import("../rents/rent.service.js");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const verifyData = {
      tdsPaidDate: paymentDate ? new Date(paymentDate) : new Date(),
      nepaliTdsPaidDate: nepaliPaymentDate || null,
      tdsPaidNotes: challanNumber
        ? `Challan: ${challanNumber}${notes ? " — " + notes : ""}`
        : notes || null,
    };

    for (const month of bucket.months) {
      if (!month.rentId) continue;

      const entityId = entityMap.get(month.rentId.block?.toString()) ?? null;

      await markTdsPaidToGovernment(
        month.rentId._id,
        adminId,
        verifyData,
        session,
        entityId,
      );
    }

    await TdsQuarterlyPayment.findByIdAndUpdate(
      quarterlyId,
      {
        $set: {
          status: "verified",
          challanNumber: challanNumber || null,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          nepaliPaymentDate: nepaliPaymentDate || null,
          verifiedBy: adminId,
          verifiedAt: new Date(),
          notes: notes || null,
        },
      },
      { session },
    );

    await session.commitTransaction();
    console.log(`[tds.quarterly] verified quarterlyId=${quarterlyId} by admin=${adminId}`);

    return { success: true };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export async function getQuarterlyPayments(filters = {}) {
  const query = {};

  if (filters.tenantId && mongoose.Types.ObjectId.isValid(filters.tenantId)) {
    query.tenant = new mongoose.Types.ObjectId(filters.tenantId);
  }
  if (filters.propertyId && mongoose.Types.ObjectId.isValid(filters.propertyId)) {
    query.property = new mongoose.Types.ObjectId(filters.propertyId);
  }
  if (filters.fiscalYear) query.fiscalYear = Number(filters.fiscalYear);
  if (filters.quarter) query.quarter = Number(filters.quarter);
  if (["pending", "certificate_received", "verified"].includes(filters.status)) {
    query.status = filters.status;
  }

  return TdsQuarterlyPayment.find(query)
    .sort({ fiscalYear: -1, quarter: -1 })
    .populate("tenant", "name email panNumber")
    .populate("property", "name")
    .populate("months.rentId", "nepaliYear nepaliMonth tdsAmountPaisa tdsPaidToGovernment grossRentAmountPaisa")
    .populate("verifiedBy", "name email")
    .lean();
}

export async function getQuarterlyPaymentById(id) {
  return TdsQuarterlyPayment.findById(id)
    .populate("tenant", "name email panNumber address")
    .populate("property", "name")
    .populate("months.rentId", "nepaliYear nepaliMonth tdsAmountPaisa tdsPaidToGovernment grossRentAmountPaisa status")
    .populate("verifiedBy", "name email")
    .lean();
}
