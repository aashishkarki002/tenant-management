import mongoose from "mongoose";
export function applyPaymentToCam(cam, amount, paymentDate, receivedBy) {
    cam.paidAmount += amount;
    cam.paidDate = paymentDate;
    cam.lastPaidBy =
      receivedBy && mongoose.Types.ObjectId.isValid(receivedBy)
        ? new mongoose.Types.ObjectId(receivedBy)
        : null;
        const effectiveAmount = cam.amount;
        if (cam.paidAmount === 0) cam.status = "pending";
    else if (cam.paidAmount >= effectiveAmount) cam.status = "paid";
    else cam.status = "partially_paid";
  }