import mongoose from "mongoose";
import { AdvanceRent } from "./AdvanceRent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildAdvanceRentReceiptJournal, buildAdvanceRentRecognitionJournal } from "../ledger/journal-builders/advanceRent.js";
import { formatNepaliISO } from "../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

export async function receiveAdvanceRent({ entityId, tenantId, amountPaisa, paymentMethod, bankAccount, bankAccountCode, receiptDate, description, createdBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tenant = await Tenant.findById(tenantId).select("name").lean();
    if (!tenant) throw new Error("Tenant not found");

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

    await session.commitTransaction();
    return AdvanceRent.findById(advanceRentId).lean();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function listAdvanceRents({ entityId, tenantId, status, skip = 0, limit = 50 }) {
  const filter = {};
  if (entityId) filter.entityId = new mongoose.Types.ObjectId(String(entityId));
  if (tenantId) filter.tenant   = new mongoose.Types.ObjectId(String(tenantId));
  if (status)   filter.status   = status;
  return AdvanceRent.find(filter).populate("tenant","name email").sort({ receiptDate: -1 }).skip(skip).limit(limit).lean();
}
