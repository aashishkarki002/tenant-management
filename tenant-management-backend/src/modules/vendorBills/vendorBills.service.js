import mongoose from "mongoose";
import { VendorBill } from "./VendorBill.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildVendorBillEntryJournal, buildVendorBillPaymentJournal } from "../ledger/journal-builders/vendorBill.js";
import { formatNepaliISO } from "../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

export async function createVendorBill({ entityId, vendor, vendorName, billNumber, billDate, dueDate, amountPaisa, expenseAccountCode, description, notes, createdBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const txDate = billDate instanceof Date ? billDate : new Date(billDate ?? Date.now());
    const nd = new NepaliDate(txDate);
    const nepaliMonth = nd.getMonth() + 1;
    const nepaliYear  = nd.getYear();

    const [bill] = await VendorBill.create([{
      entityId, vendor: vendor ?? null, vendorName, billNumber: billNumber ?? null,
      billDate: txDate, dueDate: dueDate ? new Date(dueDate) : null,
      nepaliDate: formatNepaliISO(nd), nepaliMonth, nepaliYear,
      amountPaisa, expenseAccountCode, description: description ?? null,
      notes: notes ?? null, createdBy: createdBy ?? null, status: "PENDING",
    }], { session });

    const payload = buildVendorBillEntryJournal({
      billId: bill._id, entityId, amountPaisa, expenseAccountCode,
      billDate: txDate, nepaliMonth, nepaliYear, description, createdBy,
    });

    const { transaction } = await ledgerService.postJournalEntry(payload, session, entityId);
    await VendorBill.findByIdAndUpdate(bill._id, { $set: { billTransactionId: transaction._id } }, { session });

    await session.commitTransaction();
    return { ...bill.toObject(), billTransactionId: transaction._id };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function payVendorBill({ billId, entityId, amountPaisa, tdsDeductedPaisa = 0, paymentMethod, bankAccount, bankAccountCode, paymentDate, description, paidBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const bill = await VendorBill.findById(billId).session(session);
    if (!bill) throw new Error("VendorBill not found");
    if (bill.status === "PAID") throw new Error("Bill already fully paid");
    if (bill.status === "CANCELLED") throw new Error("Bill is cancelled");

    const txDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate ?? Date.now());
    const nd = new NepaliDate(txDate);

    const payload = buildVendorBillPaymentJournal({
      billId, entityId, amountPaisa, tdsDeductedPaisa,
      paymentMethod, bankAccountCode,
      paymentDate: txDate, nepaliMonth: nd.getMonth() + 1, nepaliYear: nd.getYear(), description, createdBy: paidBy,
    });

    const { transaction } = await ledgerService.postJournalEntry(payload, session, entityId);

    const newPaid = (bill.paidAmountPaisa ?? 0) + amountPaisa;
    const newStatus = newPaid >= bill.amountPaisa ? "PAID" : bill.status;

    await VendorBill.findByIdAndUpdate(billId, {
      $set: {
        paidAmountPaisa: newPaid, tdsDeductedPaisa: (bill.tdsDeductedPaisa ?? 0) + tdsDeductedPaisa,
        paymentMethod, bankAccount: bankAccount ?? null, bankAccountCode: bankAccountCode ?? null,
        paidAt: txDate, paidBy: paidBy ?? null, status: newStatus,
        paymentTransactionId: transaction._id,
      },
    }, { session });

    await session.commitTransaction();
    return VendorBill.findById(billId).lean();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function listVendorBills({ entityId, status, fiscalYear, skip = 0, limit = 50 }) {
  const filter = {};
  if (entityId)   filter.entityId   = new mongoose.Types.ObjectId(String(entityId));
  if (status)     filter.status     = status;
  if (fiscalYear) filter.nepaliYear = Number(fiscalYear);
  return VendorBill.find(filter).sort({ billDate: -1 }).skip(skip).limit(limit).lean();
}
