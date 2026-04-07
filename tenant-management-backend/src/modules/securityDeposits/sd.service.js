import { Sd } from "./sd.model.js";
import { SdRefund } from "./sdRefund.model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildSecurityDepositJournal } from "../ledger/journal-builders/index.js";
import { createLiability } from "../liabilities/liabilty.service.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";

async function buildRefundTotalsMap(sdIds = []) {
  if (!sdIds.length) return new Map();

  const objectIds = sdIds.map((id) => id);
  const rows = await SdRefund.aggregate([
    {
      $match: {
        sd: { $in: objectIds },
        status: { $ne: "REVERSED" },
      },
    },
    {
      $group: {
        _id: "$sd",
        totalRefundedPaisa: { $sum: "$totalAmountPaisa" },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [String(row._id), Number(row.totalRefundedPaisa ?? 0)]),
  );
}

function withAuthoritativeSdTotals(sd, refundedPaisa) {
  if (!sd) return null;
  const total = Number(sd.amountPaisa ?? 0);
  const refunded = Number(refundedPaisa ?? 0);
  const remaining = Math.max(0, total - refunded);

  return {
    ...sd,
    totalRefundedPaisa: refunded,
    remainingAmountPaisa: remaining,
    remainingAmount: remaining / 100,
  };
}

async function enrichSdWithRefundTotals(sd) {
  if (!sd?._id) return sd;
  const totalsMap = await buildRefundTotalsMap([sd._id]);
  return withAuthoritativeSdTotals(sd, totalsMap.get(String(sd._id)) ?? 0);
}

async function enrichManySdsWithRefundTotals(sds = []) {
  if (!sds.length) return sds;
  const totalsMap = await buildRefundTotalsMap(sds.map((sd) => sd._id));
  return sds.map((sd) =>
    withAuthoritativeSdTotals(sd, totalsMap.get(String(sd._id)) ?? 0),
  );
}

export async function getSdById(sdId) {
  if (!sdId) throw new Error("Invalid security deposit id");
  const sd = await Sd.findById(sdId)
    .populate("tenant", "name phone")
    .populate("block", "name")
    .populate("innerBlock", "name")
    .lean({ virtuals: true });
  return enrichSdWithRefundTotals(sd);
}

/**
 * Returns the most relevant (active) SD for a tenant.
 * Prefer non-final states; fall back to the latest SD.
 */
export async function getSdByTenant(tenantId) {
  if (!tenantId) throw new Error("Invalid tenant id");

  const active = await Sd.findOne({
    tenant: tenantId,
    status: { $nin: ["refunded", "adjusted"] },
  })
    .sort({ createdAt: -1 })
    .populate("tenant", "name phone")
    .populate("block", "name")
    .populate("innerBlock", "name")
    .lean({ virtuals: true });

  if (active) return enrichSdWithRefundTotals(active);

  const latest = await Sd.findOne({ tenant: tenantId })
    .sort({ createdAt: -1 })
    .populate("tenant", "name phone")
    .populate("block", "name")
    .populate("innerBlock", "name")
    .lean({ virtuals: true });
  return enrichSdWithRefundTotals(latest);
}

export async function getAllSdsByTenant(tenantId) {
  if (!tenantId) throw new Error("Invalid tenant id");
  const docs = await Sd.find({ tenant: tenantId })
    .sort({ createdAt: -1 })
    .populate("tenant", "name phone")
    .populate("block", "name")
    .populate("innerBlock", "name")
    .lean({ virtuals: true });
  return enrichManySdsWithRefundTotals(docs);
}

/**
 * List SDs for a block with optional filters.
 * This is primarily used for admin/staff block views.
 */
export async function getSdsByBlock(blockId, opts = {}) {
  if (!blockId) throw new Error("Invalid block id");

  const query = { block: blockId };
  if (opts.status) query.status = opts.status;
  if (opts.nepaliYear != null) query.nepaliYear = opts.nepaliYear;

  const docs = await Sd.find(query)
    .sort({ createdAt: -1 })
    .populate("tenant", "name phone")
    .populate("block", "name")
    .populate("innerBlock", "name")
    .lean({ virtuals: true });

  const enrichedDocs = await enrichManySdsWithRefundTotals(docs);

  const search = String(opts.search ?? "").trim().toLowerCase();
  if (!search) return enrichedDocs;

  return enrichedDocs.filter((d) => {
    const tenantName = String(d?.tenant?.name ?? "").toLowerCase();
    const tenantPhone = String(d?.tenant?.phone ?? "").toLowerCase();
    return tenantName.includes(search) || tenantPhone.includes(search);
  });
}

/**
 * Lightweight summary for badges/cards.
 */
export async function getSdSummaryForTenant(tenantId) {
  const sd = await getSdByTenant(tenantId);
  if (!sd) return null;
  return {
    _id: sd._id,
    tenant: sd.tenant,
    block: sd.block,
    innerBlock: sd.innerBlock,
    status: sd.status,
    mode: sd.mode,
    amountPaisa: sd.amountPaisa,
    remainingAmountPaisa: sd.remainingAmountPaisa ?? null,
    nepaliDate: sd.nepaliDate,
    nepaliMonth: sd.nepaliMonth,
    nepaliYear: sd.nepaliYear,
    paidDate: sd.paidDate ?? null,
  };
}

export async function createSd(
  sdData,
  createdBy,
  session = null,
  entityId = null,
) {
  try {
    // ✅ Convert to paisa if needed
    if (!sdData.amountPaisa && sdData.amount) {
      sdData.amountPaisa = rupeesToPaisa(sdData.amount);
    }

    // Mongoose create() with a session requires an array of documents
    const opts = session ? { session } : {};
    const created = await Sd.create([sdData], opts);
    const sd = created[0];
    await sd.populate("tenant", "name");
    // Pass payment routing details to the journal builder to avoid "Invalid payment method"
    const sdPayload = buildSecurityDepositJournal(sd, {
      createdBy,
      paymentMethod: sdData.paymentMethod ?? sdData.mode,
      bankAccountCode: sdData.bankAccountCode,
    });
    await ledgerService.postJournalEntry(sdPayload, session, entityId);

    // ✅ Use paisa for liability creation
    const amountPaisa =
      sd.amountPaisa || (sd.amount ? rupeesToPaisa(sd.amount) : 0);
    const liabilityResult = await createLiability({
      source: "SECURITY_DEPOSIT",
      amountPaisa: amountPaisa,
      amount: amountPaisa / 100, // Backward compatibility
      date: sd.paidDate,
      payeeType: "TENANT",
      tenant: sd.tenant,
      referenceType: "SECURITY_DEPOSIT",
      referenceId: sd._id,
      createdBy: createdBy,
      session,
    });
    if (!liabilityResult.success) {
      throw new Error(
        liabilityResult.error ||
          liabilityResult.message ||
          "Failed to create SD liability",
      );
    }
    return {
      success: true,
      message: "Sd created successfully",
      data: sd,
    };
  } catch (error) {
    console.error("Failed to create sd:", error);
    return {
      success: false,
      message: "Failed to create sd",
      error: error.message,
    };
  }
}
