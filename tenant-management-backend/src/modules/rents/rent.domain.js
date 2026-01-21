import mongoose from "mongoose";

export function applyPaymentToRent(rent, amount, paymentDate, receivedBy) {
    rent.paidAmount += amount;
    rent.lastPaidDate = paymentDate;
  
    rent.lastPaidBy =
      receivedBy && mongoose.Types.ObjectId.isValid(receivedBy)
        ? new mongoose.Types.ObjectId(receivedBy)
        : null;
  
    const effectiveAmount = rent.rentAmount - (rent.tdsAmount || 0);
  
    if (rent.paidAmount === 0) rent.status = "pending";
    else if (rent.paidAmount >= effectiveAmount) rent.status = "paid";
    else rent.status = "partially_paid";
  }
  