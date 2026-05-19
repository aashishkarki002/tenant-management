import mongoose from "mongoose";
import { AdvanceRent } from "./AdvanceRent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { Cam } from "../cam/cam.model.js";
import { Electricity } from "../electricity/Electricity.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildAdvanceRentReceiptJournal, buildAdvanceRentRecognitionJournal, buildAdvanceRentAllocationJournal } from "../ledger/journal-builders/advanceRent.js";
import { formatNepaliISO } from "../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";
import { syncTenantBalance } from "../tenantBalance/tenantBalance.service.js";
import { resolveEntityFromBlock } from "../../helper/resolveEntity.js";
import { createChequeDraft } from "../chequeDrafts/chequeDraft.service.js";

export async function receiveAdvanceRent({ entityId: entityIdArg, tenantId, amountPaisa, paymentMethod, bankAccount, bankAccountCode, chequeNumber, chequeDate, partyName, receiptDate, description, createdBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tenant = await Tenant.findById(tenantId).select("name block").lean();
    if (!tenant) throw new Error("Tenant not found");

    // Auto-resolve entityId from tenant's block if caller didn't supply one
    const entityId = entityIdArg
      ?? await resolveEntityFromBlock(tenant.block, session);
    if (!entityId) throw new Error("Cannot resolve entity for this tenant — ensure tenant's block has an ownershipEntityId");

    if (paymentMethod === "bank_transfer" && !bankAccountCode)
      throw new Error("bankAccountCode required for bank_transfer");
    if (paymentMethod === "cheque" && !chequeNumber?.trim())
      throw new Error("chequeNumber required for cheque payment");
    if (paymentMethod === "cheque" && !bankAccountCode)
      throw new Error("bankAccountCode required for cheque (deposit bank)");

    const txDate = receiptDate instanceof Date ? receiptDate : new Date(receiptDate ?? Date.now());
    const nd = new NepaliDate(txDate);

    const [advance] = await AdvanceRent.create([{
      entityId, tenant: tenantId, amountPaisa, recognizedAmountPaisa: 0,
      paymentMethod, bankAccount: bankAccount ?? null, bankAccountCode: bankAccountCode ?? null,
      receiptDate: txDate, nepaliDate: formatNepaliISO(nd),
      nepaliMonth: nd.getMonth() + 1, nepaliYear: nd.getYear(),
      description: description ?? null, status: "ACTIVE", createdBy: createdBy ?? null,
    }], { session });

    const payload = buildAdvanceRentReceiptJournal({
      advanceRentId: advance._id, tenantId, tenantName: tenant.name,
      entityId, amountPaisa, paymentMethod, bankAccountCode,
      receiptDate: txDate, nepaliMonth: nd.getMonth() + 1, nepaliYear: nd.getYear(), createdBy,
    });

    const { transaction } = await ledgerService.postJournalEntry(payload, session, entityId);
    await AdvanceRent.findByIdAndUpdate(advance._id, { $set: { receiptTransactionId: transaction._id } }, { session });

    if (paymentMethod === "cheque") {
      await createChequeDraft({
        chequeNumber: chequeNumber.trim(),
        chequeDate: chequeDate ? new Date(chequeDate) : txDate,
        direction: "RECEIVED",
        amountPaisa,
        bankAccountCode,
        referenceAccountCode: null,
        referenceType: "AdvanceRent",
        referenceId: advance._id,
        entityId,
        partyName: partyName ?? tenant.name,
        nepaliDate: formatNepaliISO(nd),
        nepaliMonth: nd.getMonth() + 1,
        nepaliYear: nd.getYear(),
        createdBy,
        skipReceiptJournal: true,
      }, session);
    }

    await syncTenantBalance(tenantId, session);

    await session.commitTransaction();
    return { ...advance.toObject(), receiptTransactionId: transaction._id };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function recognizeAdvanceRent({ advanceRentId, periodAmountPaisa, nepaliMonth, nepaliYear, recognitionDate, createdBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const advance = await AdvanceRent.findById(advanceRentId).populate("tenant","name").session(session);
    if (!advance) throw new Error("AdvanceRent not found");
    if (advance.status !== "ACTIVE") throw new Error("Advance is not active");

    const remaining = advance.amountPaisa - advance.recognizedAmountPaisa;
    if (periodAmountPaisa > remaining) throw new Error(`Cannot recognize ${periodAmountPaisa} paisa; only ${remaining} remaining`);

    const payload = buildAdvanceRentRecognitionJournal({
      advanceRentId, tenantId: advance.tenant._id, tenantName: advance.tenant.name,
      entityId: advance.entityId, periodAmountPaisa, nepaliMonth, nepaliYear, recognitionDate, createdBy,
    });

    await ledgerService.postJournalEntry(payload, session, advance.entityId);

    const newRecognized = advance.recognizedAmountPaisa + periodAmountPaisa;
    const newStatus = newRecognized >= advance.amountPaisa ? "FULLY_RECOGNIZED" : "ACTIVE";
    await AdvanceRent.findByIdAndUpdate(advanceRentId, { $set: { recognizedAmountPaisa: newRecognized, status: newStatus } }, { session });

    await syncTenantBalance(advance.tenant._id, session);

    await session.commitTransaction();
    return AdvanceRent.findById(advanceRentId).lean();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Allocate advance rent against an existing invoice (RENT | CAM | ELECTRICITY).
 *
 * Journals posted:
 *   RENT / ELECTRICITY: DR 2300 Deferred Rent, CR 1200 Accounts Receivable
 *   CAM:                DR 2300 Deferred Rent, CR 1210 CAM Receivable
 *
 * Revenue was already booked at charge time — this only clears the AR.
 */
export async function allocateAdvance({ advanceRentId, invoiceType, invoiceId, amountPaisa, nepaliMonth, nepaliYear, allocationDate, createdBy }) {
  if (!["RENT", "CAM", "ELECTRICITY"].includes(invoiceType))
    throw new Error(`invoiceType must be RENT, CAM, or ELECTRICITY`);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const advance = await AdvanceRent.findById(advanceRentId).populate("tenant", "name").session(session);
    if (!advance) throw new Error("AdvanceRent not found");
    if (advance.status !== "ACTIVE") throw new Error("Advance is not active");

    const remaining = advance.amountPaisa - advance.recognizedAmountPaisa;
    if (amountPaisa > remaining) throw new Error(`Cannot allocate ${amountPaisa} paisa; only ${remaining} remaining`);

    const txDate = allocationDate instanceof Date ? allocationDate : new Date(allocationDate ?? Date.now());
    const nd = new NepaliDate(txDate);
    const bm = nepaliMonth ?? nd.getMonth() + 1;
    const by = nepaliYear ?? nd.getYear();

    if (invoiceType === "RENT") {
      const rent = await Rent.findById(invoiceId).session(session);
      if (!rent) throw new Error("Rent not found");
      if (rent.status === "paid" || rent.status === "cancelled") throw new Error("Rent is already paid or cancelled");
      if (rent.tenant.toString() !== advance.tenant._id.toString()) throw new Error("Tenant mismatch");
      const rentRemaining = rent.grossRentAmountPaisa - (rent.tdsAmountPaisa || 0) - rent.paidAmountPaisa;
      if (amountPaisa > rentRemaining) throw new Error(`Only ${rentRemaining} paisa remaining on rent invoice`);
      rent.applyPayment(amountPaisa, txDate, createdBy);
      await rent.save({ session });

    } else if (invoiceType === "CAM") {
      const cam = await Cam.findById(invoiceId).session(session);
      if (!cam) throw new Error("CAM not found");
      if (cam.status === "paid" || cam.status === "cancelled") throw new Error("CAM is already paid or cancelled");
      if (cam.tenant.toString() !== advance.tenant._id.toString()) throw new Error("Tenant mismatch");
      const camRemaining = cam.amountPaisa - cam.paidAmountPaisa;
      if (amountPaisa > camRemaining) throw new Error(`Only ${camRemaining} paisa remaining on CAM invoice`);
      cam.paidAmountPaisa += amountPaisa;
      await cam.save({ session });

    } else {
      const elec = await Electricity.findById(invoiceId).session(session);
      if (!elec) throw new Error("Electricity record not found");
      if (elec.status === "paid") throw new Error("Electricity bill is already paid");
      const elecTenantId = elec.get ? elec.get("tenant", null, { getters: false }) : elec.tenant;
      if (elecTenantId?.toString() !== advance.tenant._id.toString()) throw new Error("Tenant mismatch");
      const elecRemaining = elec.totalAmountPaisa - elec.paidAmountPaisa;
      if (amountPaisa > elecRemaining) throw new Error(`Only ${elecRemaining} paisa remaining on electricity bill`);
      elec.paidAmountPaisa += amountPaisa;
      await elec.save({ session });
    }

    const payload = buildAdvanceRentAllocationJournal({
      advanceRentId, invoiceType,
      tenantId: advance.tenant._id, tenantName: advance.tenant.name,
      entityId: advance.entityId,
      amountPaisa, nepaliMonth: bm, nepaliYear: by,
      allocationDate: txDate, createdBy,
    });

    await ledgerService.postJournalEntry(payload, session, advance.entityId);

    const newRecognized = advance.recognizedAmountPaisa + amountPaisa;
    const newStatus = newRecognized >= advance.amountPaisa ? "FULLY_RECOGNIZED" : "ACTIVE";
    await AdvanceRent.findByIdAndUpdate(advanceRentId, { $set: { recognizedAmountPaisa: newRecognized, status: newStatus } }, { session });

    await syncTenantBalance(advance.tenant._id, session);

    await session.commitTransaction();
    return AdvanceRent.findById(advanceRentId).lean();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export const allocateAdvanceToRent = (args) => allocateAdvance({ ...args, invoiceType: "RENT", invoiceId: args.rentId });

export async function listAdvanceRents({ entityId, tenantId, status, skip = 0, limit = 50 }) {
  const filter = {};
  if (entityId) filter.entityId = new mongoose.Types.ObjectId(String(entityId));
  if (tenantId) filter.tenant   = new mongoose.Types.ObjectId(String(tenantId));
  if (status)   filter.status   = status;
  return AdvanceRent.find(filter).populate("tenant","name email").sort({ receiptDate: -1 }).skip(skip).limit(limit).lean();
}
