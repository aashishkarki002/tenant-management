import { createAndEmitNotification } from "../modules/notifications/notification.service.js";
import BankAccount from "../modules/banks/BankAccountModel.js";
import { formatMoney } from "./moneyUtil.js";
import dotenv from "dotenv";
dotenv.config();

export const emitPaymentNotification = async (normalizedData) => {
  // adminId param removed — we now broadcast to ALL active admins
  try {
    const {
      paymentId,
      tenantId,
      amountPaisa,
      paymentDate,
      paymentMethod,
      paymentStatus,
      note,
      receivedBy,
      bankAccountId,
    } = normalizedData;

    let bankName = "Unknown";
    if (bankAccountId) {
      const bank = await BankAccount.findById(bankAccountId).select("bankName");
      if (bank?.bankName) bankName = bank.bankName;
    }

    const dateStr = paymentDate
      ? new Date(paymentDate).toLocaleDateString()
      : "N/A";
    const amountStr = formatMoney(amountPaisa);
    const methodStr = paymentMethod || "N/A";

    const notificationMessage = `Payment of Rs. ${amountStr} received from tenant on ${dateStr} using ${methodStr}${
      bankAccountId ? ` (Bank Account: ${bankName})` : ""
    }`;

    // ✅ broadcasts to ALL active admins, not just the one who triggered the payment
    await createAndEmitNotification({
      type: "PAYMENT_NOTIFICATION",
      title: "Payment Notification",
      message: notificationMessage,
      data: {
        paymentId,
        tenantId,
        amountPaisa,
        paymentDate,
        paymentMethod,
        paymentStatus,
        note,
        receivedBy,
        bankAccountId,
      },
      // adminIds omitted → createAndEmitNotification defaults to ALL active admins
    });

    return {
      success: true,
      message: "Payment notification emitted successfully",
    };
  } catch (error) {
    console.error("Error emitting payment notification:", error);
    return {
      success: false,
      message: "Failed to emit payment notification",
      error: error.message,
    };
  }
};
