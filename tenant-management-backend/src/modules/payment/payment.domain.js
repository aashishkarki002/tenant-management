import mongoose from "mongoose";
import { Payment } from "./payment.model.js";

export function buildPaymentPayload({
  rent,
  tenantId,
  amount,
  paymentDate,
  paymentMethod,
  paymentStatus,
  note,
  adminId,
  bankAccountId,
  receivedBy,
}) {
  const payload = {
    rent: rent._id,
    tenant: tenantId,
    amount,
    paymentDate,
    nepaliMonth: rent.nepaliMonth,
    nepaliYear: rent.nepaliYear,
    nepaliDate: rent.nepaliDate,
    paymentMethod,
    paymentStatus: paymentStatus || "paid",
    note,
    createdBy: new mongoose.Types.ObjectId(adminId),
  };

  if (bankAccountId) payload.bankAccount = bankAccountId;
  if (receivedBy) payload.receivedBy = receivedBy;

  return payload;
}

export async function createPaymentRecord(paymentPayload, session) {
  const [payment] = await Payment.create([paymentPayload], { session });
  return payment;
}
  